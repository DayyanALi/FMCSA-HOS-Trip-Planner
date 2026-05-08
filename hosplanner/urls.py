from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from django.views.generic import TemplateView

from trips.views import plan_trip


urlpatterns = [
    path("", TemplateView.as_view(template_name="index.html"), name="home"),
    path("api/plan/", plan_trip, name="plan_trip"),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

