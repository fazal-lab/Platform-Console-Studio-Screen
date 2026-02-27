"""
XIA Models
----------
Single source of truth tables for the Xigi Platform.
"""

from django.db import models


class ScreenMaster(models.Model):
    """
    Unified screen table — single source of truth.
    Synced from: GET /api/console/screens/
    Sync method: Django Signals (real-time) + API fallback.
    """

    # ── Identification ──────────────────────────────────────────────
    screenid = models.IntegerField(
        unique=True,
        help_text='Source screen ID (mapped from api.id)',
    )
    company_name = models.CharField(max_length=255, blank=True, default='')
    partner_name = models.CharField(max_length=255, null=True, blank=True)
    admin_name = models.CharField(
        max_length=255, null=True, blank=True,
        help_text='Reserved for future use',
    )
    screen_name = models.CharField(max_length=255, blank=True, default='')
    role = models.CharField(max_length=50, blank=True, default='')

    # ── Location (spec_ prefix) ─────────────────────────────────────
    spec_city = models.CharField(max_length=255, blank=True, default='')
    spec_latitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True,
    )
    spec_longitude = models.DecimalField(
        max_digits=11, decimal_places=7, null=True, blank=True,
    )
    spec_full_address = models.TextField(blank=True, default='')
    spec_nearest_landmark = models.CharField(max_length=255, blank=True, default='')

    # ── Hardware Specs ──────────────────────────────────────────────
    technology = models.CharField(max_length=50, blank=True, default='')
    environment = models.CharField(max_length=50, blank=True, default='')
    screen_type = models.CharField(max_length=100, blank=True, default='')
    screen_width = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
    )
    screen_height = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
    )
    resolution_width = models.IntegerField(null=True, blank=True)
    resolution_height = models.IntegerField(null=True, blank=True)
    orientation = models.CharField(max_length=20, blank=True, default='')
    pixel_pitch_mm = models.CharField(max_length=20, blank=True, default='')
    brightness_nits = models.IntegerField(null=True, blank=True)
    refresh_rate_hz = models.IntegerField(null=True, blank=True)
    installation_type = models.CharField(max_length=50, blank=True, default='')
    mounting_height_ft = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
    )
    facing_direction = models.CharField(max_length=255, blank=True, default='')
    road_type = models.CharField(max_length=100, null=True, blank=True)
    traffic_direction = models.CharField(max_length=100, null=True, blank=True)

    # ── Scheduling & Slots ──────────────────────────────────────────
    standard_ad_duration_sec = models.IntegerField(default=15)
    total_slots_per_loop = models.IntegerField(default=1)
    loop_length_sec = models.CharField(max_length=20, blank=True, default='')
    reserved_slots = models.IntegerField(default=0)

    # ── Media & Connectivity ────────────────────────────────────────
    supported_formats_json = models.JSONField(default=list, blank=True)
    max_file_size_mb = models.CharField(max_length=20, blank=True, default='')
    internet_type = models.CharField(max_length=50, blank=True, default='')
    average_bandwidth_mbps = models.CharField(max_length=20, blank=True, default='')
    power_backup_type = models.CharField(max_length=50, blank=True, default='')

    # ── Operations ──────────────────────────────────────────────────
    days_active_per_week = models.IntegerField(default=7)
    downtime_windows = models.CharField(max_length=100, blank=True, default='')
    audio_supported = models.BooleanField(default=False)
    backup_internet = models.BooleanField(default=False)

    # ── Pricing ─────────────────────────────────────────────────────
    base_price_per_slot_inr = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
    )
    minimum_booking_days = models.CharField(max_length=10, blank=True, default='')
    seasonal_pricing = models.BooleanField(default=False)
    seasons_json = models.JSONField(default=list, blank=True)
    enable_min_booking = models.BooleanField(default=False)
    surcharge_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
    )

    # ── Content Restrictions ────────────────────────────────────────
    restricted_categories_json = models.JSONField(default=list, blank=True)
    sensitive_zone_flags_json = models.JSONField(default=list, blank=True)

    # ── CMS & Monitoring ────────────────────────────────────────────
    cms_type = models.CharField(max_length=50, blank=True, default='')
    cms_api = models.CharField(max_length=500, blank=True, default='')
    ai_camera_installed = models.BooleanField(default=False)
    screen_health_ping = models.BooleanField(default=False)
    playback_logs = models.BooleanField(default=False)
    ai_camera_api = models.CharField(max_length=500, blank=True, default='')

    # ── Compliance & Media ──────────────────────────────────────────
    ownership_proof_uploaded = models.CharField(max_length=500, blank=True, default='')
    permission_noc_available = models.CharField(max_length=500, blank=True, default='')
    screen_image_front = models.CharField(max_length=500, blank=True, default='')
    screen_image_back = models.CharField(max_length=500, blank=True, default='')
    screen_image_long = models.CharField(max_length=500, blank=True, default='')
    gst = models.CharField(max_length=50, blank=True, default='')
    content_policy_accepted = models.BooleanField(default=False)

    # ── Status & Meta ───────────────────────────────────────────────
    source = models.CharField(max_length=50, blank=True, default='')
    remarks = models.TextField(blank=True, default='')
    reviewed_by = models.CharField(max_length=255, blank=True, default='')
    current_step = models.IntegerField(default=0)
    status = models.CharField(max_length=50, blank=True, default='')
    scheduled_block_date = models.DateField(
        null=True, blank=True,
        help_text='Date when SCHEDULED_BLOCK screen will auto-transition to BLOCKED',
    )
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)
    is_profiled = models.BooleanField(default=False)
    profile_status = models.CharField(max_length=50, blank=True, default='')

    # ── AI Profile (API #2) — Location ──────────────────────────────
    profiled_latitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True,
    )
    profiled_longitude = models.DecimalField(
        max_digits=11, decimal_places=7, null=True, blank=True,
    )
    profiled_city = models.CharField(max_length=255, blank=True, default='')
    profiled_state = models.CharField(max_length=255, blank=True, default='')
    profiled_country = models.CharField(max_length=100, blank=True, default='')
    cityTier = models.CharField(max_length=50, blank=True, default='')
    profiled_full_address = models.TextField(blank=True, default='')

    # ── AI Profile (API #2) — Area Classification ────────────────────
    primaryType = models.CharField(max_length=100, blank=True, default='')
    areaContext = models.TextField(blank=True, default='')
    confidence = models.CharField(max_length=20, blank=True, default='')
    classificationDetail = models.CharField(max_length=100, blank=True, default='')
    dominantGroup = models.CharField(max_length=100, blank=True, default='')

    # ── AI Profile (API #2) — Movement ──────────────────────────────
    movement_type = models.CharField(max_length=50, blank=True, default='')
    movement_context = models.CharField(max_length=255, blank=True, default='')

    # ── AI Profile (API #2) — Dwell ──────────────────────────────────
    dwellCategory = models.CharField(max_length=50, blank=True, default='')
    dwellConfidence = models.FloatField(null=True, blank=True)
    dwellScore = models.FloatField(null=True, blank=True)
    dominanceRatio = models.FloatField(null=True, blank=True)

    # ── AI Profile (API #2) — Ring Analysis ─────────────────────────
    ring1 = models.JSONField(null=True, blank=True)
    ring2 = models.JSONField(null=True, blank=True)
    ring3 = models.JSONField(null=True, blank=True)
    reasoning = models.JSONField(default=list, blank=True)

    # ── AI Profile (API #2) — Metadata ──────────────────────────────
    computedAt = models.DateTimeField(null=True, blank=True)
    apiCallsMade = models.IntegerField(null=True, blank=True)
    processingTimeMs = models.IntegerField(null=True, blank=True)

    # ── AI Profile (API #2) — LLM Enhancement ───────────────────────
    LLMused = models.BooleanField(null=True, blank=True)
    LLMreason = models.CharField(max_length=255, blank=True, default='')
    LLMmode = models.CharField(max_length=50, blank=True, default='')

    # ── XIA Internal ────────────────────────────────────────────────

    synced_at = models.DateTimeField(
        auto_now=True,
        help_text='Last time this row was synced from source',
    )

    class Meta:
        db_table = 'xia_screen_master'
        ordering = ['screenid']
        verbose_name = 'Screen (Master)'
        verbose_name_plural = 'Screens (Master)'

    def __str__(self):
        return f'[{self.screenid}] {self.screen_name}'


