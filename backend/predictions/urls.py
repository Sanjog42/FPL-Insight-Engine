from django.urls import path

from .views import (
    BootstrapView,
    CaptaincyTopPicksView,
    FDRView,
    FixturesView,
    FullTeamGenerateView,
    MatchPredictView,
    PlayerPointsPredictView,
    PricePredictView,
    TransferSuggestView,
    UpcomingMatchPredictView,
)

urlpatterns = [
    path("fpl/bootstrap/", BootstrapView.as_view(), name="fpl-bootstrap"),
    path("fpl/fixtures/", FixturesView.as_view(), name="fpl-fixtures"),
    path("predictions/player-points/", PlayerPointsPredictView.as_view(), name="predict-player-points"),
    path("predictions/price/", PricePredictView.as_view(), name="predict-price"),
    path("predictions/match/", MatchPredictView.as_view(), name="predict-match"),
    path("predictions/match-upcoming/", UpcomingMatchPredictView.as_view(), name="predict-match-upcoming"),
    path("predictions/fdr/", FDRView.as_view(), name="predict-fdr"),
    path("predictions/captaincy/", CaptaincyTopPicksView.as_view(), name="predict-captaincy"),
    path("predictions/transfers/suggest/", TransferSuggestView.as_view(), name="predict-transfers-suggest"),
    path("predictions/team/generate/", FullTeamGenerateView.as_view(), name="predict-team-generate"),
]

