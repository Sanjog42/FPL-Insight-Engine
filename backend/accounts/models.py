from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class Roles(models.TextChoices):
        USER = "User", "User"
        ADMIN = "Admin", "Admin"
        SUPERADMIN = "SuperAdmin", "SuperAdmin"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.USER,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"
