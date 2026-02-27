from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    LoginView,
    VerifyTokenView,
    SendResetCode,
    VerifyCode,
    ResetPassword,
    LogoutView,
    AdminLoginView,
    UserProfileView,
    CampaignCreateView,
    CampaignListView,
    CampaignDetailView,
    CampaignStatsView,
    CampaignDeleteView,
    CampaignStatusUpdateView,
    CampaignUpdateView,
    AdminUserListView,
    DashboardOverviewView,
    CampaignAssetDeleteView,
    ScreenBundleListCreateView,
    ScreenBundleDetailView,
    ScreenBundleCreativeFileView,
)

urlpatterns = [
    # -- Auth --
    path('register/', RegisterView.as_view(), name='studio-register'),
    path('login/', LoginView.as_view(), name='studio-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='studio-token-refresh'),
    path('verify-token/', VerifyTokenView.as_view(), name='verify-token'),
    path('send-reset-code/', SendResetCode.as_view(), name='send-reset-code'),
    path('verify-code/', VerifyCode.as_view(), name='verify-code'),
    path('reset-password/', ResetPassword.as_view(), name='reset-password'),
    path('logout/', LogoutView.as_view(), name='studio-logout'),
    path('admin/login/', AdminLoginView.as_view(), name='admin-login'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),

    # -- Campaign --
    path('campaign/', CampaignListView.as_view(), name='campaign-list'),
    path('campaign/create/', CampaignCreateView.as_view(), name='campaign-create'),
    path('campaign/stats/', CampaignStatsView.as_view(), name='campaign-stats'),
    path('campaign/<str:campaign_id>/', CampaignDetailView.as_view(), name='campaign-detail'),
    path('campaign/<str:campaign_id>/delete/', CampaignDeleteView.as_view(), name='campaign-delete'),
    path('campaign/<str:campaign_id>/status/', CampaignStatusUpdateView.as_view(), name='campaign-status-update'),
    path('campaign/<str:campaign_id>/update/', CampaignUpdateView.as_view(), name='campaign-update'),

    # -- Admin --
    path('admin/users/', AdminUserListView.as_view(), name='admin-user-list'),

    # -- Dashboard (single combined endpoint) --
    path('dashboard/overview/', DashboardOverviewView.as_view(), name='dashboard-overview'),

    # -- Console proxy: asset delete (Console backend doesn't expose DELETE; proxied here) --
    path('asset-delete/campaign/<str:campaign_id>/assets/<int:asset_id>/', CampaignAssetDeleteView.as_view(), name='campaign-asset-delete'),

    # -- Screen Bundles --
    path('campaign/<str:campaign_id>/bundles/', ScreenBundleListCreateView.as_view(), name='bundle-list-create'),
    path('campaign/<str:campaign_id>/bundles/<int:bundle_id>/', ScreenBundleDetailView.as_view(), name='bundle-detail'),
    path('campaign/<str:campaign_id>/bundles/<int:bundle_id>/creative-file/', ScreenBundleCreativeFileView.as_view(), name='bundle-creative-file'),
]
