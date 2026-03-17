import math
from typing import Dict, List, Optional, Tuple

from .fpl_client import get_bootstrap, get_element_summary, get_fixtures


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
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

    # Attack/defence ratios vs league averages (use fallback 1.0 if no data)
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

    # Blend ratios with neutral (1.0) based on sample size
    home_attack_ratio = _blend_ratio(home_attack_ratio, 1.0, home_weight)
    away_attack_ratio = _blend_ratio(away_attack_ratio, 1.0, away_weight)
    home_def_ratio = _blend_ratio(home_def_ratio, 1.0, home_weight)
    away_def_ratio = _blend_ratio(away_def_ratio, 1.0, away_weight)

    stat_home_xg = league_avg["home_gpg"] * home_attack_ratio * away_def_ratio
    stat_away_xg = league_avg["away_gpg"] * away_attack_ratio * home_def_ratio

    # Blend stat-based xG with strength-based xG for stability
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

    history = []
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

    predicted_raw = (avg_5 * 0.7) + (avg_15 * 0.3)
    predicted = round(predicted_raw * 2) / 2

    confidence_base = 0.25 if summary_source == "bootstrap-only" else 0.35
    confidence = _clamp(
        confidence_base + (len(last5_points) / 10.0),
        0.25,
        0.88,
    )

    return {
        "player_id": player_id,
        "gameweek": gameweek,
        "predicted_points": predicted,
        "confidence": round(confidence, 2),
        "features_used": {
            "data_source": summary_source,
            "avg_last_5": round(avg_5, 2),
            "avg_last_15": round(avg_15, 2),
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
    values = [item.get("value") for item in history if item.get("value") is not None]

    if len(values) < 2:
        return {
            "player_id": player_id,
            "direction": "STABLE",
            "probability": 0.4,
            "features_used": {
                "data_source": data_source,
                "trend_slope": 0.0,
                "history_points": len(values),
            },
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
            "data_source": data_source,
            "trend_slope": round(slope_m, 4),
            "history_points": len(recent),
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

    return _predict_match_stats(home, away, fixtures)


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
        prediction = _predict_match_stats(home, away, fixtures)
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
