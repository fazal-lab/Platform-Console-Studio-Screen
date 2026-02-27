from django.urls import path

from . import views

app_name = 'xia'

urlpatterns = [
    path('health/', views.HealthCheckView.as_view(), name='health-check'),
    path('screens/', views.ScreenMasterListView.as_view(), name='screen-list'),
    path('sync/screens/', views.SyncScreensView.as_view(), name='sync-screens'),
    path('discover/', views.ScreenDiscoverView.as_view(), name='screen-discover'),
    path('chat/', views.XIAChatView.as_view(), name='xia-chat'),
    path('chat/<uuid:session_id>/', views.XIAChatRestoreView.as_view(), name='xia-chat-restore'),
    path('chat-open/', views.XIAChatOpenView.as_view(), name='xia-chat-open'),
    path('creative-suggestion/', views.XIACreativeSuggestionView.as_view(), name='xia-creative-suggestion'),
    path('debug/', views.XIADebugView.as_view(), name='xia-debug'),
]
