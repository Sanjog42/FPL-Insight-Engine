import json
from hashlib import sha256

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrSuperAdmin, IsUserOrAbove

from .models import ModelTrainingJob, ModelVersion
from .serializers import (
    FDRQuerySerializer,
    FullTeamGenerateRequestSerializer,
    MatchRequestSerializer,
    ModelActionSerializer,
    ModelTrainingJobSerializer,
    ModelVersionSerializer,
    PlayerPointsRequestSerializer,
    PriceRequestSerializer,
    TransferSuggestRequestSerializer,
)
from .services.fpl_client import FPLServiceUnavailable, get_bootstrap, get_fixtures
from .services.model_runtime import (
    apply_model_to_captaincy,
    apply_model_to_match_prediction,
    apply_model_to_player_points,
    apply_model_to_price,
    get_active_model_version,
)
from .services.model_training import run_retrain_job
from .services.predictors import (
    _find_team,
    _get_next_gw,
    _predict_match_ml,
    predict_captaincy_top_picks,
    predict_fdr,
    predict_match,
    predict_player_points,
    predict_price_change,
    predict_upcoming_matches,
)
from .services.team_optimizer import generate_full_team, suggest_transfers


class FPLUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "FPL API unavailable and no cached data."


ML_RESPONSE_CACHE_TTL_SECONDS = 60 * 5


def _handle_fpl_error(exc: Exception):
    if isinstance(exc, FPLServiceUnavailable):
        raise FPLUnavailable() from exc
    raise exc


def _validate_model_type(model_type: str | None, allow_empty: bool = False):
    if allow_empty and not model_type:
        return None

    valid = {choice[0] for choice in ModelVersion.ModelType.choices}
    if model_type not in valid:
        raise ValidationError("Invalid model_type")
    return model_type


