from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.users.views import DeleteUserView, DemoteUserView, PromoteUserView, SuperAdminUsersView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/auth/", include("apps.users.urls")),
    path("api/", include("apps.predictions.urls")),
    path("api/admin/users/", SuperAdminUsersView.as_view(), name="superadmin-users-direct"),
    path("api/superadmin/promote/<int:id>/", PromoteUserView.as_view(), name="superadmin-promote-direct"),
    path("api/superadmin/demote/<int:id>/", DemoteUserView.as_view(), name="superadmin-demote-direct"),
    path("api/superadmin/delete/<int:id>/", DeleteUserView.as_view(), name="superadmin-delete-direct"),
]
