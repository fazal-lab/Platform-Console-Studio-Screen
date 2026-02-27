from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('ops', 'Operations'),
        ('partner', 'Partner'),
    ]

    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='ops')
    company = models.ForeignKey('Company', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.email} ({self.role})"

class Company(models.Model):
    # ──────────────────────────────────────────────────────────────
    # SECTION 1 — Basic Partner Information
    # ──────────────────────────────────────────────────────────────
    COMPANY_TYPE_CHOICES = [
        ('advertiser', 'Advertiser'),
        ('partner', 'Partner'),
        ('agency', 'Agency'),
        ('dooh_network', 'DOOH Network'),
        ('franchise', 'Franchise'),
        ('internal', 'Internal'),
    ]
    STATUS_CHOICES = [
        ('onboarding', 'Onboarding'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('blocked', 'Blocked'),
    ]

    partner_id = models.CharField(max_length=20, unique=True, editable=False, blank=True, help_text="Auto-generated ID")
    name = models.CharField(max_length=255, help_text="Partner Legal Name")
    display_name = models.CharField(max_length=255, blank=True, help_text="Partner Display Name")
    company_type = models.CharField(max_length=20, choices=COMPANY_TYPE_CHOICES, default='advertiser')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='onboarding')
    is_active = models.BooleanField(default=True)
    date_joined = models.DateField(null=True, blank=True)
    contract_start_date = models.DateField(null=True, blank=True)
    contract_end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ──────────────────────────────────────────────────────────────
    # SECTION 2 — Contact Details
    # ──────────────────────────────────────────────────────────────
    primary_contact_name = models.CharField(max_length=255, blank=True)
    primary_contact_email = models.EmailField(blank=True, null=True)
    primary_contact_phone = models.CharField(max_length=20, blank=True)
    secondary_contact_name = models.CharField(max_length=255, blank=True)
    secondary_contact_email = models.EmailField(blank=True, null=True)
    escalation_contact = models.CharField(max_length=255, blank=True, help_text="For screen issues, proof failures, payment disputes, API failures")

    # Legacy fields (kept for backward compat)
    address = models.TextField(blank=True)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)

    # ──────────────────────────────────────────────────────────────
    # SECTION 3 — Business & Billing Information
    # ──────────────────────────────────────────────────────────────
    PAYMENT_CYCLE_CHOICES = [
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('campaign_based', 'Campaign-based'),
    ]
    SETTLEMENT_MODEL_CHOICES = [
        ('revenue_share', 'Revenue Share'),
        ('fixed_rental', 'Fixed Rental'),
        ('hybrid', 'Hybrid'),
    ]

    gst_number = models.CharField(max_length=20, blank=True)
    pan_number = models.CharField(max_length=15, blank=True)
    billing_company_name = models.CharField(max_length=255, blank=True)
    billing_address = models.TextField(blank=True)
    billing_city = models.CharField(max_length=100, blank=True)
    billing_state = models.CharField(max_length=100, blank=True)
    billing_pincode = models.CharField(max_length=10, blank=True)
    billing_country = models.CharField(max_length=100, blank=True, default='India')
    bank_account_name = models.CharField(max_length=255, blank=True)
    bank_account_number = models.CharField(max_length=30, blank=True)
    ifsc_code = models.CharField(max_length=15, blank=True)
    bank_name = models.CharField(max_length=255, blank=True)
    payment_cycle = models.CharField(max_length=20, choices=PAYMENT_CYCLE_CHOICES, blank=True)
    revenue_share_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fixed_cpm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Fixed CPM (optional)")
    settlement_model = models.CharField(max_length=20, choices=SETTLEMENT_MODEL_CHOICES, blank=True)

    # ──────────────────────────────────────────────────────────────
    # SECTION 4 — Integration Details (API Layer)
    # ──────────────────────────────────────────────────────────────
    API_ACCESS_MODE_CHOICES = [
        ('push', 'Push'),
        ('pull', 'Pull'),
    ]
    PROOF_OF_PLAY_MODE_CHOICES = [
        ('realtime', 'Real-time'),
        ('batch', 'Batch'),
        ('manual_upload', 'Manual Upload'),
    ]

    api_key = models.CharField(max_length=255, blank=True)
    api_secret = models.CharField(max_length=255, blank=True)
    api_version = models.CharField(max_length=20, blank=True)
    api_access_mode = models.CharField(max_length=10, choices=API_ACCESS_MODE_CHOICES, blank=True)
    base_api_url = models.URLField(blank=True)
    webhook_url = models.URLField(blank=True)
    webhook_secret = models.CharField(max_length=255, blank=True)
    proof_of_play_mode = models.CharField(max_length=20, choices=PROOF_OF_PLAY_MODE_CHOICES, blank=True)
    last_api_sync_at = models.DateTimeField(null=True, blank=True)

    # ──────────────────────────────────────────────────────────────
    # SECTION 5 — Screen Capability Metadata
    # ──────────────────────────────────────────────────────────────
    default_slot_duration = models.IntegerField(null=True, blank=True, help_text="10 / 15 / 30 seconds")
    supports_dynamic_creative = models.BooleanField(default=False)
    supports_dayparting = models.BooleanField(default=False)
    supports_geo_trigger = models.BooleanField(default=False)
    supports_pop_api = models.BooleanField(default=False, help_text="Supports Proof of Play API")
    max_screens_allowed = models.IntegerField(null=True, blank=True)
    max_concurrent_campaigns = models.IntegerField(null=True, blank=True)

    # ──────────────────────────────────────────────────────────────
    # SECTION 6 — Operational Settings
    # ──────────────────────────────────────────────────────────────
    INVENTORY_VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('private', 'Private'),
        ('restricted', 'Restricted'),
    ]

    auto_approve_screens = models.BooleanField(default=False)
    manual_verification_required = models.BooleanField(default=True)
    auto_block_on_api_failure = models.BooleanField(default=False)
    inventory_visibility = models.CharField(max_length=20, choices=INVENTORY_VISIBILITY_CHOICES, blank=True, default='public')

    # ──────────────────────────────────────────────────────────────
    # SECTION 7 — Compliance & Documents Upload
    # ──────────────────────────────────────────────────────────────
    agreement_copy = models.FileField(upload_to='partner_docs/agreements/', null=True, blank=True)
    gst_certificate = models.FileField(upload_to='partner_docs/gst/', null=True, blank=True)
    bank_proof = models.FileField(upload_to='partner_docs/bank/', null=True, blank=True)
    kyc_document = models.FileField(upload_to='partner_docs/kyc/', null=True, blank=True)
    insurance_document = models.FileField(upload_to='partner_docs/insurance/', null=True, blank=True)

    # ──────────────────────────────────────────────────────────────
    # SECTION 8 — Risk & Monitoring
    # ──────────────────────────────────────────────────────────────
    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES, blank=True, default='low')
    sla_type = models.CharField(max_length=100, blank=True)
    sla_response_time_hours = models.IntegerField(null=True, blank=True)
    blacklist_flag = models.BooleanField(default=False)
    internal_rating = models.IntegerField(null=True, blank=True, help_text="Rating 1-5")

    # ──────────────────────────────────────────────────────────────
    # SECTION 9 — Internal Controls
    # ──────────────────────────────────────────────────────────────
    internal_notes = models.TextField(blank=True)
    account_manager = models.CharField(max_length=255, blank=True)
    region_manager = models.CharField(max_length=255, blank=True)
    created_by = models.CharField(max_length=255, blank=True)
    last_updated_by = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name_plural = "Companies"

    def save(self, *args, **kwargs):
        # Auto-generate partner_id if not set
        # Format: PTR_[TYPE_CODE]_[SEQ] e.g., PTR_ADV_001, PTR_PAR_001, PTR_DOH_001
        if not self.partner_id:
            type_codes = {
                'advertiser': 'ADV',
                'partner': 'PAR',
                'agency': 'AGY',
                'dooh_network': 'DOH',
                'franchise': 'FRN',
                'internal': 'INT',
            }
            type_code = type_codes.get(self.company_type, 'COM')
            
            # Get next sequence number for this company type
            existing_count = Company.objects.filter(company_type=self.company_type).count()
            seq_num = str(existing_count + 1).zfill(3)
            
            self.partner_id = f"PTR_{type_code}_{seq_num}"
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.partner_id})"

