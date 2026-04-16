from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import UserProfile
from apps.users.permissions import IsSuperAdmin
from apps.users.utils import get_user_role

User = get_user_model()


class SuperAdminUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        users = User.objects.select_related("profile").order_by("id")
        payload = []
        for user in users:
            payload.append(
                {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "full_name": user.first_name,
                    "role": get_user_role(user),
                    "is_active": user.is_active,
                }
            )
        return Response(payload)


class PromoteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def put(self, request, id):
        try:
            user = User.objects.get(pk=id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.role == UserProfile.Roles.SUPERADMIN:
            return Response({"detail": "SuperAdmin role cannot be changed"}, status=status.HTTP_400_BAD_REQUEST)

        profile.role = UserProfile.Roles.ADMIN
        profile.save(update_fields=["role"])

        return Response({"message": "User promoted to Admin", "id": user.id, "username": user.username, "role": profile.role})


class DemoteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def put(self, request, id):
        try:
            user = User.objects.get(pk=id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.role == UserProfile.Roles.SUPERADMIN:
            return Response({"detail": "SuperAdmin role cannot be changed"}, status=status.HTTP_400_BAD_REQUEST)

        profile.role = UserProfile.Roles.USER
        profile.save(update_fields=["role"])

        return Response({"message": "Admin demoted to User", "id": user.id, "username": user.username, "role": profile.role})


class DeleteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def delete(self, request, id):
        if request.user.id == id:
            return Response({"detail": "You cannot delete your own account"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(pk=id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        role = get_user_role(user)
        if role == UserProfile.Roles.SUPERADMIN:
            return Response({"detail": "SuperAdmin account cannot be deleted"}, status=status.HTTP_400_BAD_REQUEST)

        username = user.username
        user.delete()
        return Response({"message": f"User '{username}' deleted successfully"})
