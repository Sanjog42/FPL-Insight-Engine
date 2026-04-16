from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import UserProfile
from .permissions import IsSuperAdmin
from .utils import get_user_role

User = get_user_model()


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = get_user_role(user)
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        role = get_user_role(self.user)
        return {
            "token": data["access"],
            "refresh": data["refresh"],
            "username": self.user.username,
            "role": role,
        }


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RoleTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        full_name = request.data.get("full_name", "").strip()
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")

        if not username or not email or not password:
            return Response(
                {"detail": "username, email, password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "Email already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User(
            username=username,
            email=email,
            first_name=full_name,
        )

        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            return Response(
                {"detail": "Password validation failed", "errors": exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.role != UserProfile.Roles.USER:
            profile.role = UserProfile.Roles.USER
            profile.save(update_fields=["role"])

        return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response(
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "full_name": u.first_name,
                "role": get_user_role(u),
            }
        )

    def patch(self, request):
        u = request.user
        username = request.data.get("username")
        email = request.data.get("email")
        full_name = request.data.get("full_name")

        if username is not None:
            username = username.strip()
            if not username:
                return Response(
                    {"detail": "username cannot be empty"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if User.objects.filter(username=username).exclude(id=u.id).exists():
                return Response(
                    {"detail": "Username already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            u.username = username

        if email is not None:
            email = email.strip()
            if not email:
                return Response(
                    {"detail": "email cannot be empty"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if User.objects.filter(email=email).exclude(id=u.id).exists():
                return Response(
                    {"detail": "Email already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            u.email = email

        if full_name is not None:
            u.first_name = full_name.strip()

        u.save()

        return Response(
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "full_name": u.first_name,
                "role": get_user_role(u),
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not current_password or not new_password or not confirm_password:
            return Response(
                {
                    "detail": "current_password, new_password, confirm_password are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {"detail": "New passwords do not match"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        u = request.user
        if not u.check_password(current_password):
            return Response(
                {"detail": "Current password is incorrect"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=u)
        except ValidationError as exc:
            return Response(
                {"detail": "Password validation failed", "errors": exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        u.set_password(new_password)
        u.save()

        return Response({"message": "Password updated successfully"})


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip()
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not username or not email or not new_password or not confirm_password:
            return Response(
                {
                    "detail": "username, email, new_password, confirm_password are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {"detail": "New passwords do not match"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(username=username, email=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "No account matches the provided username and email"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except ValidationError as exc:
            return Response(
                {"detail": "Password validation failed", "errors": exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response({"message": "Password reset successfully"})


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
            return Response(
                {"detail": "SuperAdmin role cannot be changed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.role = UserProfile.Roles.ADMIN
        profile.save(update_fields=["role"])

        return Response(
            {
                "message": "User promoted to Admin",
                "id": user.id,
                "username": user.username,
                "role": profile.role,
            }
        )


class DemoteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def put(self, request, id):
        try:
            user = User.objects.get(pk=id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.role == UserProfile.Roles.SUPERADMIN:
            return Response(
                {"detail": "SuperAdmin role cannot be changed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.role = UserProfile.Roles.USER
        profile.save(update_fields=["role"])

        return Response(
            {
                "message": "Admin demoted to User",
                "id": user.id,
                "username": user.username,
                "role": profile.role,
            }
        )


class DeleteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def delete(self, request, id):
        if request.user.id == id:
            return Response(
                {"detail": "You cannot delete your own account"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(pk=id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        role = get_user_role(user)
        if role == UserProfile.Roles.SUPERADMIN:
            return Response(
                {"detail": "SuperAdmin account cannot be deleted"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = user.username
        user.delete()
        return Response({"message": f"User '{username}' deleted successfully"})
