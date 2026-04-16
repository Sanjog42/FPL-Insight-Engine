from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordView,
    DeleteUserView,
    DemoteUserView,
    ForgotPasswordView,
    LoginView,
    MeView,
    PromoteUserView,
    RegisterView,
    SuperAdminUsersView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("admin/users/", SuperAdminUsersView.as_view(), name="admin-users"),
    path("superadmin/promote/<int:id>/", PromoteUserView.as_view(), name="superadmin-promote"),
    path("superadmin/demote/<int:id>/", DemoteUserView.as_view(), name="superadmin-demote"),
    path("superadmin/delete/<int:id>/", DeleteUserView.as_view(), name="superadmin-delete"),
]
