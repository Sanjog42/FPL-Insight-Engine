from rest_framework import serializers


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
