from rest_framework import serializers

from .models import Fixture, ModelTrainingJob, ModelVersion, Player, PredictionRecord, Team


class PlayerPointsRequestSerializer(serializers.Serializer):
    player_id = serializers.IntegerField(min_value=1)
    gameweek = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class PriceRequestSerializer(serializers.Serializer):
    player_id = serializers.IntegerField(min_value=1)


class MatchRequestSerializer(serializers.Serializer):
    home_team_id = serializers.IntegerField(min_value=1)
    away_team_id = serializers.IntegerField(min_value=1)
    gw = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class FDRQuerySerializer(serializers.Serializer):
    team_id = serializers.IntegerField(min_value=1)
    horizon = serializers.IntegerField(min_value=1, max_value=10, required=False, default=5)


class TeamSlotSerializer(serializers.Serializer):
    slot_id = serializers.CharField(required=False, allow_blank=True)
    position = serializers.ChoiceField(choices=["GK", "DEF", "MID", "FWD"])
    player_id = serializers.IntegerField(min_value=1)


class TransferSuggestRequestSerializer(serializers.Serializer):
    team_slots = TeamSlotSerializer(many=True, min_length=15, max_length=15)
    remaining_budget = serializers.FloatField(min_value=0)
    free_transfers = serializers.IntegerField(min_value=1, max_value=5, required=False, default=1)


class FullTeamGenerateRequestSerializer(serializers.Serializer):
    budget = serializers.FloatField(min_value=80.0, max_value=130.0, required=False, default=100.0)


class ModelActionSerializer(serializers.Serializer):
    model_type = serializers.ChoiceField(choices=ModelVersion.ModelType.choices)


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "short_name",
            "attack_strength",
            "defense_strength",
            "created_at",
        ]


class PlayerSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)

    class Meta:
        model = Player
        fields = [
            "id",
            "name",
            "team",
            "team_name",
            "position",
            "price",
            "created_at",
        ]


class FixtureSerializer(serializers.ModelSerializer):
    home_team_name = serializers.CharField(source="home_team.name", read_only=True)
    away_team_name = serializers.CharField(source="away_team.name", read_only=True)

    class Meta:
        model = Fixture
        fields = [
            "id",
            "gameweek",
            "kickoff_at",
            "home_team",
            "home_team_name",
            "away_team",
            "away_team_name",
            "is_finished",
            "created_at",
        ]

    def validate(self, attrs):
        home_team = attrs.get("home_team") or getattr(self.instance, "home_team", None)
        away_team = attrs.get("away_team") or getattr(self.instance, "away_team", None)
        if home_team and away_team and home_team.id == away_team.id:
            raise serializers.ValidationError("Home and away teams must be different")
        return attrs


class PredictionRecordSerializer(serializers.ModelSerializer):
    fixture_label = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = PredictionRecord
        fields = [
            "id",
            "fixture",
            "fixture_label",
            "predicted_home_goals",
            "predicted_away_goals",
            "outcome",
            "confidence",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = ["created_by"]

    def get_fixture_label(self, obj):
        return str(obj.fixture)


class ModelVersionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = ModelVersion
        fields = [
            "id",
            "name",
            "model_type",
            "status",
            "is_active",
            "parameters",
            "metrics",
            "notes",
            "trained_at",
            "published_at",
            "created_by",
            "created_by_username",
        ]


class ModelTrainingJobSerializer(serializers.ModelSerializer):
    triggered_by_username = serializers.CharField(source="triggered_by.username", read_only=True)
    model_version_name = serializers.CharField(source="model_version.name", read_only=True)

    class Meta:
        model = ModelTrainingJob
        fields = [
            "id",
            "status",
            "model_type",
            "triggered_by",
            "triggered_by_username",
            "model_version",
            "model_version_name",
            "log",
            "error_message",
            "created_at",
            "started_at",
            "completed_at",
        ]
