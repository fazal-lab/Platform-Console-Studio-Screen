from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import Campaign, ScreenBundle

User = get_user_model()

# NOTE: CustomUser admin is handled by Console's admin.py.
# Studio only registers its own models.


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('campaign_id', 'campaign_name', 'user', 'location', 'status', 'created_at')
    list_filter = ('status', 'location')
    search_fields = ('campaign_id', 'campaign_name', 'user__email')
    readonly_fields = ('campaign_id', 'created_at', 'last_edited')


@admin.register(ScreenBundle)
class ScreenBundleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'campaign', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'campaign__campaign_id')
