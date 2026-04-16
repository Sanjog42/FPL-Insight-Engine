from django.core.cache import cache
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.predictions.models import ModelVersion
from apps.predictions.serializers import (
    FDRQuerySerializer,
    FullTeamGenerateRequestSerializer,
    MatchRequestSerializer,
    PlayerPointsRequestSerializer,
    PriceRequestSerializer,
    TransferSuggestRequestSerializer,
)
from apps.predictions.services.model_runtime import (
    apply_model_to_captaincy,
    apply_model_to_match_prediction,
    apply_model_to_player_points,
    apply_model_to_price,
    get_active_model_version,
)
from apps.predictions.services.predictors import (
    predict_captaincy_top_picks,
    predict_fdr,
    predict_match,
    predict_player_points,
    predict_price_change,
    predict_upcoming_matches,
)
from apps.predictions.services.team_optimizer import generate_full_team, suggest_transfers
from apps.predictions.views.common import ML_RESPONSE_CACHE_TTL_SECONDS, build_ml_cache_key, handle_fpl_error
from apps.users.permissions import IsUserOrAbove


class BootstrapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        force_refresh = request.query_params.get("force_refresh") == "1"
        try:
            from apps.predictions.services.fpl_client import get_bootstrap

            data, cached = get_bootstrap(force_refresh=force_refresh)
        except Exception as exc:
            handle_fpl_error(exc)
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
                return Response({"detail": "gw must be an integer"}, status=400)
        try:
            from apps.predictions.services.fpl_client import get_fixtures

            data, cached = get_fixtures(force_refresh=force_refresh)
        except Exception as exc:
            handle_fpl_error(exc)
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
        cache_key = build_ml_cache_key("player-points", {"payload": payload, "model_version": version.name if version else "base"})
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_player_points(payload["player_id"], payload.get("gameweek"))
        except KeyError:
            raise NotFound("Unknown player_id")
        except Exception as exc:
            handle_fpl_error(exc)
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
        cache_key = build_ml_cache_key("price", {"payload": payload, "model_version": version.name if version else "base"})
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_price_change(payload["player_id"])
        except KeyError:
            raise NotFound("Unknown player_id")
        except Exception as exc:
            handle_fpl_error(exc)
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
        cache_key = build_ml_cache_key("match", {"payload": payload, "model_version": version.name if version else "base"})
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_match(payload["home_team_id"], payload["away_team_id"])
        except KeyError:
            raise NotFound("Unknown team_id")
        except Exception as exc:
            handle_fpl_error(exc)
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
        cache_key = build_ml_cache_key("fdr", {"payload": payload, "model_version": version.name if version else "base"})
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_fdr(payload["team_id"], payload.get("horizon", 5))
        except KeyError:
            raise NotFound("Unknown team_id")
        except Exception as exc:
            handle_fpl_error(exc)

        result["model_version"] = version.name if version else "base"
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)


class UpcomingMatchPredictView(APIView):
    permission_classes = [IsAuthenticated, IsUserOrAbove]

    def get(self, request):
        version = get_active_model_version(ModelVersion.ModelType.MATCH_PREDICTION)
        cache_key = build_ml_cache_key("match-upcoming", {"model_version": version.name if version else "base"})
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        try:
            result = predict_upcoming_matches()
        except Exception as exc:
            handle_fpl_error(exc)

        gameweek = result.get("gameweek")
        fixtures = result.get("fixtures", [])
        if gameweek is not None:
            fixtures = [f for f in fixtures if f.get("event") == gameweek]

        for fixture in fixtures:
            fixture["prediction"] = apply_model_to_match_prediction(fixture.get("prediction") or {}, version)
        result["fixtures"] = fixtures
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
        cache_key = build_ml_cache_key("captaincy", {"limit": limit, "model_version": version.name if version else "base"})
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            result = predict_captaincy_top_picks(limit=limit)
        except Exception as exc:
            handle_fpl_error(exc)

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
        cache_key = build_ml_cache_key("transfers-suggest", {"payload": payload, "model_version": version.name if version else "base"})
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
            handle_fpl_error(exc)

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
        cache_key = build_ml_cache_key("team-generate", {"payload": payload, "model_version": version.name if version else "base"})
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            result = generate_full_team(budget=payload.get("budget", 100.0))
        except ValueError as exc:
            raise ValidationError(str(exc))
        except Exception as exc:
            handle_fpl_error(exc)

        result["model_version"] = version.name if version else "base"
        cache.set(cache_key, result, ML_RESPONSE_CACHE_TTL_SECONDS)
        return Response(result)
