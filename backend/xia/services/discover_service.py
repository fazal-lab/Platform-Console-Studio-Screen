"""
Screen Discovery Service
-------------------------
Replicates Console Backend's POST /api/console/screens/discover/
using XIA's local tables (xia_screen_master + xia_slot_booking).

Accepts: start_date, end_date, location (list), budget_range
Returns: all matching screens with availability + budget flags.
"""

import re
import logging
from datetime import datetime, timedelta

from django.db.models import Q, Sum
from django.utils import timezone

from xia.models import ScreenMaster, SlotBooking

logger = logging.getLogger('xia.discover')

# ── Indian state/UT noise terms (stripped from location tokens) ─────
NOISE_TERMS = {
    'india', 'tamil nadu', 'karnataka', 'kerala', 'andhra pradesh',
    'telangana', 'maharashtra', 'rajasthan', 'uttar pradesh',
    'madhya pradesh', 'west bengal', 'gujarat', 'bihar',
    'odisha', 'punjab', 'haryana', 'jharkhand', 'chhattisgarh',
    'uttarakhand', 'himachal pradesh', 'goa', 'tripura',
    'meghalaya', 'manipur', 'nagaland', 'mizoram', 'arunachal pradesh',
    'sikkim', 'assam', 'jammu and kashmir', 'ladakh',
    'puducherry', 'chandigarh', 'delhi', 'lakshadweep',
    'andaman and nicobar islands', 'dadra and nagar haveli',
    'daman and diu',
}


def _extract_tokens(location_str: str) -> list:
    """Split a location string into meaningful search tokens."""
    parts = [p.strip() for p in location_str.split(',') if p.strip()]
    tokens = []
    for part in parts:
        # Remove pin codes (Indian 6-digit or any pure number sequences)
        cleaned = re.sub(r'\b\d{3,}\b', '', part).strip()
        if not cleaned:
            continue
        if cleaned.lower() in NOISE_TERMS:
            continue
        tokens.append(cleaned)
    return tokens


def _expire_stale_holds():
    """Auto-expire HOLD bookings with UNPAID payment older than 10 minutes."""
    cutoff = timezone.now() - timedelta(minutes=10)
    stale = SlotBooking.objects.filter(
        status='HOLD',
        payment='UNPAID',
        created_at__lt=cutoff,
    )
    count = stale.update(status='EXPIRED')
    if count:
        logger.info(f'Auto-expired {count} stale HOLD bookings')


def _build_location_q(locations: list) -> Q:
    """Build a Q filter from location tokens, searching across 5 fields."""
    location_q = Q()
    all_tokens = []

    for loc_entry in locations:
        tokens = _extract_tokens(loc_entry)
        all_tokens.extend(tokens)
        for token in tokens:
            location_q |= Q(spec_city__icontains=token)
            location_q |= Q(spec_full_address__icontains=token)
            location_q |= Q(spec_nearest_landmark__icontains=token)
            location_q |= Q(profiled_full_address__icontains=token)
            location_q |= Q(profiled_city__icontains=token)

    # Fallback: if all tokens were noise, try raw strings
    if not location_q:
        for loc_entry in locations:
            location_q |= Q(spec_city__icontains=loc_entry)
            location_q |= Q(spec_full_address__icontains=loc_entry)
            location_q |= Q(profiled_full_address__icontains=loc_entry)

    return location_q


def _calculate_availability(screen, start_date, end_date):
    """
    Calculate available slots for a screen in a date range.
    Returns (available_slots, overlapping_bookings_qs).
    """
    overlapping = screen.bookings.filter(
        status__in=['ACTIVE', 'HOLD'],
        start_date__lte=end_date,
        end_date__gte=start_date,
    )
    booked = overlapping.aggregate(total=Sum('booked_num_slots'))['total'] or 0
    available = screen.total_slots_per_loop - screen.reserved_slots - booked
    return available, overlapping


