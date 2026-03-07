from rest_framework import status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    FDRQuerySerializer,
    MatchRequestSerializer,
    PlayerPointsRequestSerializer,
    PriceRequestSerializer,
)
from .services.fpl_client import FPLServiceUnavailable, get_bootstrap, get_fixtures
from .services.predictors import (
    predict_fdr,
    predict_match,
    predict_player_points,
    predict_price_change,
)


class FPLUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "FPL API unavailable and no cached data."


def _handle_fpl_error(exc: Exception):
    if isinstance(exc, FPLServiceUnavailable):
        raise FPLUnavailable() from exc
    raise exc


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
    permission_classes = [IsAuthenticated]

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
        return Response(result)


class PricePredictView(APIView):
    permission_classes = [IsAuthenticated]

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
        return Response(result)


class MatchPredictView(APIView):
    permission_classes = [IsAuthenticated]

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
        return Response(result)


class FDRView(APIView):
    permission_classes = [IsAuthenticated]

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
        return Response(result)
