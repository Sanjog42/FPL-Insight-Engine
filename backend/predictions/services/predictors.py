import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple

from .fpl_client import get_bootstrap, get_element_summary, get_fixtures


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


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


def _estimate_avg_minutes(player: Dict) -> float:
    total_minutes = _safe_float(player.get("minutes"), 0.0)
    starts = player.get("starts") or player.get("appearances") or player.get("games_started")
    try:
        starts = int(starts) if starts is not None else 0
    except (TypeError, ValueError):
        starts = 0

    if starts > 0:
        return total_minutes / starts
    if total_minutes > 0:
        return min(90.0, total_minutes)
    return 0.0


def _get_next_gw(events: List[Dict]) -> Optional[int]:
    for event in events:
        if event.get("is_next"):
            return event.get("id")
    current = next((e for e in events if e.get("is_current")), None)
    if current:
        return current.get("id", 0) + 1
    return None



def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _get_first_future_gw(events: List[Dict]) -> Optional[int]:
    now_utc = datetime.now(timezone.utc)
    upcoming = []
    for event in events:
        gw_id = _safe_int(event.get("id"), 0)
        if gw_id <= 0:
            continue
        deadline = _parse_iso_datetime(event.get("deadline_time"))
        if deadline and deadline > now_utc:
            upcoming.append(gw_id)

    if upcoming:
        return min(upcoming)
    return _get_next_gw(events)

def _find_player(elements: List[Dict], player_id: int) -> Optional[Dict]:
    return next((p for p in elements if p.get("id") == player_id), None)


def _find_team(teams: List[Dict], team_id: int) -> Optional[Dict]:
    return next((t for t in teams if t.get("id") == team_id), None)


def _fixture_for_team(fixtures: List[Dict], team_id: int, gw: Optional[int]) -> Optional[Dict]:
    if gw is None:
        return None
    for fixture in fixtures:
        if fixture.get("event") != gw:
            continue
        if fixture.get("team_h") == team_id or fixture.get("team_a") == team_id:
            return fixture
    return None


def _weighted_average(values: List[float]) -> float:
    if not values:
        return 0.0
    weights = list(range(1, len(values) + 1))
    total_weight = sum(weights)
    return sum(v * w for v, w in zip(values, weights)) / total_weight