def _build_ai_profile(screen) -> dict:
    """Reconstruct the nested ai_profile dict from flat ScreenMaster fields."""
    return {
        'area': {
            'primaryType': screen.primaryType,
            'context': screen.areaContext,
            'confidence': screen.confidence,
            'classificationDetail': screen.classificationDetail,
            'dominantGroup': screen.dominantGroup,
        },
        'movement': {
            'type': screen.movement_type,
            'context': screen.movement_context,
        },
        'dwellCategory': screen.dwellCategory,
        'dwellConfidence': screen.dwellConfidence,
        'dwellScore': screen.dwellScore,
        'dominanceRatio': screen.dominanceRatio,
        'ringAnalysis': {
            'ring1': screen.ring1,
            'ring2': screen.ring2,
            'ring3': screen.ring3,
        },
        'reasoning': screen.reasoning or [],
    }


def _screen_to_response(screen) -> dict:
    """Serialize a ScreenMaster instance to the discover response format."""
    return {
        'id': screen.screenid,
        'screen_name': screen.screen_name,
        'company_name': screen.company_name,
        'partner_name': screen.partner_name,

        # Location
        'latitude': str(screen.spec_latitude) if screen.spec_latitude else None,
        'longitude': str(screen.spec_longitude) if screen.spec_longitude else None,
        'city': screen.spec_city,
        'full_address': screen.spec_full_address,
        'nearest_landmark': screen.spec_nearest_landmark,

        # Hardware
        'technology': screen.technology,
        'environment': screen.environment,
        'screen_type': screen.screen_type,
        'screen_width': str(screen.screen_width) if screen.screen_width else None,
        'screen_height': str(screen.screen_height) if screen.screen_height else None,
        'resolution_width': screen.resolution_width,
        'resolution_height': screen.resolution_height,
        'orientation': screen.orientation,
        'pixel_pitch_mm': screen.pixel_pitch_mm,
        'brightness_nits': screen.brightness_nits,
        'refresh_rate_hz': screen.refresh_rate_hz,
        'installation_type': screen.installation_type,
        'mounting_height_ft': str(screen.mounting_height_ft) if screen.mounting_height_ft else None,
        'facing_direction': screen.facing_direction,
        'road_type': screen.road_type,
        'traffic_direction': screen.traffic_direction,

        # Scheduling
        'standard_ad_duration_sec': screen.standard_ad_duration_sec,
        'total_slots_per_loop': screen.total_slots_per_loop,
        'loop_length_sec': screen.loop_length_sec,
        'reserved_slots': screen.reserved_slots,

        # Media
        'supported_formats_json': screen.supported_formats_json,
        'max_file_size_mb': screen.max_file_size_mb,
        'audio_supported': screen.audio_supported,

        # Pricing
        'base_price_per_slot_inr': str(screen.base_price_per_slot_inr) if screen.base_price_per_slot_inr else None,

        # Images
        'screen_image_front': screen.screen_image_front,
        'screen_image_back': screen.screen_image_back,
        'screen_image_long': screen.screen_image_long,

        # Restrictions
        'restricted_categories_json': screen.restricted_categories_json,
        'sensitive_zone_flags_json': screen.sensitive_zone_flags_json,

        # Status
        'status': screen.status,
        'profile_status': screen.profile_status,
        'is_profiled': screen.is_profiled,
    }


