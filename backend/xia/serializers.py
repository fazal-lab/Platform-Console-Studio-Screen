"""
XIA Serializers
---------------
"""

from rest_framework import serializers

from .models import ScreenMaster, SlotBooking


class ScreenMasterSerializer(serializers.ModelSerializer):
    """Full serializer for ScreenMaster — all fields, exact order."""

    class Meta:
        model = ScreenMaster
        fields = [
            'screenid', 'company_name', 'partner_name', 'admin_name',
            'screen_name', 'role',
            'spec_city', 'spec_latitude', 'spec_longitude',
            'spec_full_address', 'spec_nearest_landmark',
            'technology', 'environment', 'screen_type',
            'screen_width', 'screen_height',
            'resolution_width', 'resolution_height',
            'orientation', 'pixel_pitch_mm', 'brightness_nits',
            'refresh_rate_hz', 'installation_type', 'mounting_height_ft',
            'facing_direction', 'road_type', 'traffic_direction',
            'standard_ad_duration_sec', 'total_slots_per_loop',
            'loop_length_sec', 'reserved_slots',
            'supported_formats_json', 'max_file_size_mb',
            'internet_type', 'average_bandwidth_mbps', 'power_backup_type',
            'days_active_per_week', 'downtime_windows',
            'audio_supported', 'backup_internet',
            'base_price_per_slot_inr', 'minimum_booking_days',
            'seasonal_pricing', 'seasons_json',
            'enable_min_booking', 'surcharge_percent',
            'restricted_categories_json', 'sensitive_zone_flags_json',
            'cms_type', 'cms_api',
            'ai_camera_installed', 'screen_health_ping',
            'playback_logs', 'ai_camera_api',
            'ownership_proof_uploaded', 'permission_noc_available',
            'screen_image_front', 'screen_image_back', 'screen_image_long',
            'gst', 'content_policy_accepted',
            'source', 'remarks', 'reviewed_by',
            'current_step', 'status',
            'created_at', 'updated_at',
            'is_profiled', 'profile_status',
            # API #2 — Profile Location
            'profiled_latitude', 'profiled_longitude',
            'profiled_city', 'profiled_state', 'profiled_country',
            'cityTier', 'profiled_full_address',
            # API #2 — Area
            'primaryType', 'areaContext', 'confidence',
            'classificationDetail', 'dominantGroup',
            # API #2 — Movement
            'movement_type', 'movement_context',
            # API #2 — Dwell
            'dwellCategory', 'dwellConfidence', 'dwellScore', 'dominanceRatio',
            # API #2 — Ring Analysis
            'ring1', 'ring2', 'ring3', 'reasoning',
            # API #2 — Metadata
            'computedAt', 'apiCallsMade', 'processingTimeMs',
            # API #2 — LLM
            'LLMused', 'LLMreason', 'LLMmode',
            'synced_at',
        ]
        read_only_fields = ['synced_at']


class SlotBookingSerializer(serializers.ModelSerializer):
    """Serializer for SlotBooking — all fields."""

    class Meta:
        model = SlotBooking
        fields = [
            'booking_id', 'screen_id', 'screen_name',
            'booked_num_slots', 'start_date', 'end_date',
            'campaign_id', 'user_id',
            'status', 'screen_owner', 'payment',
            'created_at', 'synced_at',
        ]
        read_only_fields = ['synced_at']
