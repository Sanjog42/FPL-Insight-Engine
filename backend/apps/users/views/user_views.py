from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, inline_serializer

from apps.users.utils import get_user_role

User = get_user_model()


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="MeResponse",
                fields={
                    "id": serializers.IntegerField(),
                    "username": serializers.CharField(),
                    "email": serializers.EmailField(),
                    "full_name": serializers.CharField(allow_blank=True),
                    "role": serializers.CharField(),
                },
            )
        }
    )
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

    @extend_schema(
        request=inline_serializer(
            name="MePatchRequest",
            fields={
                "username": serializers.CharField(required=False),
                "email": serializers.EmailField(required=False),
                "full_name": serializers.CharField(required=False),
            },
        ),
        responses={
            200: inline_serializer(
                name="MePatchResponse",
                fields={
                    "id": serializers.IntegerField(),
                    "username": serializers.CharField(),
                    "email": serializers.EmailField(),
                    "full_name": serializers.CharField(allow_blank=True),
                    "role": serializers.CharField(),
                },
            )
        },
    )
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

        return Response(
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "full_name": u.first_name,
                "role": get_user_role(u),
            }
        )
