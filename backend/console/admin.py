from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser, Company, Locality, AdSlot, Campaign, 
    CampaignLocation, Creative, PlaybackLog, Ticket, Dispute, AuditLog,
    ScreenSpec, SlotBooking
)

class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('role', 'phone')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {'fields': ('role', 'phone')}),
    )
    ordering = ('email',)

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'company_type', 'is_active', 'created_at')
    list_filter = ('company_type', 'is_active')
    search_fields = ('name', 'contact_email')

@admin.register(Locality)
class LocalityAdmin(admin.ModelAdmin):
    list_display = ('name', 'screen_id', 'verification_status', 'created_at')
    list_filter = ('verification_status',)
    search_fields = ('name', 'screen_id', 'address')

@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'status', 'start_date', 'end_date')
    list_filter = ('status', 'company')
    search_fields = ('name',)

@admin.register(Creative)
class CreativeAdmin(admin.ModelAdmin):
    list_display = ('name', 'campaign', 'validation_status', 'media_type', 'created_at')
    list_filter = ('validation_status', 'media_type')

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'user', 'priority', 'status', 'created_at')
    list_filter = ('priority', 'status')
    search_fields = ('title', 'description')

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'action', 'component', 'ip_address')
    list_filter = ('component', 'action')
    readonly_fields = ('timestamp', 'user', 'action', 'component', 'target_id', 'payload', 'ip_address')

# Registering remaining models simply
admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(AdSlot)
admin.site.register(CampaignLocation)
admin.site.register(PlaybackLog)
admin.site.register(Dispute)

@admin.register(ScreenSpec)
class ScreenSpecAdmin(admin.ModelAdmin):
    list_display = ('screen_name', 'admin_name', 'city', 'screen_type', 'status', 'created_at')
    list_filter = ('status', 'city', 'role', 'environment', 'screen_type')
    search_fields = ('screen_name', 'admin_name', 'city', 'full_address')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Identifiers', {
            'fields': ('screen_name', 'role', 'admin_name', 'city', 'latitude', 'longitude', 'full_address', 'nearest_landmark')
        }),
        ('Display Specs', {
            'fields': ('technology', 'environment', 'screen_type', 'screen_width', 'screen_height', 'resolution_width', 'resolution_height', 'orientation', 'pixel_pitch_mm', 'brightness_nits', 'refresh_rate_hz')
        }),
        ('Installation & Visibility', {
            'fields': ('installation_type', 'mounting_height_ft', 'facing_direction', 'road_type', 'traffic_direction')
        }),
        ('Playback & Slots', {
            'fields': ('standard_ad_duration_sec', 'total_slots_per_loop', 'loop_length_sec', 'reserved_slots', 'supported_formats_json', 'max_file_size_mb')
        }),
        ('Connectivity & Ops', {
            'fields': ('internet_type', 'average_bandwidth_mbps', 'power_backup_type', 'days_active_per_week', 'downtime_windows', 'audio_supported', 'backup_internet')
        }),
        ('Commercials', {
            'fields': ('base_price_per_slot_inr', 'seasonal_pricing', 'seasons_json', 'enable_min_booking', 'minimum_booking_days', 'surcharge_percent', 'restricted_categories_json', 'sensitive_zone_flags_json')
        }),
        ('Compliance & Monitoring', {
            'fields': ('cms_type', 'cms_api', 'ai_camera_installed', 'screen_health_ping', 'playback_logs', 'ai_camera_api')
        }),
        ('Documents', {
            'fields': ('ownership_proof_uploaded', 'permission_noc_available', 'gst', 'content_policy_accepted')
        }),
        ('Status & Meta', {
            'fields': ('status', 'created_at', 'updated_at')
        }),
    )

@admin.register(SlotBooking)
class SlotBookingAdmin(admin.ModelAdmin):
    list_display = ('screen', 'num_slots', 'start_date', 'end_date', 'status', 'campaign_id', 'user_id', 'created_at')
    list_filter = ('status',)
    search_fields = ('screen__screen_name', 'campaign_id', 'user_id')