class Locality(models.Model):
    VERIFICATION_STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    name = models.CharField(max_length=255)
    screen_id = models.BigIntegerField(unique=True, null=True, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        default='pending'
    )
    
    # Technical Specs
    display_size = models.CharField(max_length=100, blank=True)
    pixel_pitch = models.CharField(max_length=50, blank=True)
    brightness = models.CharField(max_length=50, blank=True)
    
    # Location Info
    latitude = models.DecimalField(max_digits=15, decimal_places=10, null=True, blank=True)
    longitude = models.DecimalField(max_digits=15, decimal_places=10, null=True, blank=True)
    address = models.TextField(blank=True)
    
    # AI/Profiling Data
    ai_tags = models.JSONField(default=dict, blank=True)
    ai_profiled_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Localities"

    def __str__(self):
        return f"{self.name} ({self.screen_id})"

class ScreenSpec(models.Model):
    # --- Step 1: Identifiers & Location ---
    screen_name = models.CharField(max_length=255, unique=True, null=True, blank=True)
    
    ROLE_CHOICES = [
        ('xigi', 'Xigi'),
        ('partner', 'Partner'),
        ('franchise', 'Franchise'),
    ]
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, blank=True, default='', help_text="Screen ownership role")
    admin_name = models.CharField(max_length=100, blank=True, help_text="Name of the user who created this screen")
    
    PROFILE_STATUS_CHOICES = [
        ('UNPROFILED', 'Unprofiled'),
        ('PROFILED', 'Profiled'),
        ('REPROFILE', 'Reprofile'),
    ]
    profile_status = models.CharField(max_length=20, choices=PROFILE_STATUS_CHOICES, default='UNPROFILED')
    
    city = models.CharField(max_length=100, null=True, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    full_address = models.TextField(blank=True)
    nearest_landmark = models.CharField(max_length=255, blank=True)
    
    # --- Step 2: Display Specs ---
    TECHNOLOGY_CHOICES = [
        ('LED', 'LED'),
    ]
    technology = models.CharField(max_length=50, choices=TECHNOLOGY_CHOICES, default='LED')

    ENVIRONMENT_CHOICES = [
        ('Indoor', 'Indoor'),
        ('Outdoor', 'Outdoor'),
    ]
    environment = models.CharField(max_length=50, choices=ENVIRONMENT_CHOICES, default='Indoor')

    SCREEN_TYPE_CHOICES = [
        ('Video Wall', 'Video Wall'),
        ('transparent_led', 'Transparent LED'),
        ('flexible_led', 'Flexible LED'),
        ('interactive_led', 'Interactive LED'),
        ('van_led', 'Van LED'),
        ('standee_led', 'Standee LED'),
    ]
    screen_type = models.CharField(max_length=100, default='Video Wall', help_text="e.g. Video Wall, Transparent LED, or Custom")
    screen_width = models.DecimalField(max_digits=6, decimal_places=2, help_text="Width in meters", null=True, blank=True)
    screen_height = models.DecimalField(max_digits=6, decimal_places=2, help_text="Height in meters", null=True, blank=True)
    resolution_width = models.IntegerField(help_text="Pixels", null=True, blank=True)
    resolution_height = models.IntegerField(help_text="Pixels", null=True, blank=True)
    
    orientation = models.CharField(max_length=20, choices=[('LANDSCAPE', 'Landscape'), ('PORTRAIT', 'Portrait')], default='LANDSCAPE')
    
    # Step 2: Additional display specs (matching frontend field names exactly)
    pixel_pitch_mm = models.CharField(max_length=20, blank=True, help_text="e.g. P0.9, P2.5")
    brightness_nits = models.IntegerField(null=True, blank=True, help_text="Brightness in nits")
    refresh_rate_hz = models.IntegerField(null=True, blank=True, help_text="Refresh rate in Hz")
    
    # --- Step 3: Installation & Visibility ---
    installation_type = models.CharField(max_length=100, blank=True, help_text="e.g. Rooftop, Wall Mount, Vehicle")
    mounting_height_ft = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    facing_direction = models.CharField(max_length=100, blank=True, help_text="e.g. North, Towards Police Station")
    road_type = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. Highway, Arterial, or Custom")
    traffic_direction = models.CharField(max_length=50, blank=True, null=True)
    
    # --- Step 4: Playback ---
    standard_ad_duration_sec = models.IntegerField(default=10, help_text="Default slot duration")
    total_slots_per_loop = models.IntegerField(default=12)
    loop_length_sec = models.CharField(max_length=20, blank=True, help_text="e.g. 0:30 format")
    reserved_slots = models.IntegerField(default=0, help_text="Slots kept for owner")
    supported_formats_json = models.JSONField(default=list, blank=True, help_text="Supported formats e.g. ['JPG', 'MP4']")
    max_file_size_mb = models.CharField(max_length=20, blank=True, help_text="e.g. 25 MB")
    
    # Step 4: Connectivity & Ops
    internet_type = models.CharField(max_length=50, blank=True)
    average_bandwidth_mbps = models.CharField(max_length=50, blank=True)
    POWER_BACKUP_CHOICES = [
        ('UPS Only', 'UPS Only'),
        ('Generator Only', 'Generator Only'),
        ('UPS + Generator', 'UPS + Generator'),
        ('None', 'None'),
    ]
    power_backup_type = models.CharField(max_length=50, blank=True, choices=POWER_BACKUP_CHOICES)
    
    days_active_per_week = models.IntegerField(default=7, help_text="Number of active days")
    downtime_windows = models.CharField(max_length=255, blank=True, help_text="e.g. 10:00 PM - 06:00 AM")
    
    audio_supported = models.BooleanField(default=False)
    backup_internet = models.BooleanField(default=False)
    
    # --- Step 5: Commercials ---
    base_price_per_slot_inr = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    minimum_booking_days = models.CharField(max_length=20, blank=True)
    
    seasonal_pricing = models.BooleanField(default=False)
    seasons_json = models.JSONField(default=list, blank=True, help_text="Array of {season, adjustment_type, adjustment_pct}")
    
    enable_min_booking = models.BooleanField(default=False)
    surcharge_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    restricted_categories_json = models.JSONField(default=list, blank=True)
    sensitive_zone_flags_json = models.JSONField(default=list, blank=True)
    
    # --- Step 6: Compliance (Proof & Monitoring) ---
    cms_type = models.CharField(max_length=50, blank=True)
    cms_api = models.CharField(max_length=255, blank=True, help_text="CMS API endpoint")
    
    ai_camera_installed = models.BooleanField(default=False)
    screen_health_ping = models.BooleanField(default=False)

    playback_logs = models.BooleanField(default=False)
    is_profiled = models.BooleanField(default=False)
    ai_camera_api = models.CharField(max_length=255, blank=True, help_text="AI Camera API endpoint")
    
    # Step 6: Documents & GST
    ownership_proof_uploaded = models.FileField(upload_to='compliance/ownership/', null=True, blank=True)
    permission_noc_available = models.FileField(upload_to='compliance/noc/', null=True, blank=True)
    
    # Screen Images (3 specific views)
    screen_image_front = models.ImageField(upload_to='screens/front/', null=True, blank=True)
    screen_image_back = models.ImageField(upload_to='screens/back/', null=True, blank=True)
    screen_image_long = models.ImageField(upload_to='screens/long/', null=True, blank=True)
    
    gst = models.CharField(max_length=50, blank=True)
    content_policy_accepted = models.BooleanField(default=False)
    
    current_step = models.IntegerField(default=1, help_text="Last completed/active step in onboarding")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    SOURCE_CHOICES = [
        ('INTERNAL', 'Internal'),
        ('EXTERNAL', 'External'),
    ]
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='INTERNAL', help_text="Where the screen data came from")

    status = models.CharField(max_length=20, default='DRAFT', choices=[
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('PENDING', 'Pending'),
        ('VERIFIED', 'Verified'),
        ('REJECTED', 'Rejected'),
        ('RESUBMITTED', 'Resubmitted'),
        ('SCHEDULED_BLOCK', 'Scheduled Block'),
        ('BLOCKED', 'Blocked'),
    ])
    scheduled_block_date = models.DateField(
        null=True, blank=True,
        help_text="Date when SCHEDULED_BLOCK screen will auto-transition to BLOCKED"
    )
    remarks = models.TextField(blank=True, default='', help_text="Review remarks (rejection reason, etc.)")
    reviewed_by = models.CharField(max_length=100, blank=True, default='', help_text="Who reviewed this screen")

    def __str__(self):
        return f"{self.screen_name} ({self.city})"

