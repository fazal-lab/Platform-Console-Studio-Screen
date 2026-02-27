"""
Screen Sync Service
--------------------
API-based sync: fetches screens + AI profile + bookings data and
upserts into XIA's tables.

APIs used:
  API #1: GET /api/console/screens/               — all screens
  API #2: GET /api/console/screens/{id}/profile/  — per-screen AI profile
  API #3: GET /api/console/slot-bookings/         — all slot bookings
"""

import logging

import requests
from django.conf import settings

logger = logging.getLogger('xia.sync')

DEFAULT_SCREENS_API = 'http://localhost:8000/api/console/screens/'
DEFAULT_BOOKINGS_API = 'http://localhost:8000/api/console/slot-bookings/'

# API #1 field mapping: API key -> ScreenMaster field
SCREEN_RENAME_MAP = {
    'id': 'screenid',
    'city': 'spec_city',
    'latitude': 'spec_latitude',
    'longitude': 'spec_longitude',
    'full_address': 'spec_full_address',
    'nearest_landmark': 'spec_nearest_landmark',
}

# API #1 fields to skip
SCREEN_EXCLUDED = {
    'uid', 'screen_id', 'enable_surcharge',
    'last_minute_charges_json', 'proof_of_play_supported',
}


class ScreenSyncService:
    """Handles syncing screen + profile data from the console API to ScreenMaster."""

    def __init__(self):
        self.base_url = getattr(
            settings, 'XIA_SCREENS_API_URL', DEFAULT_SCREENS_API,
        ).rstrip('/')

    # ── API Fetchers ─────────────────────────────────────────────────

    def fetch_screens(self):
        """Fetch all screens from API #1."""
        url = self.base_url + '/'
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            logger.info(f'Fetched {len(data)} screens from API #1')
            return data
        except requests.RequestException as e:
            logger.error(f'Failed to fetch screens: {e}')
            raise

    def fetch_profile(self, screen_id: int) -> dict:
        """Fetch AI profile for a single screen from API #2."""
        url = f'{self.base_url}/{screen_id}/profile/'
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.warning(f'Profile fetch failed for screenid={screen_id}: {e}')
            return {}

    def fetch_bookings(self) -> list:
        """Fetch all slot bookings from API #3."""
        bookings_url = getattr(settings, 'XIA_BOOKINGS_API_URL', DEFAULT_BOOKINGS_API)
        try:
            response = requests.get(bookings_url, timeout=30)
            response.raise_for_status()
            data = response.json()
            bookings = data.get('bookings', data) if isinstance(data, dict) else data
            logger.info(f'Fetched {len(bookings)} bookings from API #3')
            return bookings
        except requests.RequestException as e:
            logger.error(f'Failed to fetch bookings: {e}')
            return []


    # ── Field Mappers ────────────────────────────────────────────────

    def map_screen_fields(self, api_data: dict) -> dict:
        """Map API #1 response item to ScreenMaster field names."""
        from xia.models import ScreenMaster
        valid_fields = {f.name for f in ScreenMaster._meta.fields}
        mapped = {}
        for key, value in api_data.items():
            if key in SCREEN_EXCLUDED:
                continue
            target_key = SCREEN_RENAME_MAP.get(key, key)
            if target_key in valid_fields:
                mapped[target_key] = value
        return mapped

    def map_profile_fields(self, profile: dict) -> dict:
        """
        Map API #2 response (nested) to ScreenMaster profile fields.
        Handles nested keys: coordinates, geoContext, area, movement,
        ringAnalysis, metadata, llmEnhancement.
        """
        if not profile:
            return {}

        coords = profile.get('coordinates', {})
        geo = profile.get('geoContext', {})
        area = profile.get('area', {})
        movement = profile.get('movement', {})
        rings = profile.get('ringAnalysis', {})
        meta = profile.get('metadata', {})
        llm = profile.get('llmEnhancement', {})

        return {
            # Location
            'profiled_latitude': coords.get('latitude'),
            'profiled_longitude': coords.get('longitude'),
            'profiled_city': geo.get('city', ''),
            'profiled_state': geo.get('state', ''),
            'profiled_country': geo.get('country', ''),
            'cityTier': geo.get('cityTier', ''),
            'profiled_full_address': geo.get('formattedAddress', ''),

            # Area
            'primaryType': area.get('primaryType', ''),
            'areaContext': area.get('context', ''),
            'confidence': area.get('confidence', ''),
            'classificationDetail': area.get('classificationDetail', ''),
            'dominantGroup': area.get('dominantGroup', ''),

            # Movement
            'movement_type': movement.get('type', ''),
            'movement_context': movement.get('context', ''),

            # Dwell
            'dwellCategory': profile.get('dwellCategory', ''),
            'dwellConfidence': profile.get('dwellConfidence'),
            'dwellScore': profile.get('dwellScore'),
            'dominanceRatio': profile.get('dominanceRatio'),

            # Ring Analysis
            'ring1': rings.get('ring1'),
            'ring2': rings.get('ring2'),
            'ring3': rings.get('ring3'),
            'reasoning': profile.get('reasoning', []),

            # Metadata
            'computedAt': meta.get('computedAt'),
            'apiCallsMade': meta.get('apiCallsMade'),
            'processingTimeMs': meta.get('processingTimeMs'),

            # LLM
            'LLMused': llm.get('used'),
            'LLMreason': llm.get('reason', ''),
            'LLMmode': llm.get('mode', ''),
        }

    # ── Sync ─────────────────────────────────────────────────────────

    def sync(self):
        """
        Full sync: fetch screens + profiles and upsert into ScreenMaster.
        Returns (created_count, updated_count, error_count).
        """
        from xia.models import ScreenMaster

        screens_data = self.fetch_screens()

        created = 0
        updated = 0
        errors = 0

        for item in screens_data:
            try:
                mapped = self.map_screen_fields(item)
                screenid = mapped.pop('screenid', None)

                if screenid is None:
                    logger.warning(f'Skipping screen with no id: {item}')
                    errors += 1
                    continue

                # Fetch and merge profile data (API #2)
                profile = self.fetch_profile(screenid)
                profile_mapped = self.map_profile_fields(profile)
                mapped.update(profile_mapped)

                _, was_created = ScreenMaster.objects.update_or_create(
                    screenid=screenid,
                    defaults=mapped,
                )

                if was_created:
                    created += 1
                else:
                    updated += 1

                logger.info(f'Synced screenid={screenid} (profile: {"yes" if profile else "no"})')

            except Exception as e:
                logger.error(f'Error syncing screen {item.get("id", "?")}: {e}')
                errors += 1

        logger.info(
            f'Sync complete: {created} created, {updated} updated, {errors} errors'
        )
        return created, updated, errors

    def sync_bookings(self):
        """
        Sync all slot bookings from API #3 into SlotBooking table.
        Returns (created_count, updated_count, error_count).
        """
        from xia.models import SlotBooking, ScreenMaster

        bookings_data = self.fetch_bookings()

        created = 0
        updated = 0
        errors = 0

        for item in bookings_data:
            try:
                booking_id = item.get('id')
                if booking_id is None:
                    errors += 1
                    continue

                # Resolve ForeignKey — screen field references ScreenMaster.screenid
                screen_ref = item.get('screen')
                screen_obj = None
                if screen_ref:
                    screen_obj = ScreenMaster.objects.filter(screenid=screen_ref).first()

                fields = {
                    'screen': screen_obj,
                    'screen_name': item.get('screen_name', ''),
                    'booked_num_slots': item.get('num_slots', 0),
                    'start_date': item.get('start_date'),
                    'end_date': item.get('end_date'),
                    'campaign_id': item.get('campaign_id', ''),
                    'user_id': item.get('user_id', ''),
                    'status': item.get('status', ''),
                    'screen_owner': item.get('source', ''),
                    'payment': item.get('payment', ''),
                    'created_at': item.get('created_at'),
                }

                _, was_created = SlotBooking.objects.update_or_create(
                    booking_id=booking_id,
                    defaults=fields,
                )

                if was_created:
                    created += 1
                else:
                    updated += 1

            except Exception as e:
                logger.error(f'Error syncing booking id={item.get("id", "?")}: {e}')
                errors += 1

        logger.info(
            f'Bookings sync complete: {created} created, {updated} updated, {errors} errors'
        )
        return created, updated, errors
