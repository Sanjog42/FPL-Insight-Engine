import math
from typing import Dict, List, Optional, Tuple

from .fpl_client import get_bootstrap, get_element_summary, get_fixtures


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def _get_next_gw(events: List[Dict]) -> Optional[int]:
    for event in events:
        if event.get("is_next"):
            return event.get("id")
    current = next((e for e in events if e.get("is_current")), None)
    if current:
        return current.get("id", 0) + 1
    return None


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
    opp_def = _strength_defence(opponent, "H" if venue == "A" else "A") if opponent else 3

    summary, _ = get_element_summary(player_id)
    history = summary.get("history", [])
    recent = sorted(history, key=lambda x: x.get("round", 0))[-5:]

    recent_points = [float(item.get("total_points", 0)) for item in recent]
    recent_minutes = [float(item.get("minutes", 0)) for item in recent]

    avg_points = _weighted_average(recent_points)
    avg_minutes = sum(recent_minutes) / len(recent_minutes) if recent_minutes else 0.0
    minutes_factor = _clamp(avg_minutes / 90.0, 0.1, 1.0)

    fdr_modifier = (3 - opp_def) * 0.08
    predicted = max(0.0, avg_points * minutes_factor * (1 + fdr_modifier))

    confidence = _clamp(0.35 + (len(recent_points) / 10.0) + minutes_factor * 0.2, 0.35, 0.88)

    return {
        "player_id": player_id,
        "gameweek": gameweek,
        "predicted_points": round(predicted, 2),
        "confidence": round(confidence, 2),
        "features_used": {
            "recent_points": recent_points,
            "avg_minutes": round(avg_minutes, 1),
            "opponent_defence_strength": opp_def,
            "venue": venue,
        },
    }


def predict_price_change(player_id: int) -> Dict:
    summary, _ = get_element_summary(player_id)
    history = summary.get("history", [])
    values = [item.get("value") for item in history if item.get("value") is not None]

    if len(values) < 2:
        return {
            "player_id": player_id,
            "direction": "STABLE",
            "probability": 0.4,
            "features_used": {"trend_slope": 0.0, "history_points": len(values)},
        }

    recent = values[-6:]
    slope = (recent[-1] - recent[0]) / max(1, len(recent) - 1)
    slope_m = slope / 10.0

    if slope_m > 0.03:
        direction = "RISE"
    elif slope_m < -0.03:
        direction = "FALL"
    else:
        direction = "STABLE"

    probability = _clamp(0.5 + abs(slope_m) * 4.5, 0.4, 0.85)

    return {
        "player_id": player_id,
        "direction": direction,
        "probability": round(probability, 2),
        "features_used": {
            "trend_slope": round(slope_m, 4),
            "history_points": len(recent),
        },
    }


def predict_match(home_team_id: int, away_team_id: int) -> Dict:
    bootstrap, _ = get_bootstrap()
    teams = bootstrap.get("teams", [])

    home = _find_team(teams, home_team_id)
    away = _find_team(teams, away_team_id)

    if not home or not away:
        raise KeyError("team")

    home_xg, away_xg = _expected_goals(home, away)
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
    }


def predict_fdr(team_id: int, horizon: int = 5) -> Dict:
    bootstrap, _ = get_bootstrap()
    fixtures, _ = get_fixtures()

    teams = bootstrap.get("teams", [])
    events = bootstrap.get("events", [])
    team = _find_team(teams, team_id)
    if not team:
        raise KeyError("team")

    start_gw = _get_next_gw(events) or 1

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
        home_xg, away_xg = _expected_goals(home_team, away_team)
        probs = _outcome_probs(home_xg, away_xg)

        win_prob = probs["home"] if venue == "H" else probs["away"]
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
