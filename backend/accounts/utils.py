from .models import UserProfile


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None

    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile.role
