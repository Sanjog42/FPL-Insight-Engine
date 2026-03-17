from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        full_name = request.data.get("full_name", "").strip()
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "").strip()

        if not username or not email or not password:
            return Response({"detail": "username, email, password are required"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"detail": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=full_name
        )

        return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.first_name,
            "role": "admin" if u.is_staff else "user"
        })

    def patch(self, request):
        u = request.user
        username = request.data.get("username")
        email = request.data.get("email")
        full_name = request.data.get("full_name")

        if username is not None:
            username = username.strip()
            if not username:
                return Response({"detail": "username cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(username=username).exclude(id=u.id).exists():
                return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
            u.username = username

        if email is not None:
            email = email.strip()
            if not email:
                return Response({"detail": "email cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(email=email).exclude(id=u.id).exists():
                return Response({"detail": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)
            u.email = email

        if full_name is not None:
            u.first_name = full_name.strip()

        u.save()

        return Response({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.first_name,
            "role": "admin" if u.is_staff else "user"
        })


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not current_password or not new_password or not confirm_password:
            return Response({"detail": "current_password, new_password, confirm_password are required"}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({"detail": "New passwords do not match"}, status=status.HTTP_400_BAD_REQUEST)

        u = request.user
        if not u.check_password(current_password):
            return Response({"detail": "Current password is incorrect"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user=u)
        except ValidationError as exc:
            return Response({"detail": "Password validation failed", "errors": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        u.set_password(new_password)
        u.save()

        return Response({"message": "Password updated successfully"})
