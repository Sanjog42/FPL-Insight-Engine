from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.users.utils import get_user_role


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
