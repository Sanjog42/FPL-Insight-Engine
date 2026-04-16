from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrSuperAdmin, IsUserOrAbove

from .models import Fixture, ModelTrainingJob, ModelVersion, Player, PredictionRecord, Team
from .serializers import (
    FDRQuerySerializer,
    FixtureSerializer,
    FullTeamGenerateRequestSerializer,
    MatchRequestSerializer,
    ModelActionSerializer,
    ModelTrainingJobSerializer,
    ModelVersionSerializer,
    PlayerPointsRequestSerializer,
    PlayerSerializer,
    PredictionRecordSerializer,
    PriceRequestSerializer,
    TeamSerializer,
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
        try:
            result = predict_player_points(
                payload["player_id"],
                payload.get("gameweek"),
            )
        except KeyError:
            raise NotFound("Unknown player_id")
        except Exception as exc:
            _handle_fpl_error(exc)
        version = get_active_model_version(ModelVersion.ModelType.PLAYER_POINTS)
        result = apply_model_to_player_points(result, version)
        return Response(result)


class PricePredictView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = PriceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        try:
            result = predict_price_change(payload["player_id"])
        except KeyError:
            raise NotFound("Unknown player_id")
        except Exception as exc:
            _handle_fpl_error(exc)
        version = get_active_model_version(ModelVersion.ModelType.PRICE_CHANGE)
        result = apply_model_to_price(result, version)
        return Response(result)


class MatchPredictView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = MatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        try:
            result = predict_match(payload["home_team_id"], payload["away_team_id"])
        except KeyError:
            raise NotFound("Unknown team_id")
        except Exception as exc:
            _handle_fpl_error(exc)
        version = get_active_model_version(ModelVersion.ModelType.MATCH_PREDICTION)
        result = apply_model_to_match_prediction(result, version)
        return Response(result)


class FDRView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def get(self, request):
        serializer = FDRQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        try:
            result = predict_fdr(payload["team_id"], payload.get("horizon", 5))
        except KeyError:
            raise NotFound("Unknown team_id")
        except Exception as exc:
            _handle_fpl_error(exc)

        version = get_active_model_version(ModelVersion.ModelType.FDR)
        result["model_version"] = version.name if version else "base"
        return Response(result)


class UpcomingMatchPredictView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def get(self, request):
        try:
            result = predict_upcoming_matches()
        except Exception as exc:
            _handle_fpl_error(exc)

        version = get_active_model_version(ModelVersion.ModelType.MATCH_PREDICTION)
        for fixture in result.get("fixtures", []):
            fixture["prediction"] = apply_model_to_match_prediction(fixture.get("prediction") or {}, version)
        result["model_version"] = version.name if version else "base"
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

        try:
            result = predict_captaincy_top_picks(limit=limit)
        except Exception as exc:
            _handle_fpl_error(exc)

        version = get_active_model_version(ModelVersion.ModelType.CAPTAINCY)
        result = apply_model_to_captaincy(result, version)
        return Response(result)


class TransferSuggestView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = TransferSuggestRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

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

        version = get_active_model_version(ModelVersion.ModelType.TRANSFER_SUGGESTION)
        result["model_version"] = version.name if version else "base"
        return Response(result)


class FullTeamGenerateView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def post(self, request):
        serializer = FullTeamGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        try:
            result = generate_full_team(budget=payload.get("budget", 100.0))
        except ValueError as exc:
            raise ValidationError(str(exc))
        except Exception as exc:
            _handle_fpl_error(exc)

        version = get_active_model_version(ModelVersion.ModelType.TEAM_GENERATION)
        result["model_version"] = version.name if version else "base"
        return Response(result)


class TeamAdminViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all().order_by("name")
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]


class PlayerAdminViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.select_related("team").all().order_by("name")
    serializer_class = PlayerSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]


class FixtureAdminViewSet(viewsets.ModelViewSet):
    queryset = Fixture.objects.select_related("home_team", "away_team").all().order_by("-kickoff_at")
    serializer_class = FixtureSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]


class PredictionAdminViewSet(viewsets.ModelViewSet):
    queryset = PredictionRecord.objects.select_related(
        "fixture",
        "fixture__home_team",
        "fixture__away_team",
        "created_by",
    ).all()
    serializer_class = PredictionRecordSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


def _compute_prediction(home_team: Team, away_team: Team):
    home_score = max(0.2, (home_team.attack_strength + away_team.defense_strength * 0.4) / 60)
    away_score = max(0.2, (away_team.attack_strength + home_team.defense_strength * 0.4) / 65)

    if home_score > away_score + 0.3:
        outcome = "Home"
    elif away_score > home_score + 0.3:
        outcome = "Away"
    else:
        outcome = "Draw"

    confidence = min(0.95, 0.5 + abs(home_score - away_score) / 4)
    return {
        "predicted_home_goals": round(home_score, 2),
        "predicted_away_goals": round(away_score, 2),
        "outcome": outcome,
        "confidence": round(confidence * 100, 2),
    }


class RunMatchPredictionView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request):
        fixture_id = request.data.get("fixture_id")
        if not fixture_id:
            return Response(
                {"detail": "fixture_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            fixture = Fixture.objects.select_related("home_team", "away_team").get(pk=fixture_id)
        except Fixture.DoesNotExist:
            return Response(
                {"detail": "Fixture not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        prediction_data = _compute_prediction(fixture.home_team, fixture.away_team)
        record = PredictionRecord.objects.create(
            fixture=fixture,
            predicted_home_goals=Decimal(str(prediction_data["predicted_home_goals"])),
            predicted_away_goals=Decimal(str(prediction_data["predicted_away_goals"])),
            outcome=prediction_data["outcome"],
            confidence=Decimal(str(prediction_data["confidence"])),
            created_by=request.user,
        )

        return Response(PredictionRecordSerializer(record).data, status=status.HTTP_201_CREATED)


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
