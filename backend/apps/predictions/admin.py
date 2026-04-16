from django.contrib import admin

from .models import Fixture, ModelTrainingJob, ModelVersion, Player, PredictionRecord, Team


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "short_name", "attack_strength", "defense_strength")
    search_fields = ("name", "short_name")


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "team", "position", "price")
    list_filter = ("position", "team")
    search_fields = ("name",)


@admin.register(Fixture)
class FixtureAdmin(admin.ModelAdmin):
    list_display = ("id", "gameweek", "home_team", "away_team", "kickoff_at", "is_finished")
    list_filter = ("gameweek", "is_finished")


@admin.register(PredictionRecord)
class PredictionRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "fixture", "outcome", "confidence", "created_by", "created_at")
    list_filter = ("outcome",)


@admin.register(ModelVersion)
class ModelVersionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "status", "is_active", "published_at", "trained_at", "created_by")
    list_filter = ("status", "is_active")
    search_fields = ("name",)


@admin.register(ModelTrainingJob)
class ModelTrainingJobAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "triggered_by", "model_version", "created_at", "completed_at")
    list_filter = ("status",)
