from django.urls import path

from .views import (
    BootstrapView,
    FDRView,
    FixturesView,
    MatchPredictView,
    PlayerPointsPredictView,
    PricePredictView,
)

urlpatterns = [
    path("fpl/bootstrap/", BootstrapView.as_view(), name="fpl-bootstrap"),
    path("fpl/fixtures/", FixturesView.as_view(), name="fpl-fixtures"),
    path("predictions/player-points/", PlayerPointsPredictView.as_view(), name="predict-player-points"),
    path("predictions/price/", PricePredictView.as_view(), name="predict-price"),
    path("predictions/match/", MatchPredictView.as_view(), name="predict-match"),
    path("predictions/fdr/", FDRView.as_view(), name="predict-fdr"),
]