class SlotBooking(models.Model):
    """
    Slot booking records per screen.
    Synced from: GET /api/console/slot-bookings/
    One screen can have many bookings (one-to-many).
    """

    # ── Identification ───────────────────────────────────────────────
    booking_id = models.IntegerField(
        unique=True,
        help_text='Source booking ID (mapped from api.id)',
    )
    screen = models.ForeignKey(
        ScreenMaster,
        on_delete=models.CASCADE,
        related_name='bookings',
        to_field='screenid',
        db_column='screenid',
        null=True, blank=True,
    )
    screen_name = models.CharField(max_length=255, blank=True, default='')

    # ── Booking Details ──────────────────────────────────────────────
    booked_num_slots = models.IntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    campaign_id = models.CharField(max_length=255, blank=True, default='')
    user_id = models.CharField(max_length=255, blank=True, default='')

    # ── Status ───────────────────────────────────────────────────────
    status = models.CharField(max_length=50, blank=True, default='')
    screen_owner = models.CharField(max_length=100, blank=True, default='')
    payment = models.CharField(max_length=50, blank=True, default='')

    # ── Meta ─────────────────────────────────────────────────────────
    created_at = models.DateTimeField(null=True, blank=True)
    synced_at = models.DateTimeField(
        auto_now=True,
        help_text='Last time this row was synced from source',
    )

    class Meta:
        db_table = 'xia_slot_booking'
        ordering = ['-created_at']
        verbose_name = 'Slot Booking'
        verbose_name_plural = 'Slot Bookings'

    def __str__(self):
        return f'[{self.booking_id}] {self.screen_name} | {self.campaign_id}'


