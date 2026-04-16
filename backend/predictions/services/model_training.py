from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from .fpl_client import get_bootstrap, get_fixtures
from ..models import ModelTrainingJob, ModelVersion


SUPPORTED_RETRAIN_MODULES = {
    ModelVersion.ModelType.PLAYER_POINTS,
    ModelVersion.ModelType.PRICE_CHANGE,
    ModelVersion.ModelType.MATCH_PREDICTION,
    ModelVersion.ModelType.FDR,
    ModelVersion.ModelType.CAPTAINCY,
    ModelVersion.ModelType.TRANSFER_SUGGESTION,
    ModelVersion.ModelType.TEAM_GENERATION,
}


def _safe_mean(values, fallback=0.0):
    if not values:
        return fallback
    return sum(values) / len(values)


def _compute_training_parameters(model_type: str):
    bootstrap, _ = get_bootstrap(force_refresh=True)
    fixtures, _ = get_fixtures(force_refresh=True)

    finished = [
        f
        for f in fixtures
        if f.get("team_h_score") is not None and f.get("team_a_score") is not None
    ]

    home_goals = [float(f.get("team_h_score", 0) or 0) for f in finished]
    away_goals = [float(f.get("team_a_score", 0) or 0) for f in finished]

    home_avg = _safe_mean(home_goals, 1.35)
    away_avg = _safe_mean(away_goals, 1.15)
    home_advantage = max(-0.3, min(0.3, (home_avg - away_avg) * 0.12))

    team_strengths = [float(t.get("strength", 3) or 3) for t in bootstrap.get("teams", [])]
    strength_avg = _safe_mean(team_strengths, 3.0)

    player_multiplier = max(0.9, min(1.1, 1.0 + ((strength_avg - 3.0) * 0.01)))
    confidence_multiplier = max(0.9, min(1.2, 0.95 + min(len(finished), 300) / 1200))
    draw_bias = max(-0.08, min(0.08, (away_avg - home_avg) * 0.02))

    if model_type == ModelVersion.ModelType.PLAYER_POINTS:
        params = {
            "player_points_multiplier": round(player_multiplier, 4),
            "confidence_multiplier": round(confidence_multiplier, 4),
        }
    elif model_type == ModelVersion.ModelType.PRICE_CHANGE:
        params = {
            "price_probability_multiplier": round(max(0.9, min(1.15, 1.0 + (home_avg - away_avg) * 0.015)), 4),
            "confidence_multiplier": round(confidence_multiplier, 4),
        }
    elif model_type in (ModelVersion.ModelType.MATCH_PREDICTION, ModelVersion.ModelType.FDR):
        params = {
            "home_xg_bias": round(home_advantage, 4),
            "away_xg_bias": round(-home_advantage * 0.6, 4),
            "draw_bias": round(draw_bias, 4),
            "confidence_multiplier": round(confidence_multiplier, 4),
        }
    elif model_type == ModelVersion.ModelType.CAPTAINCY:
        params = {
            "player_points_multiplier": round(min(1.15, player_multiplier + 0.02), 4),
            "confidence_multiplier": round(min(1.25, confidence_multiplier + 0.03), 4),
        }
    elif model_type in (ModelVersion.ModelType.TRANSFER_SUGGESTION, ModelVersion.ModelType.TEAM_GENERATION):
        params = {
            "player_points_multiplier": round(player_multiplier, 4),
            "price_probability_multiplier": round(max(0.9, min(1.1, 1.0 + draw_bias)), 4),
            "confidence_multiplier": round(confidence_multiplier, 4),
        }
    else:
        params = {
            "player_points_multiplier": round(player_multiplier, 4),
            "price_probability_multiplier": 1.0,
            "home_xg_bias": round(home_advantage, 4),
            "away_xg_bias": round(-home_advantage * 0.6, 4),
            "draw_bias": round(draw_bias, 4),
            "confidence_multiplier": round(confidence_multiplier, 4),
        }

    metrics = {
        "model_type": model_type,
        "training_fixture_count": len(finished),
        "home_goal_avg": round(home_avg, 4),
        "away_goal_avg": round(away_avg, 4),
        "teams_seen": len(bootstrap.get("teams", [])),
        "synthetic_quality_score": round(min(0.99, 0.65 + min(len(finished), 300) / 1000), 4),
    }

    return params, metrics


def run_retrain_job(triggered_by, model_type: str):
    if model_type not in SUPPORTED_RETRAIN_MODULES:
        raise ValueError("Unsupported model_type for retrain")

    cooldown_from = timezone.now() - timedelta(minutes=2)
    recent_running = ModelTrainingJob.objects.filter(
        model_type=model_type,
        status__in=[ModelTrainingJob.JobStatus.QUEUED, ModelTrainingJob.JobStatus.RUNNING],
        created_at__gte=cooldown_from,
    ).exists()
    if recent_running:
        raise ValueError("A retrain job is already running for this module. Please wait.")

    job = ModelTrainingJob.objects.create(
        status=ModelTrainingJob.JobStatus.QUEUED,
        model_type=model_type,
        triggered_by=triggered_by,
        log="Job queued",
    )

    try:
        job.status = ModelTrainingJob.JobStatus.RUNNING
        job.started_at = timezone.now()
        job.log = f"Fetching latest FPL snapshot and fitting parameters for {model_type}"
        job.save(update_fields=["status", "started_at", "log"])

        params, metrics = _compute_training_parameters(model_type)
        version_name = f"{model_type}-{timezone.now().strftime('%Y%m%d-%H%M%S')}"
        version = ModelVersion.objects.create(
            name=version_name,
            model_type=model_type,
            status=ModelVersion.Status.DRAFT,
            is_active=False,
            parameters=params,
            metrics=metrics,
            notes=f"Auto-generated draft for module: {model_type}",
            created_by=triggered_by,
        )

        job.status = ModelTrainingJob.JobStatus.SUCCESS
        job.model_version = version
        job.completed_at = timezone.now()
        job.log = "Training complete. Draft ready for preview/publish."
        job.save(update_fields=["status", "model_version", "completed_at", "log"])
        return job, version
    except Exception as exc:
        job.status = ModelTrainingJob.JobStatus.FAILED
        job.error_message = str(exc)
        job.completed_at = timezone.now()
        job.log = "Training failed"
        job.save(update_fields=["status", "error_message", "completed_at", "log"])
        raise
