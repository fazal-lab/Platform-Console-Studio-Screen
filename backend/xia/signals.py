"""
XIA Signals
------------
Real-time sync from source tables to XIA's ScreenMaster.

Django Signals fire automatically when the source Screen model
is created, updated, or deleted — keeping XIA's table in perfect sync.

Connection: These handlers are connected in xia/apps.py -> ready().
"""

import logging

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

logger = logging.getLogger('xia.signals')

# ── Field mapping: source model field -> ScreenMaster field ─────────
# Only fields that are RENAMED need to be listed here.
# Fields with the same name are passed through automatically.
RENAME_MAP = {
    'id': 'screenid',
    'city': 'spec_city',
    'latitude': 'spec_latitude',
    'longitude': 'spec_longitude',
    'full_address': 'spec_full_address',
    'nearest_landmark': 'spec_nearest_landmark',
}

# Fields from the source API that we do NOT want in ScreenMaster
EXCLUDED_FIELDS = {
    'uid', 'screen_id', 'enable_surcharge',
    'last_minute_charges_json', 'proof_of_play_supported',
}

# All fields that exist in ScreenMaster (from API #1)
SCREEN_MASTER_FIELDS = {
    'screenid', 'company_name', 'partner_name', 'admin_name',
    'screen_name', 'role', 'spec_city', 'spec_latitude', 'spec_longitude',
    'spec_full_address', 'spec_nearest_landmark', 'technology', 'environment',
    'screen_type', 'screen_width', 'screen_height', 'resolution_width',
    'resolution_height', 'orientation', 'pixel_pitch_mm', 'brightness_nits',
    'refresh_rate_hz', 'installation_type', 'mounting_height_ft',
    'facing_direction', 'road_type', 'traffic_direction',
    'standard_ad_duration_sec', 'total_slots_per_loop', 'loop_length_sec',
    'reserved_slots', 'supported_formats_json', 'max_file_size_mb',
    'internet_type', 'average_bandwidth_mbps', 'power_backup_type',
    'days_active_per_week', 'downtime_windows', 'audio_supported',
    'backup_internet', 'base_price_per_slot_inr', 'minimum_booking_days',
    'seasonal_pricing', 'seasons_json', 'enable_min_booking',
    'surcharge_percent', 'restricted_categories_json',
    'sensitive_zone_flags_json', 'cms_type', 'cms_api',
    'ai_camera_installed', 'screen_health_ping', 'playback_logs',
    'ai_camera_api', 'ownership_proof_uploaded', 'permission_noc_available',
    'screen_image_front', 'screen_image_back', 'screen_image_long',
    'gst', 'content_policy_accepted', 'source', 'remarks', 'reviewed_by',
    'current_step', 'status', 'created_at', 'updated_at',
    'is_profiled', 'profile_status',
}


def _map_source_to_master(instance):
    """
    Convert a source Screen model instance into a dict
    of ScreenMaster field values.
    """
    data = {}
    # Iterate over all fields of the source instance
    for field in instance._meta.fields:
        source_name = field.name
        # Skip excluded fields
        if source_name in EXCLUDED_FIELDS:
            continue
        # Apply rename if needed, otherwise use same name
        target_name = RENAME_MAP.get(source_name, source_name)
        # Only include if it's a valid ScreenMaster field
        if target_name in SCREEN_MASTER_FIELDS:
            data[target_name] = getattr(instance, source_name)
    return data


def screen_post_save_handler(sender, instance, created, **kwargs):
    """
    Fired on post_save of the source Screen model.
    Creates or updates the corresponding ScreenMaster row.
    """
    from xia.models import ScreenMaster

    mapped = _map_source_to_master(instance)
    screenid = mapped.pop('screenid', None)

    if screenid is None:
        logger.warning('Signal received but source instance has no id — skipping.')
        return

    _, was_created = ScreenMaster.objects.update_or_create(
        screenid=screenid,
        defaults=mapped,
    )

    action = 'Created' if was_created else 'Updated'
    logger.info(f'{action} ScreenMaster row for screenid={screenid}')


def screen_post_delete_handler(sender, instance, **kwargs):
    """
    Fired on post_delete of the source Screen model.
    Deletes the corresponding ScreenMaster row.
    """
    from xia.models import ScreenMaster

    source_id = instance.id
    deleted_count, _ = ScreenMaster.objects.filter(screenid=source_id).delete()

    if deleted_count:
        logger.info(f'Deleted ScreenMaster row for screenid={source_id}')
    else:
        logger.warning(f'No ScreenMaster row found for screenid={source_id}')


def connect_screen_signals():
    """
    Connect signal handlers to the source Screen model.

    Call this from XiaConfig.ready() once the source app is available.
    The source model path should be configured in Django settings:

        XIA_SCREEN_SOURCE_MODEL = 'console.Screen'  # or 'screens.Screen'
    """
    from django.apps import apps
    from django.conf import settings

    source_model_path = getattr(settings, 'XIA_SCREEN_SOURCE_MODEL', None)

    if not source_model_path:
        logger.info(
            'XIA_SCREEN_SOURCE_MODEL not set in settings. '
            'Signal-based sync is disabled. Use API sync instead.'
        )
        return

    try:
        SourceModel = apps.get_model(source_model_path)
    except (LookupError, ValueError) as e:
        logger.error(f'Could not load source model "{source_model_path}": {e}')
        return

    post_save.connect(
        screen_post_save_handler,
        sender=SourceModel,
        dispatch_uid='xia_screen_post_save',
    )
    post_delete.connect(
        screen_post_delete_handler,
        sender=SourceModel,
        dispatch_uid='xia_screen_post_delete',
    )

    logger.info(f'XIA signals connected to {source_model_path}')
