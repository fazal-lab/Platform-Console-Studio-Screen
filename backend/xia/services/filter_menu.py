"""
Filter Menu Generator
---------------------
Builds the dynamic filter menu string for Call #1's prompt.
Queries ScreenMaster for actual distinct values — no hardcoding.

Usage:
    from xia.services.filter_menu import build_filter_menu
    menu_str = build_filter_menu()
"""

import logging
from xia.models import ScreenMaster

logger = logging.getLogger('xia.filter_menu')


# ─── Enum fields: queried dynamically from DB ───────────────────

ENUM_FIELDS = [
    # (model_field_name, display_name)
    ('primaryType', 'primaryType'),
    ('dominantGroup', 'dominantGroup'),
    ('movement_type', 'movement_type'),
    ('dwellCategory', 'dwellCategory'),
    ('environment', 'environment'),
    ('technology', 'technology'),
    ('orientation', 'orientation'),
    ('installation_type', 'installation_type'),
    ('road_type', 'road_type'),
    ('traffic_direction', 'traffic_direction'),
    ('confidence', 'confidence'),
    ('cityTier', 'cityTier'),
    ('audio_supported', 'audio_supported'),
    ('spec_city', 'spec_city'),
]

# ─── Numeric fields: static list (operators applied by LLM) ────

NUMERIC_FIELDS = [
    'base_price_per_slot_inr',
    'brightness_nits',
    'screen_width',
    'screen_height',
    'resolution_width',
    'resolution_height',
    'mounting_height_ft',
    'total_slots_per_loop',
    'standard_ad_duration_sec',
    'days_active_per_week',
    'pixel_pitch_mm',
    'refresh_rate_hz',
]

# ─── Text search fields: static list ───────────────────────────

TEXT_SEARCH_FIELDS = [
    'screen_name',
    'spec_city',
    'spec_full_address',
    'spec_nearest_landmark',
    'profiled_city',
    'profiled_full_address',
    'profiled_state',
    'facing_direction',
    'areaContext',
    'movement_context',
]

# ─── Gateway fields: static list ───────────────────────────────

GATEWAY_FIELDS = [
    'gateway_start_date',
    'gateway_end_date',
    'gateway_location',
    'gateway_budget_range',
]


def _get_distinct_values(field_name: str) -> list:
    """
    Query ScreenMaster for distinct non-empty values of a field.
    Returns sorted list of unique values.
    """
    try:
        qs = ScreenMaster.objects.exclude(**{field_name: None})

        # BooleanFields can't be excluded with empty string
        field_obj = ScreenMaster._meta.get_field(field_name)
        is_bool = field_obj.get_internal_type() == 'BooleanField'

        if not is_bool:
            qs = qs.exclude(**{field_name: ''})

        values = (
            qs.values_list(field_name, flat=True)
            .distinct()
            .order_by(field_name)
        )

        # Convert to strings and filter empties
        result = sorted(set(
            str(v).strip() for v in values
            if v is not None and str(v).strip()
        ))
        return result
    except Exception as e:
        logger.warning(f'Could not query distinct values for {field_name}: {e}')
        return []


def build_filter_menu() -> str:
    """
    Build the complete filter menu string for Call #1's prompt.
    Queries ScreenMaster for actual enum values — stays in sync with DB.

    Returns:
        Multi-line string ready to inject into the system prompt.
    """
    lines = []

    # ── Enum filters ──
    lines.append('ENUM FILTERS (use exact values):')
    for field_name, display_name in ENUM_FIELDS:
        values = _get_distinct_values(field_name)
        if values:
            values_str = ', '.join(values)
            lines.append(f'  {display_name}: {values_str}')
        else:
            lines.append(f'  {display_name}: (no data yet)')

    lines.append('')

    # ── Numeric filters ──
    lines.append('NUMERIC FILTERS (use operators: eq, gt, lt, gte, lte):')
    lines.append(f'  {", ".join(NUMERIC_FIELDS)}')

    lines.append('')

    # ── Text search fields ──
    lines.append('TEXT SEARCH FIELDS (partial match):')
    lines.append(f'  {", ".join(TEXT_SEARCH_FIELDS)}')

    lines.append('')

    # ── Gateway fields ──
    lines.append('GATEWAY FIELDS (editable, needs approval):')
    lines.append(f'  {", ".join(GATEWAY_FIELDS)}')

    menu = '\n'.join(lines)

    logger.info(
        f'Filter menu built: {len(ENUM_FIELDS)} enum fields, '
        f'{len(NUMERIC_FIELDS)} numeric, {len(TEXT_SEARCH_FIELDS)} text search'
    )

    return menu
