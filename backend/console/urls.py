from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminLoginView, PartnerLoginView, ScreenInventoryView, ScreenVerifyView, ScreenVerifyBodyView, ScreenProfileView,
    CompanyViewSet, CampaignViewSet, CreativeViewSet, TicketViewSet, DisputeViewSet, IntelligenceView,
    ScreenSpecViewset, UserViewSet, AuditLogViewSet, PlaybackLogViewSet, CmsSyncMonitorView,
    ExternalScreenSubmissionView, ScreenDiscoveryView, PartnerSlotBlockView, AvailableCitiesView,
    CapacityCheckView, SlotBookingView, SlotBookingPaymentView, SlotBookingStatusView,
    CampaignManifestView, CampaignAssetUploadView, CampaignAssetValidateView,
    CampaignAssetDeleteView, CampaignAssetListView, BlockScreenView
)

router = DefaultRouter()
router.register(r'companies', CompanyViewSet)
router.register(r'campaigns', CampaignViewSet)
router.register(r'creatives', CreativeViewSet)
router.register(r'tickets', TicketViewSet)
router.register(r'disputes', DisputeViewSet)
router.register(r'screen-specs', ScreenSpecViewset)
router.register(r'users', UserViewSet)
router.register(r'audit-logs', AuditLogViewSet)
router.register(r'playback-logs', PlaybackLogViewSet)

urlpatterns = [
    path('screens/external-submit/', ExternalScreenSubmissionView.as_view(), name='external-screen-submit'),
    path('screens/external-submit/<int:pk>/', ExternalScreenSubmissionView.as_view(), name='external-screen-detail'),
    path('login/', AdminLoginView.as_view(), name='admin-login'),
    path('partner-login/', PartnerLoginView.as_view(), name='partner-login'),
    path('screens/', ScreenInventoryView.as_view(), name='screen-inventory'),
    path('screens/<int:pk>/verify/', ScreenVerifyView.as_view(), name='screen-verify'),
    path('screens/verify/', ScreenVerifyBodyView.as_view(), name='screen-verify-body'),
    path('screens/<int:pk>/profile/', ScreenProfileView.as_view(), name='screen-profile'),
    path('intelligence/', IntelligenceView.as_view(), name='intelligence-dashboard'),
    path('cms/sync-status/', CmsSyncMonitorView.as_view(), name='cms-sync-status'),
    path('screens/discover/', ScreenDiscoveryView.as_view(), name='screen-discover'),
    path('screens/block-slots/', PartnerSlotBlockView.as_view(), name='partner-slot-block'),
    path('screens/available-cities/', AvailableCitiesView.as_view(), name='available-cities'),
    path('screens/capacity-check/', CapacityCheckView.as_view(), name='capacity-check'),
    path('screens/<int:pk>/block/', BlockScreenView.as_view(), name='screen-block'),
    path('slot-bookings/', SlotBookingView.as_view(), name='slot-bookings'),
    path('slot-bookings/payment/', SlotBookingPaymentView.as_view(), name='slot-booking-payment'),
    path('slot-bookings/status/', SlotBookingStatusView.as_view(), name='slot-booking-status'),

    # Campaign Asset endpoints
    path('campaign/<str:campaign_id>/manifest/', CampaignManifestView.as_view(), name='campaign-manifest'),
    path('campaign/<str:campaign_id>/assets/', CampaignAssetUploadView.as_view(), name='campaign-assets'),
    path('campaign/<str:campaign_id>/assets/<int:asset_id>/', CampaignAssetDeleteView.as_view(), name='campaign-asset-delete'),
    path('campaign/<str:campaign_id>/assets/<int:asset_id>/validate/', CampaignAssetValidateView.as_view(), name='campaign-asset-validate'),
    path('campaign-assets/', CampaignAssetListView.as_view(), name='campaign-asset-list'),

    path('', include('console.screen_profiler.urls')),
    path('', include(router.urls)),
]
