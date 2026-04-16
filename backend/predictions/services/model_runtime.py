from __future__ import annotations

from typing import Any, Dict

from ..models import ModelVersion


DEFAULT_PARAMS = {
    "player_points_multiplier": 1.0,
    "price_probability_multiplier": 1.0,
    "home_xg_bias": 0.0,
    "away_xg_bias": 0.0,
    "draw_bias": 0.0,
    "confidence_multiplier": 1.0,
}


def get_active_model_version(model_type: str | None = None):
    queryset = ModelVersion.objects.filter(is_active=True, status=ModelVersion.Status.PUBLISHED)
    if model_type:
        typed = queryset.filter(model_type=model_type).first()
        if typed:
            return typed
        if model_type != ModelVersion.ModelType.GENERAL:
            return queryset.filter(model_type=ModelVersion.ModelType.GENERAL).first()
    return queryset.first()


def get_params(version: ModelVersion | None = None) -> Dict[str, float]:
    params = dict(DEFAULT_PARAMS)
    if version and isinstance(version.parameters, dict):
        for key, value in version.parameters.items():
            try:
                params[key] = float(value)
            except (TypeError, ValueError):
                continue
    return params


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def apply_model_to_player_points(payload: Dict[str, Any], version: ModelVersion | None) -> Dict[str, Any]:
    params = get_params(version)
    out = dict(payload)
    out["predicted_points"] = round(_clamp(float(out.get("predicted_points", 0.0)) * params["player_points_multiplier"], 0.0, 25.0), 2)
    out["confidence"] = round(_clamp(float(out.get("confidence", 0.5)) * params["confidence_multiplier"], 0.1, 0.99), 2)
    out["model_version"] = version.name if version else "base"
    return out


def apply_model_to_price(payload: Dict[str, Any], version: ModelVersion | None) -> Dict[str, Any]:
    params = get_params(version)
    out = dict(payload)
    out["probability"] = round(_clamp(float(out.get("probability", 0.5)) * params["price_probability_multiplier"], 0.1, 0.99), 2)
    out["model_version"] = version.name if version else "base"
    return out


def apply_model_to_match_prediction(payload: Dict[str, Any], version: ModelVersion | None) -> Dict[str, Any]:
    params = get_params(version)
    out = dict(payload)

    home_xg = _clamp(float(out.get("home_xg", 1.0)) + params["home_xg_bias"], 0.2, 4.0)
    away_xg = _clamp(float(out.get("away_xg", 1.0)) + params["away_xg_bias"], 0.2, 4.0)
    out["home_xg"] = round(home_xg, 2)
    out["away_xg"] = round(away_xg, 2)

    probs = dict(out.get("probs") or {})
    home_p = float(probs.get("home", 0.33))
    draw_p = float(probs.get("draw", 0.34)) + params["draw_bias"]
    away_p = float(probs.get("away", 0.33))

    home_p = _clamp(home_p, 0.05, 0.9)
    draw_p = _clamp(draw_p, 0.05, 0.9)
    away_p = _clamp(away_p, 0.05, 0.9)
    total = home_p + draw_p + away_p
    home_p, draw_p, away_p = home_p / total, draw_p / total, away_p / total

    out["probs"] = {
        "home": round(home_p, 3),
        "draw": round(draw_p, 3),
        "away": round(away_p, 3),
    }

    if home_p >= away_p and home_p >= draw_p:
        out["outcome"] = "HOME"
    elif away_p >= home_p and away_p >= draw_p:
        out["outcome"] = "AWAY"
    else:
        out["outcome"] = "DRAW"

    out["model_version"] = version.name if version else "base"
    return out


def apply_model_to_captaincy(payload: Dict[str, Any], version: ModelVersion | None) -> Dict[str, Any]:
    params = get_params(version)
    out = dict(payload)
    picks = []
    for row in out.get("picks", []):
        new_row = dict(row)
        points = _clamp(float(new_row.get("predicted_points", 0.0)) * params["player_points_multiplier"], 0.0, 25.0)
        new_row["predicted_points"] = round(points, 2)
        new_row["captaincy_score"] = round(points * 2.0, 2)
        picks.append(new_row)

    picks.sort(key=lambda x: x.get("captaincy_score", 0.0), reverse=True)
    for idx, row in enumerate(picks, start=1):
        row["rank"] = idx

    out["picks"] = picks
    out["model_version"] = version.name if version else "base"
    return out