def _build_ml_cache_key(prefix: str, payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    digest = sha256(encoded.encode("utf-8")).hexdigest()
    return f"ml-response:{prefix}:{digest}"


class BootstrapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        force_refresh = request.query_params.get("force_refresh") == "1"
        try:
            data, cached = get_bootstrap(force_refresh=force_refresh)
        except Exception as exc:
            _handle_fpl_error(exc)
        return Response({"cached": cached, "data": data})


class FixturesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        force_refresh = request.query_params.get("force_refresh") == "1"
        gw_param = request.query_params.get("gw")
        gw = None
        if gw_param:
            try:
                gw = int(gw_param)
            except ValueError:
                return Response(
                    {"detail": "gw must be an integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        try:
            data, cached = get_fixtures(force_refresh=force_refresh)
        except Exception as exc:
            _handle_fpl_error(exc)
        if gw is not None:
            data = [f for f in data if f.get("event") == gw]
        return Response({"cached": cached, "data": data})


class PlayerPointsPredictView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = PlayerPointsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        version = get_active_model_version(ModelVersion.ModelType.PLAYER_POINTS)
        cache_key = _build_ml_cache_key(
            "player-points",
            {
                "payload": payload,
                "model_version": version.name if version else "base",
            },
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_player_points(
                payload["player_id"],
                payload.get("gameweek"),
            )
        except KeyError:
            raise NotFound("Unknown player_id")
        except Exception as exc:
            _handle_fpl_error(exc)
        result = apply_model_to_player_points(result, version)
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class PricePredictView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = PriceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        version = get_active_model_version(ModelVersion.ModelType.PRICE_CHANGE)
        cache_key = _build_ml_cache_key(
            "price",
            {
                "payload": payload,
                "model_version": version.name if version else "base",
            },
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_price_change(payload["player_id"])
        except KeyError:
            raise NotFound("Unknown player_id")
        except Exception as exc:
            _handle_fpl_error(exc)
        result = apply_model_to_price(result, version)
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class MatchPredictView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = MatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        version = get_active_model_version(ModelVersion.ModelType.MATCH_PREDICTION)
        cache_key = _build_ml_cache_key(
            "match",
            {
                "payload": payload,
                "model_version": version.name if version else "base",
            },
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_match(payload["home_team_id"], payload["away_team_id"])
        except KeyError:
            raise NotFound("Unknown team_id")
        except Exception as exc:
            _handle_fpl_error(exc)
        result = apply_model_to_match_prediction(result, version)
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class FDRView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def get(self, request):
        serializer = FDRQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        version = get_active_model_version(ModelVersion.ModelType.FDR)
        cache_key = _build_ml_cache_key(
            "fdr",
            {
                "payload": payload,
                "model_version": version.name if version else "base",
            },
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_fdr(payload["team_id"], payload.get("horizon", 5))
        except KeyError:
            raise NotFound("Unknown team_id")
        except Exception as exc:
            _handle_fpl_error(exc)

        result["model_version"] = version.name if version else "base"
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class UpcomingMatchPredictView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def get(self, request):
        version = get_active_model_version(ModelVersion.ModelType.MATCH_PREDICTION)
        cache_key = _build_ml_cache_key(
            "match-upcoming",
            {"model_version": version.name if version else "base"},
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_upcoming_matches()
        except Exception as exc:
            _handle_fpl_error(exc)

        for fixture in result.get("fixtures", []):
            fixture["prediction"] = apply_model_to_match_prediction(fixture.get("prediction") or {}, version)
        result["model_version"] = version.name if version else "base"
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class CaptaincyTopPicksView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def get(self, request):
        limit_param = request.query_params.get("limit")
        limit = 10
        if limit_param is not None:
            try:
                limit = int(limit_param)
            except ValueError:
                raise ValidationError("limit must be an integer")

        limit = max(1, min(limit, 20))
        version = get_active_model_version(ModelVersion.ModelType.CAPTAINCY)
        cache_key = _build_ml_cache_key(
            "captaincy",
            {
                "limit": limit,
                "model_version": version.name if version else "base",
            },
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            result = predict_captaincy_top_picks(limit=limit)
        except Exception as exc:
            _handle_fpl_error(exc)

        result = apply_model_to_captaincy(result, version)
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class TransferSuggestView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = TransferSuggestRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        version = get_active_model_version(ModelVersion.ModelType.TRANSFER_SUGGESTION)
        cache_key = _build_ml_cache_key(
            "transfers-suggest",
            {
                "payload": payload,
                "model_version": version.name if version else "base",
            },
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            result = suggest_transfers(
                team_slots=payload["team_slots"],
                remaining_budget=payload["remaining_budget"],
                free_transfers=payload.get("free_transfers", 1),
            )
        except ValueError as exc:
            raise ValidationError(str(exc))
        except KeyError:
            raise NotFound("Unknown player_id in team_slots")
        except Exception as exc:
            _handle_fpl_error(exc)

        result["model_version"] = version.name if version else "base"
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class FullTeamGenerateView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = FullTeamGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        version = get_active_model_version(ModelVersion.ModelType.TEAM_GENERATION)
        cache_key = _build_ml_cache_key(
            "team-generate",
            {
                "payload": payload,
                "model_version": version.name if version else "base",
            },
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            result = generate_full_team(budget=payload.get("budget", 100.0))
        except ValueError as exc:
            raise ValidationError(str(exc))
        except Exception as exc:
            _handle_fpl_error(exc)

        result["model_version"] = version.name if version else "base"
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class RetrainModelView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request):
        serializer = ModelActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        model_type = serializer.validated_data["model_type"]

        try:
            job, version = run_retrain_job(request.user, model_type)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            _handle_fpl_error(exc)

        return Response(
            {
                "message": "Retrain complete. Draft model created.",
                "job": ModelTrainingJobSerializer(job).data,
                "draft": ModelVersionSerializer(version).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ModelWorkflowView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        model_type = _validate_model_type(request.query_params.get("model_type"), allow_empty=True)

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
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request, id):
        try:
            draft = ModelVersion.objects.get(pk=id, status=ModelVersion.Status.DRAFT)
        except ModelVersion.DoesNotExist:
            return Response({"detail": "Draft not found"}, status=status.HTTP_404_NOT_FOUND)

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
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request, id):
        try:
            draft = ModelVersion.objects.get(pk=id, status=ModelVersion.Status.DRAFT)
        except ModelVersion.DoesNotExist:
            return Response({"detail": "Draft not found"}, status=status.HTTP_404_NOT_FOUND)

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

        return Response(
            {
                "message": "Draft published successfully",
                "active": ModelVersionSerializer(draft).data,
            }
        )


class RollbackModelView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request):
        serializer = ModelActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        model_type = serializer.validated_data["model_type"]

        current_active = get_active_model_version(model_type)
        if not current_active or current_active.model_type != model_type:
            return Response({"detail": "No active model to rollback for this module"}, status=status.HTTP_400_BAD_REQUEST)

        previous = (
            ModelVersion.objects.filter(status=ModelVersion.Status.PUBLISHED, model_type=model_type)
            .exclude(id=current_active.id)
            .order_by("-published_at", "-trained_at")
            .first()
        )
        if not previous:
            return Response({"detail": "No previous published model found"}, status=status.HTTP_400_BAD_REQUEST)

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