def _vector_distance(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 1e9
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _normalize_features(
    train_vectors: List[List[float]],
    query_vector: List[float],
) -> Tuple[List[List[float]], List[float]]:
    if not train_vectors:
        return train_vectors, query_vector

    col_count = len(train_vectors[0])
    mins = [min(row[i] for row in train_vectors) for i in range(col_count)]
    maxs = [max(row[i] for row in train_vectors) for i in range(col_count)]

    def normalize(row: List[float]) -> List[float]:
        normalized = []
        for i, value in enumerate(row):
            span = maxs[i] - mins[i]
            if span == 0:
                normalized.append(0.0)
            else:
                normalized.append((value - mins[i]) / span)
        return normalized

    return [normalize(row) for row in train_vectors], normalize(query_vector)


def _knn_neighbors(
    train_vectors: List[List[float]],
    query_vector: List[float],
    k: int = 7,
) -> List[Tuple[int, float]]:
    if not train_vectors:
        return []
    normalized_train, normalized_query = _normalize_features(train_vectors, query_vector)
    distances = [
        (idx, _vector_distance(vector, normalized_query))
        for idx, vector in enumerate(normalized_train)
    ]
    distances.sort(key=lambda x: x[1])
    return distances[: max(1, min(k, len(distances)))]


def _knn_regression(
    train_vectors: List[List[float]],
    train_targets: List[float],
    query_vector: List[float],
    k: int = 7,
    exclude_index: Optional[int] = None,
) -> float:
    neighbors = _knn_neighbors(train_vectors, query_vector, k=max(k + 1, 2))
    if exclude_index is not None:
        neighbors = [(idx, dist) for idx, dist in neighbors if idx != exclude_index]
    neighbors = neighbors[: max(1, min(k, len(neighbors)))]
    if not neighbors:
        return 0.0

    weighted_sum = 0.0
    total_weight = 0.0
    for idx, dist in neighbors:
        weight = 1.0 / (dist + 0.05)
        weighted_sum += train_targets[idx] * weight
        total_weight += weight

    if total_weight == 0:
        return sum(train_targets[idx] for idx, _ in neighbors) / len(neighbors)
    return weighted_sum / total_weight


def _knn_classification(
    train_vectors: List[List[float]],
    train_labels: List[str],
    query_vector: List[float],
    k: int = 9,
) -> Dict[str, float]:
    neighbors = _knn_neighbors(train_vectors, query_vector, k=k)
    if not neighbors:
        return {}

    weighted_votes: Dict[str, float] = {}
    for idx, dist in neighbors:
        label = train_labels[idx]
        weight = 1.0 / (dist + 0.05)
        weighted_votes[label] = weighted_votes.get(label, 0.0) + weight

    total = sum(weighted_votes.values())
    if total <= 0:
        return {}
    return {label: weight / total for label, weight in weighted_votes.items()}


def _strength_defence(team: Dict, venue: str) -> int:
    if venue == "H":
        return int(team.get("strength_defence_home", 3))
    return int(team.get("strength_defence_away", 3))


def _strength_attack(team: Dict, venue: str) -> int:
    if venue == "H":
        return int(team.get("strength_attack_home", 3))
    return int(team.get("strength_attack_away", 3))


def _expected_goals(home: Dict, away: Dict) -> Tuple[float, float]:
    home_attack = _strength_attack(home, "H")
    away_defence = _strength_defence(away, "A")
    away_attack = _strength_attack(away, "A")
    home_defence = _strength_defence(home, "H")

    home_xg = 1.25 + 0.3 * (home_attack - 3) - 0.25 * (away_defence - 3)
    away_xg = 1.05 + 0.3 * (away_attack - 3) - 0.25 * (home_defence - 3)

    return _clamp(home_xg, 0.2, 3.5), _clamp(away_xg, 0.2, 3.5)


def _poisson_prob(lmbda: float, k: int) -> float:
    return (lmbda ** k) * math.exp(-lmbda) / math.factorial(k)


def _outcome_probs(home_xg: float, away_xg: float, max_goals: int = 5) -> Dict[str, float]:
    home_win = 0.0
    draw = 0.0
    away_win = 0.0
    for i in range(max_goals + 1):
        for j in range(max_goals + 1):
            p = _poisson_prob(home_xg, i) * _poisson_prob(away_xg, j)
            if i > j:
                home_win += p
            elif i == j:
                draw += p
            else:
                away_win += p
    total = home_win + draw + away_win
    if total <= 0:
        return {"home": 0.33, "draw": 0.34, "away": 0.33}
    return {
        "home": home_win / total,
        "draw": draw / total,
        "away": away_win / total,
    }


def _recent_team_form(fixtures: List[Dict], team_id: int, limit: int = 5) -> Dict:
    finished = [
        f for f in fixtures
        if (f.get("team_h") == team_id or f.get("team_a") == team_id)
        and f.get("team_h_score") is not None
        and f.get("team_a_score") is not None
    ]
    finished.sort(key=lambda x: x.get("event", 0), reverse=True)
    recent = finished[:limit]

    if not recent:
        return {"played": 0, "gf_pg": 0.0, "ga_pg": 0.0, "ppg": 0.0}

    goals_for = 0
    goals_against = 0
    points = 0
    for f in recent:
        is_home = f.get("team_h") == team_id
        gf = f.get("team_h_score") if is_home else f.get("team_a_score")
        ga = f.get("team_a_score") if is_home else f.get("team_h_score")
        goals_for += gf
        goals_against += ga
        if gf > ga:
            points += 3
        elif gf == ga:
            points += 1

    played = len(recent)
    return {
        "played": played,
        "gf_pg": goals_for / played,
        "ga_pg": goals_against / played,
        "ppg": points / played,
    }


def _recent_team_home_away_stats(fixtures: List[Dict], team_id: int, limit: int = 5) -> Dict:
    finished = [
        f for f in fixtures
        if (f.get("team_h") == team_id or f.get("team_a") == team_id)
        and f.get("team_h_score") is not None
        and f.get("team_a_score") is not None
    ]
    finished.sort(key=lambda x: x.get("event", 0), reverse=True)
    recent = finished[:limit]

    home_played = 0
    away_played = 0
    home_gf = 0
    home_ga = 0
    away_gf = 0
    away_ga = 0

    for f in recent:
        if f.get("team_h") == team_id:
            home_played += 1
            home_gf += f.get("team_h_score", 0)
            home_ga += f.get("team_a_score", 0)
        else:
            away_played += 1
            away_gf += f.get("team_a_score", 0)
            away_ga += f.get("team_h_score", 0)

    return {
        "home_played": home_played,
        "away_played": away_played,
        "home_gf_pg": (home_gf / home_played) if home_played else 0.0,
        "home_ga_pg": (home_ga / home_played) if home_played else 0.0,
        "away_gf_pg": (away_gf / away_played) if away_played else 0.0,
        "away_ga_pg": (away_ga / away_played) if away_played else 0.0,
    }


def _league_goal_averages(fixtures: List[Dict]) -> Dict:
    finished = [
        f for f in fixtures
        if f.get("team_h_score") is not None and f.get("team_a_score") is not None
    ]
    if not finished:
        return {"home_gpg": 1.35, "away_gpg": 1.15}

    total_home = sum(f.get("team_h_score", 0) for f in finished)
    total_away = sum(f.get("team_a_score", 0) for f in finished)
    games = len(finished)
    return {
        "home_gpg": total_home / games,
        "away_gpg": total_away / games,
    }


def _blend_ratio(value: float, fallback: float, weight: float) -> float:
    return (value * weight) + (fallback * (1.0 - weight))


def _apply_form_adjustment(
    home_xg: float,
    away_xg: float,
    home_form: Dict,
    away_form: Dict,
) -> Tuple[float, float]:
    if home_form["played"] == 0 and away_form["played"] == 0:
        return home_xg, away_xg

    home_off = (home_form["gf_pg"] - away_form["ga_pg"]) * 0.18
    away_off = (away_form["gf_pg"] - home_form["ga_pg"]) * 0.18

    home_ppg_boost = (home_form["ppg"] - away_form["ppg"]) * 0.12
    away_ppg_boost = (away_form["ppg"] - home_form["ppg"]) * 0.12

    home_xg = home_xg + home_off + home_ppg_boost
    away_xg = away_xg + away_off + away_ppg_boost

    return _clamp(home_xg, 0.2, 3.5), _clamp(away_xg, 0.2, 3.5)


def _predict_match_stats(home: Dict, away: Dict, fixtures: List[Dict]) -> Dict:
    base_home_xg, base_away_xg = _expected_goals(home, away)

    league_avg = _league_goal_averages(fixtures)
    home_away_stats = _recent_team_home_away_stats(fixtures, home.get("id"))
    away_away_stats = _recent_team_home_away_stats(fixtures, away.get("id"))

    home_samples = home_away_stats["home_played"]
    away_samples = away_away_stats["away_played"]
    home_weight = min(1.0, home_samples / 5.0)
    away_weight = min(1.0, away_samples / 5.0)

    home_attack_ratio = (
        home_away_stats["home_gf_pg"] / league_avg["home_gpg"]
        if league_avg["home_gpg"] > 0 else 1.0
    )
    away_attack_ratio = (
        away_away_stats["away_gf_pg"] / league_avg["away_gpg"]
        if league_avg["away_gpg"] > 0 else 1.0
    )
    home_def_ratio = (
        home_away_stats["home_ga_pg"] / league_avg["away_gpg"]
        if league_avg["away_gpg"] > 0 else 1.0
    )
    away_def_ratio = (
        away_away_stats["away_ga_pg"] / league_avg["home_gpg"]
        if league_avg["home_gpg"] > 0 else 1.0
    )

    home_attack_ratio = _blend_ratio(home_attack_ratio, 1.0, home_weight)
    away_attack_ratio = _blend_ratio(away_attack_ratio, 1.0, away_weight)
    home_def_ratio = _blend_ratio(home_def_ratio, 1.0, home_weight)
    away_def_ratio = _blend_ratio(away_def_ratio, 1.0, away_weight)

    stat_home_xg = league_avg["home_gpg"] * home_attack_ratio * away_def_ratio
    stat_away_xg = league_avg["away_gpg"] * away_attack_ratio * home_def_ratio

    blend_weight = 0.65
    home_xg = (stat_home_xg * blend_weight) + (base_home_xg * (1.0 - blend_weight))
    away_xg = (stat_away_xg * blend_weight) + (base_away_xg * (1.0 - blend_weight))

    home_form = _recent_team_form(fixtures, home.get("id"))
    away_form = _recent_team_form(fixtures, away.get("id"))
    home_xg, away_xg = _apply_form_adjustment(home_xg, away_xg, home_form, away_form)
    probs = _outcome_probs(home_xg, away_xg)

    if probs["home"] >= probs["away"] and probs["home"] >= probs["draw"]:
        outcome = "HOME"
    elif probs["away"] >= probs["home"] and probs["away"] >= probs["draw"]:
        outcome = "AWAY"
    else:
        outcome = "DRAW"

    return {
        "outcome": outcome,
        "home_xg": round(home_xg, 2),
        "away_xg": round(away_xg, 2),
        "probs": {k: round(v, 3) for k, v in probs.items()},
        "form": {
            "home": home_form,
            "away": away_form,
        },
        "inputs": {
            "league_avg": league_avg,
            "home_away_stats": home_away_stats,
            "away_away_stats": away_away_stats,
        },
    }


def _build_player_training_row(item: Dict, teams: List[Dict]) -> Tuple[List[float], float]:
    opponent = _find_team(teams, _safe_int(item.get("opponent_team"), 0))
    opponent_strength = _safe_float(opponent.get("strength"), 3.0) if opponent else 3.0
    was_home = 1.0 if item.get("was_home") else 0.0

    feature_row = [
        _safe_float(item.get("minutes"), 0.0),
        _safe_float(item.get("goals_scored"), 0.0),
        _safe_float(item.get("assists"), 0.0),
        _safe_float(item.get("clean_sheets"), 0.0),
        _safe_float(item.get("bonus"), 0.0),
        _safe_float(item.get("bps"), 0.0),
        _safe_float(item.get("ict_index"), 0.0),
        _safe_float(item.get("value"), 0.0),
        was_home,
        opponent_strength,
    ]
    target = _safe_float(item.get("total_points"), 0.0)
    return feature_row, target


def _build_player_query_row(
    recent_history: List[Dict],
    opponent: Optional[Dict],
    venue: str,
    player: Dict,
) -> List[float]:
    if recent_history:
        minutes_avg = sum(_safe_float(r.get("minutes"), 0.0) for r in recent_history) / len(recent_history)
        goals_avg = sum(_safe_float(r.get("goals_scored"), 0.0) for r in recent_history) / len(recent_history)
        assists_avg = sum(_safe_float(r.get("assists"), 0.0) for r in recent_history) / len(recent_history)
        clean_sheet_avg = sum(_safe_float(r.get("clean_sheets"), 0.0) for r in recent_history) / len(recent_history)
        bonus_avg = sum(_safe_float(r.get("bonus"), 0.0) for r in recent_history) / len(recent_history)
        bps_avg = sum(_safe_float(r.get("bps"), 0.0) for r in recent_history) / len(recent_history)
        ict_avg = sum(_safe_float(r.get("ict_index"), 0.0) for r in recent_history) / len(recent_history)
        value_avg = sum(_safe_float(r.get("value"), 0.0) for r in recent_history) / len(recent_history)
    else:
        minutes_avg = _estimate_avg_minutes(player)
        goals_avg = 0.0
        assists_avg = 0.0
        clean_sheet_avg = 0.0
        bonus_avg = 0.0
        bps_avg = 0.0
        ict_avg = 0.0
        value_avg = _safe_float(player.get("now_cost"), 0.0)

    opponent_strength = _safe_float(opponent.get("strength"), 3.0) if opponent else 3.0
    return [
        minutes_avg,
        goals_avg,
        assists_avg,
        clean_sheet_avg,
        bonus_avg,
        bps_avg,
        ict_avg,
        value_avg,
        1.0 if venue == "H" else 0.0,
        opponent_strength,
    ]


def _build_price_windows(values: List[float]) -> Tuple[List[List[float]], List[str]]:
    features: List[List[float]] = []
    labels: List[str] = []
    if len(values) < 6:
        return features, labels

    for i in range(3, len(values) - 1):
        deltas = [
            values[i] - values[i - 1],
            values[i - 1] - values[i - 2],
            values[i - 2] - values[i - 3],
        ]
        mean_delta = sum(deltas) / 3.0
        variance = sum((d - mean_delta) ** 2 for d in deltas) / 3.0
        std_delta = math.sqrt(variance)
        features.append([deltas[0], deltas[1], deltas[2], mean_delta, std_delta])

        next_delta = values[i + 1] - values[i]
        if next_delta > 0:
            labels.append("RISE")
        elif next_delta < 0:
            labels.append("FALL")
        else:
            labels.append("STABLE")
    return features, labels


def _build_match_feature_vector(
    home: Dict,
    away: Dict,
    fixtures: List[Dict],
) -> List[float]:
    home_form = _recent_team_form(fixtures, home.get("id"), limit=5)
    away_form = _recent_team_form(fixtures, away.get("id"), limit=5)
    return [
        _safe_float(home.get("strength_attack_home"), 3.0),
        _safe_float(home.get("strength_defence_home"), 3.0),
        _safe_float(away.get("strength_attack_away"), 3.0),
        _safe_float(away.get("strength_defence_away"), 3.0),
        _safe_float(home.get("strength"), 3.0) - _safe_float(away.get("strength"), 3.0),
        home_form["gf_pg"] - away_form["gf_pg"],
        away_form["ga_pg"] - home_form["ga_pg"],
        home_form["ppg"] - away_form["ppg"],
    ]


def _predict_match_ml(home: Dict, away: Dict, teams: List[Dict], fixtures: List[Dict]) -> Dict:
    finished = [
        f for f in fixtures
        if f.get("team_h_score") is not None and f.get("team_a_score") is not None
    ]
    if len(finished) < 20:
        return _predict_match_stats(home, away, fixtures)

    train_features: List[List[float]] = []
    outcome_labels: List[str] = []
    home_goals: List[float] = []
    away_goals: List[float] = []

    for fixture in finished:
        home_team = _find_team(teams, fixture.get("team_h"))
        away_team = _find_team(teams, fixture.get("team_a"))
        if not home_team or not away_team:
            continue

        feature_row = _build_match_feature_vector(home_team, away_team, fixtures)
        train_features.append(feature_row)
        h_score = _safe_float(fixture.get("team_h_score"), 0.0)
        a_score = _safe_float(fixture.get("team_a_score"), 0.0)
        home_goals.append(h_score)
        away_goals.append(a_score)

        if h_score > a_score:
            outcome_labels.append("HOME")
        elif h_score < a_score:
            outcome_labels.append("AWAY")
        else:
            outcome_labels.append("DRAW")

    if not train_features:
        return _predict_match_stats(home, away, fixtures)

    query = _build_match_feature_vector(home, away, fixtures)

    # Core ML estimates
    knn_probs = _knn_classification(train_features, outcome_labels, query, k=21)
    home_xg = _knn_regression(train_features, home_goals, query, k=21)
    away_xg = _knn_regression(train_features, away_goals, query, k=21)
    home_xg = _clamp(home_xg, 0.2, 3.5)
    away_xg = _clamp(away_xg, 0.2, 3.5)

    # Probabilistic baseline from expected goals.
    poisson_probs = _outcome_probs(home_xg, away_xg)
    poisson_map = {
        "HOME": poisson_probs["home"],
        "DRAW": poisson_probs["draw"],
        "AWAY": poisson_probs["away"],
    }

    # Empirical prior from historical outcomes.
    total_hist = max(1, len(outcome_labels))
    prior_map = {
        "HOME": outcome_labels.count("HOME") / total_hist,
        "DRAW": outcome_labels.count("DRAW") / total_hist,
        "AWAY": outcome_labels.count("AWAY") / total_hist,
    }

    # Reliability-driven blending: smaller leagues/history => stronger priors.
    reliability = min(1.0, len(train_features) / 220.0)
    w_knn = 0.50 * reliability
    w_poisson = 0.35
    w_prior = 1.0 - w_knn - w_poisson

    blended = {}
    for label in ("HOME", "DRAW", "AWAY"):
        blended[label] = (
            (knn_probs.get(label, 0.0) * w_knn)
            + (poisson_map[label] * w_poisson)
            + (prior_map[label] * w_prior)
        )

    total_blended = sum(blended.values())
    if total_blended <= 0:
        blended = {"HOME": 0.34, "DRAW": 0.28, "AWAY": 0.38}
        total_blended = 1.0

    normalized = {k: v / total_blended for k, v in blended.items()}

    # Prevent unrealistic certainty (no 100% guarantees).
    floor = 0.07
    ceiling = 0.86
    normalized = {k: _clamp(v, floor, ceiling) for k, v in normalized.items()}
    total_capped = sum(normalized.values())
    normalized = {k: v / total_capped for k, v in normalized.items()}

    probs = {
        "home": round(normalized["HOME"], 3),
        "draw": round(normalized["DRAW"], 3),
        "away": round(normalized["AWAY"], 3),
    }

    if probs["home"] >= probs["away"] and probs["home"] >= probs["draw"]:
        outcome = "HOME"
    elif probs["away"] >= probs["home"] and probs["away"] >= probs["draw"]:
        outcome = "AWAY"
    else:
        outcome = "DRAW"

    return {
        "outcome": outcome,
        "home_xg": round(home_xg, 2),
        "away_xg": round(away_xg, 2),
        "probs": probs,
        "form": {
            "home": _recent_team_form(fixtures, home.get("id"), limit=5),
            "away": _recent_team_form(fixtures, away.get("id"), limit=5),
        },
        "inputs": {
            "model": "knn_calibrated_outcome_and_goal_regression",
            "training_fixtures": len(train_features),
            "calibration": {
                "weights": {"knn": round(w_knn, 3), "poisson": round(w_poisson, 3), "prior": round(w_prior, 3)},
                "prob_floor": floor,
                "prob_ceiling": ceiling,
            },
        },
    }


def predict_player_points(player_id: int, gameweek: Optional[int] = None) -> Dict:
    bootstrap, _ = get_bootstrap()
    elements = bootstrap.get("elements", [])
    teams = bootstrap.get("teams", [])
    events = bootstrap.get("events", [])

    player = _find_player(elements, player_id)
    if not player:
        raise KeyError("player")

    if gameweek is None:
        gameweek = _get_next_gw(events)

    fixtures, _ = get_fixtures()
    fixture = _fixture_for_team(fixtures, player.get("team"), gameweek)
    venue = "H" if fixture and fixture.get("team_h") == player.get("team") else "A"

    opponent_team_id = None
    if fixture:
        opponent_team_id = fixture.get("team_a") if venue == "H" else fixture.get("team_h")

    opponent = _find_team(teams, opponent_team_id) if opponent_team_id else None

    history: List[Dict] = []
    summary_source = "element-summary"
    try:
        summary, _ = get_element_summary(player_id)
        history = summary.get("history", [])
    except KeyError:
        summary_source = "bootstrap-only"

    sorted_history = sorted(history, key=lambda x: x.get("round", 0))
    last_5 = sorted_history[-5:]
    last_15 = sorted_history[-15:]

    last5_points = [_safe_float(item.get("total_points", 0)) for item in last_5]
    last15_points = [_safe_float(item.get("total_points", 0)) for item in last_15]

    avg_5 = sum(last5_points) / len(last5_points) if last5_points else 0.0
    avg_15 = sum(last15_points) / len(last15_points) if last15_points else 0.0

    if not last5_points and not last15_points:
        avg_5 = _safe_float(player.get("points_per_game"), 0.0)
        avg_15 = avg_5
        summary_source = "bootstrap-only"

    train_features: List[List[float]] = []
    train_targets: List[float] = []
    for item in sorted_history:
        row, target = _build_player_training_row(item, teams)
        train_features.append(row)
        train_targets.append(target)

    query = _build_player_query_row(last_5 or last_15, opponent, venue, player)
    if train_features:
        predicted_raw = _knn_regression(train_features, train_targets, query, k=7)
    else:
        predicted_raw = (avg_5 * 0.7) + (avg_15 * 0.3)

    predicted = round(_clamp(predicted_raw, 0.0, 20.0) * 2) / 2

    if len(last5_points) > 1:
        mean = sum(last5_points) / len(last5_points)
        variance = sum((p - mean) ** 2 for p in last5_points) / len(last5_points)
        recent_std = math.sqrt(variance)
    else:
        recent_std = 5.0

    confidence_base = 0.25 if summary_source == "bootstrap-only" else 0.35
    confidence = _clamp(
        confidence_base + min(len(train_features) / 25.0, 0.35) - min(recent_std / 25.0, 0.15),
        0.25,
        0.9,
    )

    return {
        "player_id": player_id,
        "gameweek": gameweek,
        "predicted_points": predicted,
        "confidence": round(confidence, 2),
        "features_used": {
            "data_source": summary_source,
            "model": "knn_regression",
            "avg_last_5": round(avg_5, 2),
            "avg_last_15": round(avg_15, 2),
            "training_rows": len(train_features),
        },
    }


def predict_price_change(player_id: int) -> Dict:
    history = []
    data_source = "element-summary"
    try:
        summary, _ = get_element_summary(player_id)
        history = summary.get("history", [])
    except KeyError:
        data_source = "bootstrap-only"

    values = [_safe_float(item.get("value"), 0.0) for item in history if item.get("value") is not None]

    if len(values) < 6:
        return {
            "player_id": player_id,
            "direction": "STABLE",
            "probability": 0.4,
            "features_used": {
                "data_source": data_source,
                "model": "insufficient_data_fallback",
                "trend_slope": 0.0,
                "history_points": len(values),
            },
        }

    features, labels = _build_price_windows(values)
    latest_deltas = [
        values[-1] - values[-2],
        values[-2] - values[-3],
        values[-3] - values[-4],
    ]
    latest_mean = sum(latest_deltas) / 3.0
    latest_var = sum((d - latest_mean) ** 2 for d in latest_deltas) / 3.0
    query = [latest_deltas[0], latest_deltas[1], latest_deltas[2], latest_mean, math.sqrt(latest_var)]

    class_probs = _knn_classification(features, labels, query, k=7)
    if not class_probs:
        class_probs = {"STABLE": 0.6, "RISE": 0.2, "FALL": 0.2}

    direction = max(class_probs, key=class_probs.get)
    probability = _clamp(class_probs.get(direction, 0.4), 0.4, 0.9)
    slope = (values[-1] - values[-6]) / 5.0
    slope_m = slope / 10.0

    return {
        "player_id": player_id,
        "direction": direction,
        "probability": round(probability, 2),
        "features_used": {
            "data_source": data_source,
            "model": "knn_classification",
            "trend_slope": round(slope_m, 4),
            "history_points": len(values),
        },
    }


def predict_match(home_team_id: int, away_team_id: int) -> Dict:
    bootstrap, _ = get_bootstrap()
    teams = bootstrap.get("teams", [])
    fixtures, _ = get_fixtures()

    home = _find_team(teams, home_team_id)
    away = _find_team(teams, away_team_id)

    if not home or not away:
        raise KeyError("team")

    return _predict_match_ml(home, away, teams, fixtures)


def predict_upcoming_matches() -> Dict:
    bootstrap, _ = get_bootstrap()
    fixtures, _ = get_fixtures()

    teams = bootstrap.get("teams", [])
    events = bootstrap.get("events", [])
    next_gw = _get_next_gw(events) or 1

    upcoming = [f for f in fixtures if f.get("event") == next_gw]
    results = []
    for fixture in upcoming:
        home = _find_team(teams, fixture.get("team_h"))
        away = _find_team(teams, fixture.get("team_a"))
        if not home or not away:
            continue
        prediction = _predict_match_ml(home, away, teams, fixtures)
        results.append(
            {
                "fixture_id": fixture.get("id"),
                "event": fixture.get("event"),
                "kickoff_time": fixture.get("kickoff_time"),
                "home_team": {"id": home.get("id"), "name": home.get("name")},
                "away_team": {"id": away.get("id"), "name": away.get("name")},
                "prediction": prediction,
            }
        )

    return {"gameweek": next_gw, "fixtures": results}



def predict_captaincy_top_picks(limit: int = 10) -> Dict:
    bootstrap, _ = get_bootstrap()
    fixtures, _ = get_fixtures()

    elements = bootstrap.get("elements", [])
    teams = bootstrap.get("teams", [])
    events = bootstrap.get("events", [])
    teams_by_id = {t.get("id"): t for t in teams}

    target_gw = _get_first_future_gw(events) or _get_next_gw(events) or 1

    train_vectors: List[List[float]] = []
    train_targets: List[float] = []
    player_rows: List[Tuple[Dict, List[float], Optional[Dict], str]] = []

    for player in elements:
        team_id = _safe_int(player.get("team"), 0)
        fixture = _fixture_for_team(fixtures, team_id, target_gw)
        if not fixture:
            continue

        venue = "H" if fixture.get("team_h") == team_id else "A"
        opponent_id = fixture.get("team_a") if venue == "H" else fixture.get("team_h")
        opponent = teams_by_id.get(opponent_id)

        form = _safe_float(player.get("form"), 0.0)
        ppg = _safe_float(player.get("points_per_game"), 0.0)
        minutes = _safe_float(player.get("minutes"), 0.0)
        appearances = max(1.0, minutes / 90.0)
        total_points = _safe_float(player.get("total_points"), 0.0)
        ppm = total_points / appearances
        selected = _safe_float(player.get("selected_by_percent"), 0.0)
        ict = _safe_float(player.get("ict_index"), 0.0)
        bps = _safe_float(player.get("bps"), 0.0)
        opponent_def = _strength_defence(opponent or {}, "H" if venue == "A" else "A")

        row = [
            form,
            ppg,
            ppm,
            minutes,
            selected,
            ict,
            bps,
            1.0 if venue == "H" else 0.0,
            _safe_float(player.get("now_cost"), 0.0),
            _safe_float(player.get("goals_scored"), 0.0),
            _safe_float(player.get("assists"), 0.0),
            _safe_float(player.get("clean_sheets"), 0.0),
            float(opponent_def),
        ]
        # Pseudo-target: blend stable output with recent signal for ML ranking.
        target = (0.45 * ppg) + (0.35 * form) + (0.20 * ppm)

        train_vectors.append(row)
        train_targets.append(target)
        player_rows.append((player, row, opponent, venue))

    if not player_rows:
        return {"gameweek": target_gw, "model": "knn_captaincy_ranker", "picks": []}

    scored = []
    for idx, (player, row, opponent, venue) in enumerate(player_rows):
        pred = _knn_regression(train_vectors, train_targets, row, k=17, exclude_index=idx)
        pred = _clamp(pred, 0.0, 15.0)

        expected = pred
        if venue == "H":
            expected += 0.15
        if opponent:
            opp_strength = _safe_float(opponent.get("strength"), 3.0)
            expected += (3.0 - opp_strength) * 0.10

        scored.append(
            {
                "player_id": player.get("id"),
                "name": f"{player.get('first_name', '')} {player.get('second_name', '')}".strip() or player.get("web_name"),
                "team": teams_by_id.get(player.get("team"), {}).get("short_name") or teams_by_id.get(player.get("team"), {}).get("name"),
                "position": player.get("element_type"),
                "opponent": opponent.get("short_name") if opponent else None,
                "venue": venue,
                "predicted_points": round(expected, 2),
                "captaincy_score": round(expected * 2.0, 2),
                "model_confidence": round(_clamp(0.45 + min(_safe_float(player.get("minutes"), 0.0) / 3000.0, 0.35), 0.35, 0.85), 2),
            }
        )

    scored.sort(key=lambda x: x["captaincy_score"], reverse=True)

    top = scored[: max(1, min(limit, 20))]
    rank = 1
    for row in top:
        row["rank"] = rank
        rank += 1

    return {
        "gameweek": target_gw,
        "model": "knn_captaincy_ranker",
        "picks": top,
    }
def predict_fdr(team_id: int, horizon: int = 5) -> Dict:
    bootstrap, _ = get_bootstrap()
    fixtures, _ = get_fixtures()

    teams = bootstrap.get("teams", [])
    events = bootstrap.get("events", [])
    team = _find_team(teams, team_id)
    if not team:
        raise KeyError("team")

    # Exclude a gameweek once it has started (deadline passed).
    start_gw = _get_first_future_gw(events) or 1

    upcoming = [
        f for f in fixtures
        if f.get("event") is not None
        and f.get("event") >= start_gw
        and (f.get("team_h") == team_id or f.get("team_a") == team_id)
    ]
    upcoming.sort(key=lambda x: x.get("event", 999))

    results = []
    for fixture in upcoming[: max(1, horizon)]:
        venue = "H" if fixture.get("team_h") == team_id else "A"
        opponent_id = fixture.get("team_a") if venue == "H" else fixture.get("team_h")
        opponent = _find_team(teams, opponent_id)
        if not opponent:
            continue

        home_team = team if venue == "H" else opponent
        away_team = opponent if venue == "H" else team
        prediction = _predict_match_ml(home_team, away_team, teams, fixtures)

        win_prob = prediction["probs"]["home"] if venue == "H" else prediction["probs"]["away"]
        home_xg = _safe_float(prediction.get("home_xg"), 1.2)
        away_xg = _safe_float(prediction.get("away_xg"), 1.0)
        clean_sheet_prob = math.exp(-away_xg) if venue == "H" else math.exp(-home_xg)

        fdr_score = int(opponent.get("strength", 3))

        results.append(
            {
                "gw": fixture.get("event"),
                "opponent": opponent.get("name"),
                "venue": venue,
                "fdr_score": fdr_score,
                "win_prob": round(win_prob, 3),
                "clean_sheet_prob": round(clean_sheet_prob, 3),
            }
        )

    return {
        "team_id": team_id,
        "horizon": horizon,
        "fixtures": results,
    }




