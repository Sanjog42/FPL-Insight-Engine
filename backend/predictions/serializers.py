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