def discover_screens(
    locations: list,
    start_date_str: str,
    end_date_str: str,
    budget_range: str,
    xia_filters: dict = None,
    exclude_filters: dict = None,
    text_search: str = '',
) -> dict:
    """
    Main discover function.
    Replicates Console's POST /api/console/screens/discover/ logic exactly,
    extended with XIA Call #1 filters.

    Args:
        locations: List of location strings from gateway
        start_date_str: Campaign start date (YYYY-MM-DD)
        end_date_str: Campaign end date (YYYY-MM-DD)
        budget_range: Budget string from gateway
        xia_filters: Enum/numeric filters from Call #1 (e.g. {environment: "Outdoor"})
        exclude_filters: Negation filters from Call #1 (e.g. {primaryType: "RELIGIOUS"})
        text_search: Free-text search from Call #1 (e.g. "MPS Complex")

    Returns dict with: query, total_screens_found, available_screens,
    unavailable_screens, screens.
    """
    xia_filters = xia_filters or {}
    exclude_filters = exclude_filters or {}

    # Parse dates
    start = datetime.strptime(start_date_str, '%Y-%m-%d')
    end = datetime.strptime(end_date_str, '%Y-%m-%d')
    num_days = (end - start).days

    if num_days <= 0:
        return {
            'query': {'locations': locations, 'start_date': start_date_str, 'end_date': end_date_str, 'budget_range': budget_range},
            'total_screens_found': 0,
            'available_screens': 0,
            'unavailable_screens': 0,
            'screens': [],
        }

    budget = float(budget_range)
    daily_budget = budget / num_days

    # Expire stale HOLDs
    _expire_stale_holds()

    # Build location filter
    location_q = _build_location_q(locations)

    # Query screens: location + VERIFIED + profiled
    screens = ScreenMaster.objects.filter(
        location_q,
        status__in=['VERIFIED', 'SCHEDULED_BLOCK'],
        profile_status__in=['PROFILED', 'REPROFILE'],
    ).distinct()

    # ── Apply XIA enum/numeric filters ──────────────────────────
    # These are the fields known to the filter menu
    VALID_ENUM_FIELDS = {
        'primaryType', 'dominantGroup', 'movement_type', 'dwellCategory',
        'environment', 'technology', 'orientation', 'installation_type',
        'road_type', 'traffic_direction', 'confidence', 'cityTier',
        'audio_supported', 'spec_city',
    }
    VALID_NUMERIC_FIELDS = {
        'base_price_per_slot_inr', 'brightness_nits', 'screen_width',
        'screen_height', 'resolution_width', 'resolution_height',
        'mounting_height_ft', 'total_slots_per_loop',
        'standard_ad_duration_sec', 'days_active_per_week',
        'pixel_pitch_mm', 'refresh_rate_hz',
    }
    OPERATOR_MAP = {
        'eq': '', 'gt': '__gt', 'lt': '__lt', 'gte': '__gte', 'lte': '__lte',
    }

    for field, value in xia_filters.items():
        if field in VALID_ENUM_FIELDS:
            # Handle boolean string conversion for audio_supported
            if field == 'audio_supported':
                value = value in ('True', 'true', True)
            # Handle list values: use __in (OR match) instead of exact
            if isinstance(value, list):
                if field == 'spec_city':
                    # Case-insensitive matching for city names
                    city_q = Q()
                    for v in value:
                        city_q |= Q(spec_city__iexact=v)
                    screens = screens.filter(city_q)
                else:
                    screens = screens.filter(**{f'{field}__in': value})
            else:
                screens = screens.filter(**{field: value})
        elif field in VALID_NUMERIC_FIELDS:
            if isinstance(value, dict):
                # Numeric with operator: {"brightness_nits": {"gte": 5000}}
                for op, op_val in value.items():
                    suffix = OPERATOR_MAP.get(op, '')
                    lookup = f'{field}{suffix}'
                    screens = screens.filter(**{lookup: float(op_val)})
            else:
                # Direct value: {"brightness_nits": 5000}
                screens = screens.filter(**{field: float(value)})
        else:
            logger.warning(f'Unknown XIA filter field ignored: {field}')

    # ── Apply exclude filters ───────────────────────────────────
    for field, value in exclude_filters.items():
        if field in VALID_ENUM_FIELDS:
            if field == 'audio_supported':
                value = value in ('True', 'true', True)
            screens = screens.exclude(**{field: value})
        elif field in VALID_NUMERIC_FIELDS:
            if isinstance(value, dict):
                for op, op_val in value.items():
                    suffix = OPERATOR_MAP.get(op, '')
                    lookup = f'{field}{suffix}'
                    screens = screens.exclude(**{lookup: float(op_val)})
            else:
                screens = screens.exclude(**{field: float(value)})
        else:
            logger.warning(f'Unknown exclude filter field ignored: {field}')

    # ── Apply text search ───────────────────────────────────────
    if text_search and text_search.strip():
        term = text_search.strip()
        text_q = (
            Q(screen_name__icontains=term) |
            Q(spec_full_address__icontains=term) |
            Q(spec_nearest_landmark__icontains=term) |
            Q(profiled_full_address__icontains=term) |
            Q(areaContext__icontains=term) |
            Q(facing_direction__icontains=term)
        )
        screens = screens.filter(text_q)

    # Check availability + budget for each screen
    result = []
    available_count = 0
    unavailable_count = 0

    for screen in screens:
        available_slots, overlapping_bookings = _calculate_availability(screen, start, end)
        base_price = float(screen.base_price_per_slot_inr or 0)
        estimated_cost = base_price * num_days

        # Build base screen data
        screen_data = _screen_to_response(screen)
        screen_data['estimated_cost_for_period'] = estimated_cost
        screen_data['campaign_days'] = num_days

        # Attach AI profile (nested)
        screen_data['ai_profile'] = _build_ai_profile(screen)

        if available_slots <= 0:
            # No slots available
            earliest = overlapping_bookings.order_by('end_date').first()
            next_available = str(earliest.end_date) if earliest else None
            slots_freeing = earliest.booked_num_slots if earliest else 0

            screen_data['available_slots'] = 0
            screen_data['is_available'] = False
            screen_data['unavailability_reason'] = 'No slots available for the selected dates'
            screen_data['next_available_date'] = next_available
            screen_data['slots_freeing_up'] = slots_freeing
            unavailable_count += 1

        elif daily_budget < base_price:
            # Over budget
            screen_data['available_slots'] = available_slots
            screen_data['is_available'] = False
            screen_data['unavailability_reason'] = 'Exceeds budget'
            screen_data['next_available_date'] = None
            screen_data['slots_freeing_up'] = None
            unavailable_count += 1

        else:
            # Available and within budget
            screen_data['available_slots'] = available_slots
            screen_data['is_available'] = True
            screen_data['unavailability_reason'] = None
            screen_data['next_available_date'] = None
            screen_data['slots_freeing_up'] = None
            available_count += 1

        # ── SCHEDULED_BLOCK awareness ──────────────────────────────
        if screen.status == 'SCHEDULED_BLOCK' and screen.scheduled_block_date:
            screen_data['available_until'] = str(screen.scheduled_block_date)
            if end.date() > screen.scheduled_block_date:
                screen_data['block_warning'] = (
                    f"This screen is available only until {screen.scheduled_block_date}. "
                    f"You may schedule your campaign within this date range."
                )

        result.append(screen_data)

    # ── Build unavailability breakdown ─────────────────────────────
    reason_counts = {}
    for s in result:
        reason = s.get('unavailability_reason')
        if reason:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

    logger.info(
        f'Discover: {len(result)} screens found '
        f'({available_count} available, {unavailable_count} unavailable) '
        f'for locations={locations}'
    )
    if reason_counts:
        logger.info(f'Unavailability breakdown: {reason_counts}')

    # ── Determine which requested locations had no matching screens ──
    not_available = []
    for loc_entry in locations:
        tokens = _extract_tokens(loc_entry)
        if not tokens:
            tokens = [loc_entry]  # fallback to raw string
        # Check if any screen matches any token from this location
        loc_matched = False
        for screen in screens:
            screen_text = (
                f"{screen.spec_city} {screen.spec_full_address} "
                f"{screen.spec_nearest_landmark} "
                f"{screen.profiled_full_address} {screen.profiled_city}"
            ).lower()
            if any(token.lower() in screen_text for token in tokens):
                loc_matched = True
                break
        if not loc_matched:
            not_available.append(loc_entry)

    if not_available:
        logger.info(f'Locations with no matches: {not_available}')

    # Collect all search tokens for diagnostics
    all_search_tokens = []
    for loc_entry in locations:
        all_search_tokens.extend(_extract_tokens(loc_entry))

    return {
        'query': {
            'locations': locations,
            'search_tokens_used': all_search_tokens,
            'start_date': start_date_str,
            'end_date': end_date_str,
            'budget_range': budget_range,
            'campaign_days': num_days,
        },
        'total_screens_found': len(result),
        'available_screens': available_count,
        'unavailable_screens': unavailable_count,
        'not_available_locations': not_available,
        'unavailability_breakdown': reason_counts,
        'screens': result,
    }
