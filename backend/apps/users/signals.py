from django.db.models.signals import post_migrate, post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from .models import UserProfile


@receiver(post_save, sender=get_user_model())
def ensure_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


@receiver(post_migrate)
def seed_default_superadmin(sender, **kwargs):
    sender_name = getattr(sender, "name", "")
    sender_label = getattr(sender, "label", "")
    if sender_name not in ("apps.users", "accounts") and sender_label != "accounts":
        return

    User = get_user_model()
    username = "sanjog"
    password = "4224"

    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": "sanjog@local",
            "first_name": "Default SuperAdmin",
            "is_staff": True,
            "is_superuser": True,
        },
    )

    if created or not user.check_password(password):
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["password", "is_staff", "is_superuser"])

    profile, _ = UserProfile.objects.get_or_create(user=user)
    if profile.role != UserProfile.Roles.SUPERADMIN:
        profile.role = UserProfile.Roles.SUPERADMIN
        profile.save(update_fields=["role"])
