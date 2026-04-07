from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BootstrapView,
    CaptaincyTopPicksView,
    FDRView,
    FixtureAdminViewSet,
    FixturesView,
    FullTeamGenerateView,
    MatchPredictView,
    ModelWorkflowView,
    PlayerAdminViewSet,
    PlayerPointsPredictView,
    PredictionAdminViewSet,
    PreviewDraftView,
    PricePredictView,
    PublishDraftView,
    RetrainModelView,
    RollbackModelView,
    RunMatchPredictionView,
    TeamAdminViewSet,
    TransferSuggestView,
    UpcomingMatchPredictView,
)

router = DefaultRouter()
router.register(r"admin/players", PlayerAdminViewSet, basename="admin-players")
router.register(r"admin/teams", TeamAdminViewSet, basename="admin-teams")
router.register(r"admin/fixtures", FixtureAdminViewSet, basename="admin-fixtures")
router.register(r"admin/predictions", PredictionAdminViewSet, basename="admin-predictions")

urlpatterns = [
    path("", include(router.urls)),
    path("admin/predictions/run/", RunMatchPredictionView.as_view(), name="admin-run-match-prediction"),
    path("admin/ml/workflow/", ModelWorkflowView.as_view(), name="admin-ml-workflow"),
    path("admin/ml/retrain/", RetrainModelView.as_view(), name="admin-ml-retrain"),
    path("admin/ml/preview/<int:id>/", PreviewDraftView.as_view(), name="admin-ml-preview"),
    path("admin/ml/publish/<int:id>/", PublishDraftView.as_view(), name="admin-ml-publish"),
    path("admin/ml/rollback/", RollbackModelView.as_view(), name="admin-ml-rollback"),
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
