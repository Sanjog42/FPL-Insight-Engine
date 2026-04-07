from rest_framework.permissions import BasePermission

from .models import UserProfile
from .utils import get_user_role


class RolePermission(BasePermission):
    allowed_roles = tuple()

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return bool(role and role in self.allowed_roles)


class IsSuperAdmin(RolePermission):
    allowed_roles = (UserProfile.Roles.SUPERADMIN,)


class IsAdminOrSuperAdmin(RolePermission):
    allowed_roles = (UserProfile.Roles.ADMIN, UserProfile.Roles.SUPERADMIN)


class IsUserOrAbove(RolePermission):
    allowed_roles = (
        UserProfile.Roles.USER,
        UserProfile.Roles.ADMIN,
        UserProfile.Roles.SUPERADMIN,
    )
