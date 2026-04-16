from django.db import transaction
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.predictions.models import ModelTrainingJob, ModelVersion
from apps.predictions.serializers import ModelActionSerializer, ModelTrainingJobSerializer, ModelVersionSerializer
from apps.predictions.services.fpl_client import get_bootstrap, get_fixtures
from apps.predictions.services.model_runtime import apply_model_to_match_prediction, get_active_model_version
from apps.predictions.services.model_training import run_retrain_job
from apps.predictions.services.predictors import _find_team, _get_next_gw, _predict_match_ml
from apps.predictions.views.common import handle_fpl_error, validate_model_type
from apps.users.permissions import IsAdminOrSuperAdmin


class RetrainModelView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def post(self, request):
        serializer = ModelActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        model_type = serializer.validated_data["model_type"]

        try:
            job, version = run_retrain_job(request.user, model_type)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        except Exception as exc:
            handle_fpl_error(exc)

        return Response(
            {
                "message": "Retrain complete. Draft model created.",
                "job": ModelTrainingJobSerializer(job).data,
                "draft": ModelVersionSerializer(version).data,
            },
            status=201,
        )


class ModelWorkflowView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def get(self, request):
        model_type = validate_model_type(request.query_params.get("model_type"), allow_empty=True)

        drafts_qs = ModelVersion.objects.filter(status=ModelVersion.Status.DRAFT)
        published_qs = ModelVersion.objects.filter(status=ModelVersion.Status.PUBLISHED)
        jobs_qs = ModelTrainingJob.objects.select_related("model_version", "triggered_by")

        if model_type:
            drafts_qs = drafts_qs.filter(model_type=model_type)
            published_qs = published_qs.filter(model_type=model_type)
            jobs_qs = jobs_qs.filter(model_type=model_type)

        drafts = drafts_qs.order_by("-trained_at")[:10]
        published = published_qs.order_by("-published_at", "-trained_at")[:20]
        jobs = jobs_qs.order_by("-created_at")[:15]
        active = get_active_model_version(model_type)

        return Response(
            {
                "active": ModelVersionSerializer(active).data if active else None,
                "drafts": ModelVersionSerializer(drafts, many=True).data,
                "published": ModelVersionSerializer(published, many=True).data,
                "jobs": ModelTrainingJobSerializer(jobs, many=True).data,
            }
        )


class PreviewDraftView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def get(self, request, id):
        try:
            draft = ModelVersion.objects.get(pk=id, status=ModelVersion.Status.DRAFT)
        except ModelVersion.DoesNotExist:
            return Response({"detail": "Draft not found"}, status=404)

        active = get_active_model_version(draft.model_type)

        if draft.model_type not in (ModelVersion.ModelType.MATCH_PREDICTION, ModelVersion.ModelType.FDR):
            return Response(
                {
                    "draft": ModelVersionSerializer(draft).data,
                    "active": ModelVersionSerializer(active).data if active else None,
                    "comparison": [],
                    "summary": {
                        "module": draft.model_type,
                        "active_metrics": active.metrics if active else {},
                        "draft_metrics": draft.metrics,
                    },
                }
            )

        bootstrap, _ = get_bootstrap()
        fixtures, _ = get_fixtures()
        teams = bootstrap.get("teams", [])
        events = bootstrap.get("events", [])
        next_gw = _get_next_gw(events) or 1

        upcoming = [f for f in fixtures if f.get("event") == next_gw][:6]

        comparison = []
        for fixture in upcoming:
            home = _find_team(teams, fixture.get("team_h"))
            away = _find_team(teams, fixture.get("team_a"))
            if not home or not away:
                continue

            baseline = _predict_match_ml(home, away, teams, fixtures)
            current_pred = apply_model_to_match_prediction(dict(baseline), active)
            draft_pred = apply_model_to_match_prediction(dict(baseline), draft)

            comparison.append(
                {
                    "fixture_id": fixture.get("id"),
                    "home_team": home.get("name"),
                    "away_team": away.get("name"),
                    "current": current_pred,
                    "draft": draft_pred,
                }
            )

        return Response(
            {
                "draft": ModelVersionSerializer(draft).data,
                "active": ModelVersionSerializer(active).data if active else None,
                "gameweek": next_gw,
                "comparison": comparison,
            }
        )


class PublishDraftView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def post(self, request, id):
        try:
            draft = ModelVersion.objects.get(pk=id, status=ModelVersion.Status.DRAFT)
        except ModelVersion.DoesNotExist:
            return Response({"detail": "Draft not found"}, status=404)

        with transaction.atomic():
            ModelVersion.objects.filter(
                is_active=True,
                status=ModelVersion.Status.PUBLISHED,
                model_type=draft.model_type,
            ).update(is_active=False)
            draft.status = ModelVersion.Status.PUBLISHED
            draft.is_active = True
            draft.published_at = timezone.now()
            draft.save(update_fields=["status", "is_active", "published_at"])

        return Response({"message": "Draft published successfully", "active": ModelVersionSerializer(draft).data})


class RollbackModelView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def post(self, request):
        serializer = ModelActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        model_type = serializer.validated_data["model_type"]

        current_active = get_active_model_version(model_type)
        if not current_active or current_active.model_type != model_type:
            return Response({"detail": "No active model to rollback for this module"}, status=400)

        previous = (
            ModelVersion.objects.filter(status=ModelVersion.Status.PUBLISHED, model_type=model_type)
            .exclude(id=current_active.id)
            .order_by("-published_at", "-trained_at")
            .first()
        )
        if not previous:
            return Response({"detail": "No previous published model found"}, status=400)

        with transaction.atomic():
            current_active.is_active = False
            current_active.save(update_fields=["is_active"])

            previous.is_active = True
            previous.save(update_fields=["is_active"])

        return Response(
            {
                "message": "Rollback successful",
                "active": ModelVersionSerializer(previous).data,
                "rolled_back_from": ModelVersionSerializer(current_active).data,
            }
        )
