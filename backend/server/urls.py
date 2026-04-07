from django.contrib import admin
from django.urls import include, path

from accounts.views import DeleteUserView, DemoteUserView, PromoteUserView, SuperAdminUsersView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("predictions.urls")),
    path("api/admin/users/", SuperAdminUsersView.as_view(), name="superadmin-users-direct"),
    path("api/superadmin/promote/<int:id>/", PromoteUserView.as_view(), name="superadmin-promote-direct"),
    path("api/superadmin/demote/<int:id>/", DemoteUserView.as_view(), name="superadmin-demote-direct"),
    path("api/superadmin/delete/<int:id>/", DeleteUserView.as_view(), name="superadmin-delete-direct"),
]
