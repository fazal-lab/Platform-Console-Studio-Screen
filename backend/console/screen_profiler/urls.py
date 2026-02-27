from django.urls import path
from . import views

urlpatterns = [
    # Screen Profile API endpoint
    path('screen-profile/<int:screen_id>/', views.ScreenProfileAPIView.as_view(), name='screen-profile-by-id'),
    path('screen-profile/', views.ScreenProfileAPIView.as_view(), name='screen-profile-analyze'),
    path('screen-profiles/', views.ScreenProfileListView.as_view(), name='screen-profiles-list'),
]