class ChatSession(models.Model):
    """
    XIA chat session — one row per session.
    session_id is generated by XIA on the first message.
    All messages stored as a JSON array in the `messages` field.
    """

    session_id = models.UUIDField(
        unique=True, editable=False,
        help_text='Auto-generated by XIA on first message',
    )
    user_id = models.CharField(
        max_length=255,
        help_text='Advertiser user ID (from Studio)',
    )
    campaign_id = models.CharField(
        max_length=255,
        help_text='Campaign ID this chat belongs to (from Studio)',
    )

    # Gateway params snapshot (initial values — may be modified by XIA)
    gateway_start_date = models.CharField(max_length=20, blank=True, default='')
    gateway_end_date = models.CharField(max_length=20, blank=True, default='')
    gateway_location = models.JSONField(default=list, blank=True)
    gateway_budget_range = models.CharField(max_length=50, blank=True, default='')

    # Current effective filters (gateway + XIA modifications)
    active_filters = models.JSONField(
        default=dict, blank=True,
        help_text='Current filters applied by XIA on top of gateway',
    )

    # ── Call #1 output fields (updated on every message) ────────

    # Persona detection
    detected_persona = models.CharField(
        max_length=20, blank=True, default='',
        help_text='agency or business_owner — auto-detected by Call #1',
    )
    persona_confidence = models.FloatField(
        default=0.0,
        help_text='Confidence score 0.0-1.0 for persona stability (anti-flickering)',
    )

    # Campaign context (extracted by Call #1 over multiple messages)
    ad_category = models.CharField(
        max_length=100, blank=True, default='',
        help_text='What user is advertising: healthcare, alcohol, etc.',
    )
    product_category = models.CharField(
        max_length=50, blank=True, default='',
        help_text='One of 12 master groups: fashion_apparel, jewellery_luxury, etc.',
    )
    brand_objective = models.CharField(
        max_length=30, blank=True, default='',
        help_text='awareness, store_visit, product_launch, or offer_based',
    )
    target_audience = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Who the ad targets: young professionals, families, students, etc.',
    )

    # Discovery pipeline state
    discovery_complete = models.BooleanField(
        default=False,
        help_text='True when all 3 core questions answered (ad_category, brand_objective, target_audience)',
    )

    # Previous filters snapshot (for revert support)
    previous_filters = models.JSONField(
        default=dict, blank=True,
        help_text='Snapshot of active_filters before last change, used for revert intent',
    )

    # Pending gateway edits (needs user approval before applying)
    pending_gateway_edits = models.JSONField(
        default=dict, blank=True,
        help_text='Gateway changes awaiting user confirmation',
    )

    # Question queue (Call #1 queues questions, shows ONE at a time)
    pending_questions = models.JSONField(
        default=list, blank=True,
        help_text='Questions queued by Call #1 — shown one at a time',
    )

    # Question attempt counter (skip questions asked 2+ times)
    question_attempts = models.JSONField(
        default=dict, blank=True,
        help_text='Tracks how many times each question topic was asked: {"ad_category": 1, "audience": 2}',
    )

    # ── Session restore fields (persisted for GET /xia/chat/<session_id>/) ───
    last_intent = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Last detected intent from Call #1',
    )
    last_quick_replies = models.JSONField(
        default=list, blank=True,
        help_text='Last quick_replies from Call #3',
    )
    last_question_to_ask = models.CharField(
        max_length=500, blank=True, default='',
        help_text='Last question_to_ask for the user',
    )

    # ── Live monitoring (persisted for debug page monitor mode) ───
    last_turn_debug = models.JSONField(
        default=dict, blank=True,
        help_text='Full debug meta from the most recent turn (call1/2/3 meta, discover, screens, etc.)',
    )

    # All messages in this session — single JSON array
    # Format: [{"role": "user"|"assistant", "content": "...", "timestamp": "...", "screens_returned": [...], "filters_applied": {...}}]
    messages = models.JSONField(
        default=list, blank=True,
        help_text='Conversation history as JSON array',
    )

    # ── Live Mode fields ─────────────────────────────────────────
    mode = models.CharField(
        max_length=10, default='normal',
        help_text='Session mode: "normal" (gateway flow) or "live" (context-aware)',
    )
    last_page_context = models.JSONField(
        default=dict, blank=True,
        help_text='Last page_context sent by Studio (page, page_label, summary, data)',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'xia_chat_session'
        ordering = ['-created_at']
        verbose_name = 'Chat Session'
        verbose_name_plural = 'Chat Sessions'

    def __str__(self):
        return f'[{self.session_id}] user={self.user_id} campaign={self.campaign_id}'
