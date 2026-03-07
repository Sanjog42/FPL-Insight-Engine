from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from .services.fpl_client import get_bootstrap


class FPLCacheTests(APITestCase):
    def setUp(self):
        cache.clear()

    @patch("predictions.services.fpl_client._fetch_json")
    def test_bootstrap_cached(self, mock_fetch):
        mock_fetch.return_value = {"elements": [], "teams": [], "events": []}
        data1, cached1 = get_bootstrap()
        data2, cached2 = get_bootstrap()

        self.assertEqual(data1, data2)
        self.assertFalse(cached1)
        self.assertTrue(cached2)
        self.assertEqual(mock_fetch.call_count, 1)


class PredictionEndpointTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="tester",
            password="pass1234",
            email="tester@example.com",
        )
        self.client.force_authenticate(self.user)

    @patch("predictions.services.fpl_client.get_bootstrap")
    @patch("predictions.services.fpl_client.get_fixtures")
    @patch("predictions.services.fpl_client.get_element_summary")
    def test_player_points_success(self, mock_summary, mock_fixtures, mock_bootstrap):
        mock_bootstrap.return_value = (
            {
                "elements": [
                    {
                        "id": 1,
                        "first_name": "Test",
                        "second_name": "Player",
                        "team": 1,
                        "element_type": 1,
                    }
                ],
                "teams": [
                    {
                        "id": 1,
                        "name": "Alpha",
                        "strength": 3,
                        "strength_attack_home": 3,
                        "strength_defence_home": 3,
                        "strength_attack_away": 3,
                        "strength_defence_away": 3,
                    },
                    {
                        "id": 2,
                        "name": "Beta",
                        "strength": 3,
                        "strength_attack_home": 3,
                        "strength_defence_home": 3,
                        "strength_attack_away": 3,
                        "strength_defence_away": 3,
                    },
                ],
                "events": [{"id": 1, "is_next": True, "is_current": False}],
            },
            False,
        )
        mock_fixtures.return_value = (
            [
                {"event": 1, "team_h": 1, "team_a": 2},
            ],
            False,
        )
        mock_summary.return_value = (
            {
                "history": [
                    {"round": 1, "total_points": 6, "minutes": 90, "value": 75},
                    {"round": 2, "total_points": 2, "minutes": 80, "value": 75},
                    {"round": 3, "total_points": 8, "minutes": 90, "value": 76},
                ]
            },
            False,
        )

        res = self.client.post(
            "/api/predictions/player-points/",
            {"player_id": 1},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        self.assertIn("predicted_points", res.data)
        self.assertIn("confidence", res.data)

    def test_player_points_invalid(self):
        res = self.client.post("/api/predictions/player-points/", {}, format="json")
        self.assertEqual(res.status_code, 400)
