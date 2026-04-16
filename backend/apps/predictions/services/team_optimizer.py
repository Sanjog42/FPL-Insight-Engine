import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from .fpl_client import get_bootstrap

POSITION_BY_ELEMENT_TYPE = {
    1: "GK",
    2: "DEF",
    3: "MID",
    4: "FWD",
}
ELEMENT_TYPE_BY_POSITION = {v: k for k, v in POSITION_BY_ELEMENT_TYPE.items()}
REQUIRED_COUNTS = {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}
MAX_FROM_TEAM = 3


@dataclass
class SlotInput:
    slot_id: str
    position: str
    player_id: int


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def _vector_distance(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 1e9
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _normalize_with_stats(
    vectors: List[List[float]],
) -> Tuple[List[List[float]], List[float], List[float]]:
    if not vectors:
        return vectors, [], []
    col_count = len(vectors[0])
    mins = [min(row[i] for row in vectors) for i in range(col_count)]
    maxs = [max(row[i] for row in vectors) for i in range(col_count)]

    normalized = []
    for row in vectors:
        nr = []
        for i, value in enumerate(row):
            span = maxs[i] - mins[i]
            nr.append(0.0 if span == 0 else (value - mins[i]) / span)
        normalized.append(nr)
    return normalized, mins, maxs


def _normalize_query(query: List[float], mins: List[float], maxs: List[float]) -> List[float]:
    if not mins or not maxs:
        return query
    out = []
    for i, value in enumerate(query):
        span = maxs[i] - mins[i]
        out.append(0.0 if span == 0 else (value - mins[i]) / span)
    return out


def _knn_regression(
    normalized_vectors: List[List[float]],
    targets: List[float],
    query_vector: List[float],
    mins: List[float],
    maxs: List[float],
    k: int = 25,
    exclude_idx: Optional[int] = None,
) -> float:
    if not normalized_vectors:
        return 0.0

    nq = _normalize_query(query_vector, mins, maxs)
    distances = []
    for idx, vec in enumerate(normalized_vectors):
        if exclude_idx is not None and idx == exclude_idx:
            continue
        distances.append((idx, _vector_distance(vec, nq)))

    if not distances:
        return 0.0

    distances.sort(key=lambda x: x[1])
    neighbors = distances[: max(1, min(k, len(distances)))]

    weighted_sum = 0.0
    total_weight = 0.0
    for idx, dist in neighbors:
        weight = 1.0 / (dist + 0.03)
        weighted_sum += targets[idx] * weight
        total_weight += weight

    if total_weight == 0:
        return sum(targets[idx] for idx, _ in neighbors) / len(neighbors)
    return weighted_sum / total_weight


def _player_position(player: Dict) -> str:
    return POSITION_BY_ELEMENT_TYPE.get(_safe_int(player.get("element_type"), 0), "")


def _player_cost_m(player: Dict) -> float:
    return _safe_float(player.get("now_cost"), 0.0) / 10.0


def _player_name(player: Dict) -> str:
    first = (player.get("first_name") or "").strip()
    second = (player.get("second_name") or "").strip()
    combined = f"{first} {second}".strip()
    return combined or (player.get("web_name") or "Unknown")


def _features_for_player(player: Dict, teams_by_id: Dict[int, Dict]) -> List[float]:
    team = teams_by_id.get(_safe_int(player.get("team"), 0), {})
    minutes = _safe_float(player.get("minutes"), 0.0)
    appearances = max(1.0, minutes / 90.0)
    total_points = _safe_float(player.get("total_points"), 0.0)
    ppm = total_points / appearances

    return [
        _safe_float(player.get("now_cost"), 0.0),
        _safe_float(player.get("form"), 0.0),
        _safe_float(player.get("points_per_game"), 0.0),
        minutes,
        _safe_float(player.get("selected_by_percent"), 0.0),
        _safe_float(player.get("goals_scored"), 0.0),
        _safe_float(player.get("assists"), 0.0),
        _safe_float(player.get("clean_sheets"), 0.0),
        _safe_float(player.get("bonus"), 0.0),
        _safe_float(player.get("bps"), 0.0),
        _safe_float(player.get("ict_index"), 0.0),
        _safe_float(team.get("strength"), 3.0),
        _safe_float(team.get("strength_attack_home"), 3.0),
        _safe_float(team.get("strength_defence_home"), 3.0),
        ppm,
    ]


def _target_for_player(player: Dict) -> float:
    ppg = _safe_float(player.get("points_per_game"), 0.0)
    form = _safe_float(player.get("form"), 0.0)
    total_points = _safe_float(player.get("total_points"), 0.0)
    minutes = _safe_float(player.get("minutes"), 0.0)
    appearances = max(1.0, minutes / 90.0)
    ppm = total_points / appearances
    # Pseudo target blends stable and short-term signals.
    return (0.5 * ppg) + (0.3 * form) + (0.2 * ppm)


def _build_scored_players() -> Tuple[List[Dict], Dict[int, Dict]]:
    bootstrap, _ = get_bootstrap()
    players = bootstrap.get("elements", [])
    teams = bootstrap.get("teams", [])

    teams_by_id = {t.get("id"): t for t in teams}
    vectors = [_features_for_player(p, teams_by_id) for p in players]
    targets = [_target_for_player(p) for p in players]
    normalized_vectors, mins, maxs = _normalize_with_stats(vectors)

    scored = []
    for idx, player in enumerate(players):
        prediction = _knn_regression(
            normalized_vectors,
            targets,
            vectors[idx],
            mins,
            maxs,
            k=25,
            exclude_idx=idx,
        )
        prediction = _clamp(prediction, 0.0, 12.0)
        price = _player_cost_m(player)
        scored.append(
            {
                "id": _safe_int(player.get("id"), 0),
                "name": _player_name(player),
                "team_id": _safe_int(player.get("team"), 0),
                "team_name": teams_by_id.get(player.get("team"), {}).get("name", ""),
                "position": _player_position(player),
                "element_type": _safe_int(player.get("element_type"), 0),
                "now_cost": price,
                "predicted_points": round(prediction, 2),
                "value_score": round(prediction / max(price, 3.5), 4),
                "status": player.get("status") or "u",
            }
        )

    by_id = {p["id"]: p for p in scored}
    return scored, by_id


def _team_counts(player_ids: List[int], players_by_id: Dict[int, Dict]) -> Dict[int, int]:
    counts: Dict[int, int] = {}
    for pid in player_ids:
        player = players_by_id.get(pid)
        if not player:
            continue
        team_id = player["team_id"]
        counts[team_id] = counts.get(team_id, 0) + 1
    return counts


def _parse_slots(slots: List[Dict]) -> List[SlotInput]:
    parsed: List[SlotInput] = []
    for idx, slot in enumerate(slots):
        parsed.append(
            SlotInput(
                slot_id=str(slot.get("slot_id") or f"slot_{idx + 1}"),
                position=str(slot.get("position") or "").upper(),
                player_id=_safe_int(slot.get("player_id"), 0),
            )
        )
    return parsed


def _validate_full_squad(slots: List[SlotInput]):
    if len(slots) != 15:
        raise ValueError("team_slots must include exactly 15 players")

    counts = {"GK": 0, "DEF": 0, "MID": 0, "FWD": 0}
    seen = set()
    for slot in slots:
        if slot.position not in REQUIRED_COUNTS:
            raise ValueError(f"Invalid position: {slot.position}")
        if slot.player_id <= 0:
            raise ValueError("Each slot must include a valid player_id")
        if slot.player_id in seen:
            raise ValueError("Duplicate player_id in team_slots")
        seen.add(slot.player_id)
        counts[slot.position] += 1

    for pos, req in REQUIRED_COUNTS.items():
        if counts[pos] != req:
            raise ValueError(f"Invalid squad shape for {pos}: expected {req}")


def suggest_transfers(team_slots: List[Dict], remaining_budget: float, free_transfers: int = 1) -> Dict:
    slots = _parse_slots(team_slots)
    _validate_full_squad(slots)

    scored_players, players_by_id = _build_scored_players()

    squad_ids = [s.player_id for s in slots]
    for pid in squad_ids:
        if pid not in players_by_id:
            raise KeyError("player")

    bank = _safe_float(remaining_budget, 0.0)
    transfers_to_make = max(1, min(_safe_int(free_transfers, 1), 5))

    selected_ids = set(squad_ids)
    team_counts = _team_counts(list(selected_ids), players_by_id)
    suggestions = []

    for _ in range(transfers_to_make):
        best_option = None

        for slot in slots:
            out_player = players_by_id.get(slot.player_id)
            if not out_player:
                continue

            current_score = out_player["predicted_points"]
            spend_limit = out_player["now_cost"] + bank
            out_team = out_player["team_id"]

            for candidate in scored_players:
                if candidate["position"] != slot.position:
                    continue
                if candidate["id"] in selected_ids and candidate["id"] != slot.player_id:
                    continue
                if candidate["id"] == slot.player_id:
                    continue
                if candidate["status"] not in {"a", "d"}:
                    continue
                if candidate["now_cost"] > spend_limit + 1e-6:
                    continue

                in_team = candidate["team_id"]
                next_team_count = team_counts.get(in_team, 0)
                if in_team == out_team:
                    # swap in same team keeps count unchanged
                    pass
                elif next_team_count >= MAX_FROM_TEAM:
                    continue

                gain = candidate["predicted_points"] - current_score
                if gain <= 0.15:
                    continue

                score = (gain * 100.0) - (candidate["now_cost"] - out_player["now_cost"]) * 5.0
                if not best_option or score > best_option["score"]:
                    best_option = {
                        "score": score,
                        "slot_id": slot.slot_id,
                        "slot_position": slot.position,
                        "out_player": out_player,
                        "in_player": candidate,
                        "gain": gain,
                    }

        if not best_option:
            break

        out_player = best_option["out_player"]
        in_player = best_option["in_player"]

        bank = bank + out_player["now_cost"] - in_player["now_cost"]

        team_counts[out_player["team_id"]] = max(0, team_counts.get(out_player["team_id"], 0) - 1)
        team_counts[in_player["team_id"]] = team_counts.get(in_player["team_id"], 0) + 1

        selected_ids.remove(out_player["id"])
        selected_ids.add(in_player["id"])

        for slot in slots:
            if slot.slot_id == best_option["slot_id"]:
                slot.player_id = in_player["id"]
                break

        suggestions.append(
            {
                "slot_id": best_option["slot_id"],
                "position": best_option["slot_position"],
                "out": {
                    "id": out_player["id"],
                    "name": out_player["name"],
                    "team_name": out_player["team_name"],
                    "cost": out_player["now_cost"],
                    "predicted_points": out_player["predicted_points"],
                },
                "in": {
                    "id": in_player["id"],
                    "name": in_player["name"],
                    "team_name": in_player["team_name"],
                    "cost": in_player["now_cost"],
                    "predicted_points": in_player["predicted_points"],
                },
                "expected_gain": round(best_option["gain"], 2),
                "bank_after": round(bank, 1),
            }
        )

    return {
        "model": "knn_regression_transfer_optimizer",
        "free_transfers_used": len(suggestions),
        "remaining_budget": round(bank, 1),
        "suggestions": suggestions,
    }


def _pick_cheapest_skeleton(
    players: List[Dict],
    budget: float,
) -> Optional[List[Dict]]:
    selected: List[Dict] = []
    selected_ids = set()
    team_counts: Dict[int, int] = {}

    for position, needed in REQUIRED_COUNTS.items():
        candidates = [
            p for p in players
            if p["position"] == position and p["status"] in {"a", "d"}
        ]
        candidates.sort(key=lambda x: (x["now_cost"], -x["predicted_points"]))

        picked_for_pos = 0
        for c in candidates:
            if c["id"] in selected_ids:
                continue
            if team_counts.get(c["team_id"], 0) >= MAX_FROM_TEAM:
                continue
            selected.append(c)
            selected_ids.add(c["id"])
            team_counts[c["team_id"]] = team_counts.get(c["team_id"], 0) + 1
            picked_for_pos += 1
            if picked_for_pos == needed:
                break

        if picked_for_pos != needed:
            return None

    total_cost = sum(p["now_cost"] for p in selected)
    if total_cost > budget + 1e-6:
        return None
    return selected


def _upgrade_team(selected: List[Dict], pool: List[Dict], budget: float) -> List[Dict]:
    selected_ids = {p["id"] for p in selected}
    team_counts = _team_counts(list(selected_ids), {p["id"]: p for p in pool})
    spent = sum(p["now_cost"] for p in selected)
    bank = budget - spent

    improved = True
    while improved:
        improved = False
        best_move = None

        for idx, current in enumerate(selected):
            for cand in pool:
                if cand["position"] != current["position"]:
                    continue
                if cand["id"] in selected_ids:
                    continue
                if cand["status"] not in {"a", "d"}:
                    continue

                extra_cost = cand["now_cost"] - current["now_cost"]
                if extra_cost > bank + 1e-6:
                    continue

                if cand["team_id"] != current["team_id"] and team_counts.get(cand["team_id"], 0) >= MAX_FROM_TEAM:
                    continue

                gain = cand["predicted_points"] - current["predicted_points"]
                if gain <= 0.05:
                    continue

                move_score = (gain * 100.0) - max(extra_cost, 0.0) * 2.0
                if not best_move or move_score > best_move["score"]:
                    best_move = {
                        "score": move_score,
                        "idx": idx,
                        "out": current,
                        "in": cand,
                    }

        if best_move:
            out_p = best_move["out"]
            in_p = best_move["in"]
            selected[best_move["idx"]] = in_p

            selected_ids.remove(out_p["id"])
            selected_ids.add(in_p["id"])

            team_counts[out_p["team_id"]] = max(0, team_counts.get(out_p["team_id"], 0) - 1)
            team_counts[in_p["team_id"]] = team_counts.get(in_p["team_id"], 0) + 1

            bank += out_p["now_cost"] - in_p["now_cost"]
            improved = True

    return selected


def generate_full_team(budget: float = 100.0) -> Dict:
    total_budget = _safe_float(budget, 100.0)
    if total_budget < 80.0:
        raise ValueError("budget must be at least 80.0")

    scored_players, _ = _build_scored_players()
    skeleton = _pick_cheapest_skeleton(scored_players, total_budget)
    if not skeleton:
        raise ValueError("Could not generate a valid team under the provided budget")

    improved = _upgrade_team(skeleton, scored_players, total_budget)

    improved.sort(key=lambda p: (p["element_type"], -p["predicted_points"]))
    total_cost = round(sum(p["now_cost"] for p in improved), 1)
    bank = round(total_budget - total_cost, 1)

    captain = max(improved, key=lambda p: p["predicted_points"])

    return {
        "model": "knn_regression_squad_builder",
        "budget": round(total_budget, 1),
        "total_cost": total_cost,
        "remaining_budget": bank,
        "captain": {
            "id": captain["id"],
            "name": captain["name"],
            "predicted_points": captain["predicted_points"],
        },
        "team": [
            {
                "id": p["id"],
                "name": p["name"],
                "team_name": p["team_name"],
                "position": p["position"],
                "cost": p["now_cost"],
                "predicted_points": p["predicted_points"],
            }
            for p in improved
        ],
    }
