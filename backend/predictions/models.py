from django.conf import settings
from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100, unique=True)
    short_name = models.CharField(max_length=10, blank=True)
    attack_strength = models.PositiveIntegerField(default=50)
    defense_strength = models.PositiveIntegerField(default=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Player(models.Model):
    class Positions(models.TextChoices):
        GK = "GK", "GK"
        DEF = "DEF", "DEF"
        MID = "MID", "MID"
        FWD = "FWD", "FWD"

    name = models.CharField(max_length=120)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="players")
    position = models.CharField(max_length=3, choices=Positions.choices)
    price = models.DecimalField(max_digits=5, decimal_places=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Fixture(models.Model):
    gameweek = models.PositiveIntegerField()
    kickoff_at = models.DateTimeField()
    home_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="home_fixtures")
    away_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="away_fixtures")
    is_finished = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-kickoff_at"]

    def __str__(self):
        return f"GW{self.gameweek}: {self.home_team} vs {self.away_team}"


class PredictionRecord(models.Model):
    fixture = models.ForeignKey(Fixture, on_delete=models.CASCADE, related_name="predictions")
    predicted_home_goals = models.DecimalField(max_digits=4, decimal_places=2)
    predicted_away_goals = models.DecimalField(max_digits=4, decimal_places=2)
    outcome = models.CharField(max_length=10)
    confidence = models.DecimalField(max_digits=5, decimal_places=2)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prediction_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.fixture} -> {self.outcome}"


class ModelVersion(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    name = models.CharField(max_length=120, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    is_active = models.BooleanField(default=False)
    parameters = models.JSONField(default=dict, blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    trained_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="model_versions",
    )

    class Meta:
        ordering = ["-trained_at"]

    def __str__(self):
        return f"{self.name} [{self.status}]"


class ModelTrainingJob(models.Model):
    class JobStatus(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    status = models.CharField(max_length=20, choices=JobStatus.choices, default=JobStatus.QUEUED)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="training_jobs",
    )
    model_version = models.ForeignKey(
        ModelVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
    )
    log = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Job#{self.id} {self.status}"