class AdSlot(models.Model):
    locality = models.ForeignKey(Locality, related_name='ad_slots', on_delete=models.CASCADE)
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_seconds = models.IntegerField(default=15)
    price_per_shot = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.locality.name} - {self.start_time} to {self.end_time}"

class Campaign(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_approval', 'Pending Approval'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ]

    company = models.ForeignKey(Company, related_name='campaigns', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField()
    budget = models.DecimalField(max_digits=15, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.status})"

class CampaignLocation(models.Model):
    campaign = models.ForeignKey(Campaign, related_name='locations', on_delete=models.CASCADE)
    locality = models.ForeignKey(Locality, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, default='pending')  # Individual location status
    
    def __str__(self):
        return f"{self.campaign.name} @ {self.locality.name}"

class Creative(models.Model):
    VALIDATION_STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    campaign = models.ForeignKey(Campaign, related_name='creatives', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    file_url = models.URLField()
    thumbnail_url = models.URLField(blank=True, null=True)
    media_type = models.CharField(max_length=20)  # image/video
    
    validation_status = models.CharField(max_length=20, choices=VALIDATION_STATUS_CHOICES, default='pending')
    validation_remarks = models.TextField(blank=True)
    validated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.validation_status}"

class PlaybackLog(models.Model):
    locality = models.ForeignKey(Locality, on_delete=models.CASCADE)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    creative = models.ForeignKey(Creative, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
    duration = models.IntegerField(help_text="Duration in seconds")
    
    class Meta:
        indexes = [
            models.Index(fields=['timestamp', 'locality']),
        ]

class Ticket(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    user = models.ForeignKey(CustomUser, related_name='created_tickets', on_delete=models.CASCADE)
    assigned_to = models.ForeignKey(CustomUser, related_name='assigned_tickets', on_delete=models.SET_NULL, null=True, blank=True)
    
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"TK#{self.id} - {self.title}"

class Dispute(models.Model):
    ticket = models.OneToOneField(Ticket, on_delete=models.CASCADE)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    reason = models.TextField()
    evidence_payload = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

class AuditLog(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=255)
    component = models.CharField(max_length=100)  # e.g., 'Inventory', 'Profiling', 'Auth'
    target_id = models.CharField(max_length=100, blank=True, null=True)
    payload = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.timestamp} - {self.user} - {self.action}"


class SlotBooking(models.Model):
    """Tracks slot bookings per screen with date ranges for time-bound availability."""
    STATUS_CHOICES = [
        ('HOLD', 'Hold'),
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled'),
        ('DELETED', 'Deleted'),
    ]
    SOURCE_CHOICES = [
        ('XIGI', 'Xigi Platform Booking'),
        ('PARTNER', 'Partner Direct Block'),
    ]
    PAYMENT_CHOICES = [
        ('UNPAID', 'Unpaid'),
        ('PAID', 'Paid'),
    ]

    screen = models.ForeignKey(ScreenSpec, on_delete=models.CASCADE, related_name='slot_bookings')
    num_slots = models.IntegerField(help_text="Number of slots booked")
    start_date = models.DateField(help_text="Booking start date")
    end_date = models.DateField(help_text="Booking end date")
    campaign_id = models.CharField(max_length=100, blank=True, help_text="Campaign reference")
    user_id = models.CharField(max_length=100, blank=True, help_text="Advertiser identifier")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='HOLD')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='XIGI', help_text="Who created this booking")
    payment = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default='UNPAID', help_text="Payment status")
    notes = models.TextField(blank=True, default='', help_text="Reason for booking. Partners describe why, Xigi bookings say 'Xigi Campaigns'.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.screen.screen_name} | {self.num_slots} slots | {self.start_date} to {self.end_date} | {self.status} | {self.payment}"


class CampaignAsset(models.Model):
    """One row = one slot on one screen for one campaign. Tracks upload + validation."""
    
    VALIDATION_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('passed', 'Passed'),
        ('failed', 'Failed'),
        ('warning', 'Warning'),
    ]
    
    ASSET_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('uploaded', 'Uploaded'),
        ('validated', 'Validated'),
        ('approved', 'Approved'),
        ('live', 'Live'),
    ]

    # ── Campaign & Screen Reference ──
    campaign_id = models.CharField(max_length=100, help_text="Campaign ID string e.g. SUM-CHE-001")
    screen_id = models.IntegerField(help_text="Screen ID from ScreenSpec (cross-ref, not Django FK)")
    screen_name = models.CharField(max_length=255, blank=True, default='')
    screen_location = models.CharField(max_length=255, blank=True, default='')
    slot_number = models.IntegerField(help_text="Slot number on this screen (1, 2, 3...)")

    # ── Screen Constraint Snapshot (captured at manifest creation) ──
    req_resolution_width = models.IntegerField(default=0)
    req_resolution_height = models.IntegerField(default=0)
    req_orientation = models.CharField(max_length=20, blank=True, default='')
    req_max_duration_sec = models.IntegerField(default=0)
    req_max_file_size_mb = models.IntegerField(default=0)
    req_supported_formats = models.JSONField(default=list)  # ["MP4", "AVI", "PNG"]
    req_audio_supported = models.BooleanField(default=False)

    # ── Uploaded File Details ──
    file = models.FileField(upload_to='campaign_assets/', blank=True, null=True)
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    file_size_bytes = models.BigIntegerField(blank=True, null=True)
    file_type = models.CharField(max_length=100, blank=True, null=True)  # "video/mp4"
    file_extension = models.CharField(max_length=20, blank=True, null=True)  # "mp4"

    # ── Validation Check Results (True = passed, False = failed/not checked) ──
    is_file_format = models.BooleanField(default=False, help_text="File format matches supported formats")
    is_file_size = models.BooleanField(default=False, help_text="File size within max limit")
    is_video_duration = models.BooleanField(default=False, help_text="Video duration within max limit")
    is_resolution = models.BooleanField(default=False, help_text="Resolution matches required specs")
    is_orientation = models.BooleanField(default=False, help_text="Orientation matches required specs")

    # ── Validation Results ──
    validation_status = models.CharField(
        max_length=20, choices=VALIDATION_STATUS_CHOICES, default='pending'
    )
    validation_errors = models.JSONField(blank=True, null=True)
    validated_at = models.DateTimeField(blank=True, null=True)

    # ── Resubmission tracking ──
    is_resubmission = models.BooleanField(default=False, help_text="True if this file was re-uploaded after a rejection")

    # ── Status & Timestamps ──
    status = models.CharField(max_length=20, choices=ASSET_STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('campaign_id', 'screen_id', 'slot_number')]
        ordering = ['screen_id', 'slot_number']

    def __str__(self):
        return f"Campaign {self.campaign_id} → Screen {self.screen_id} Slot {self.slot_number}"
