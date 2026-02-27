from django.db import models


class ScreenProfile(models.Model):
    """
    AI profiling result for a screen location.
    One profile per screen — re-profiling overwrites the existing row.
    Every field from the profiler response has its own column — no JSON blobs for flat data.
    """

    # ── Link ──
    screen = models.OneToOneField(
        'console.ScreenSpec',
        on_delete=models.CASCADE,
        related_name='ai_profile',
        help_text="One-to-one link to the screen"
    )

    # ── Input ──
    latitude = models.DecimalField(max_digits=12, decimal_places=9)
    longitude = models.DecimalField(max_digits=12, decimal_places=9)
    mode = models.CharField(max_length=20, default='hybrid', help_text="hybrid or rules")

    # ── Geographic Context (geoContext) ──
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    city_tier = models.CharField(max_length=20, blank=True)
    formatted_address = models.TextField(blank=True)

    # ── Area Classification (area) ──
    primary_type = models.CharField(max_length=50, blank=True, help_text="e.g. MIXED_BIASED, COMMERCIAL")
    area_context = models.CharField(max_length=255, blank=True, help_text="e.g. Mixed Use (primarily Banking / Finance Zone)")
    confidence = models.CharField(max_length=20, blank=True, help_text="high, medium, low")
    classification_detail = models.CharField(max_length=100, blank=True, help_text="e.g. STRONG_BIAS_TOWARD_FINANCE")
    dominant_group = models.CharField(max_length=50, blank=True, help_text="e.g. FINANCE, RETAIL")

    # ── Movement ──
    movement_type = models.CharField(max_length=50, blank=True, help_text="e.g. SLOW_FLOW, PEDESTRIAN")
    movement_context = models.CharField(max_length=255, blank=True, help_text="e.g. Internal Connector Road")

    # ── Dwell ──
    dwell_category = models.CharField(max_length=50, blank=True, help_text="e.g. MEDIUM_WAIT")
    dwell_confidence = models.FloatField(null=True, blank=True)
    dwell_score = models.FloatField(null=True, blank=True)

    # ── Dominance ──
    dominance_ratio = models.FloatField(null=True, blank=True)

    # ── Ring Analysis (complex nested objects → JSON) ──
    ring1_analysis = models.JSONField(null=True, blank=True, help_text="Ring 1: authority detection (r=75m)")
    ring2_analysis = models.JSONField(null=True, blank=True, help_text="Ring 2: area classification (r=450-500m)")
    ring3_analysis = models.JSONField(null=True, blank=True, help_text="Ring 3: movement context (r=200m)")

    # ── Reasoning (array of step strings → JSON) ──
    reasoning = models.JSONField(default=list, blank=True, help_text="Step-by-step reasoning logs")

    # ── LLM Enhancement ──
    llm_used = models.BooleanField(default=False)
    llm_reason = models.CharField(max_length=100, blank=True, help_text="e.g. RULES_SUFFICIENT")
    llm_mode = models.CharField(max_length=20, blank=True, help_text="hybrid or rules")

    # ── Metadata ──
    profiled_at = models.DateTimeField(null=True, blank=True, help_text="When the engine computed this")
    api_calls_made = models.IntegerField(default=0)
    cached = models.BooleanField(default=False)
    processing_time_ms = models.IntegerField(null=True, blank=True)
    api_key_configured = models.BooleanField(default=True)
    warnings = models.JSONField(default=list, blank=True)
    version = models.CharField(max_length=20, blank=True)

    # ── Timestamps ──
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'screen_ai_profiles'
        verbose_name = "Screen AI Profile"
        verbose_name_plural = "Screen AI Profiles"

    def __str__(self):
        return f"{self.screen} - {self.primary_type} ({self.city})"

    def to_response_dict(self):
        """Reconstruct the API response format from individual columns."""
        return {
            "coordinates": {
                "latitude": float(self.latitude),
                "longitude": float(self.longitude),
            },
            "geoContext": {
                "city": self.city,
                "state": self.state,
                "country": self.country,
                "cityTier": self.city_tier,
                "formattedAddress": self.formatted_address,
            },
            "area": {
                "primaryType": self.primary_type,
                "context": self.area_context,
                "confidence": self.confidence,
                "classificationDetail": self.classification_detail,
                "dominantGroup": self.dominant_group,
            },
            "movement": {
                "type": self.movement_type,
                "context": self.movement_context,
            },
            "dwellCategory": self.dwell_category,
            "dwellConfidence": self.dwell_confidence,
            "dwellScore": self.dwell_score,
            "dominanceRatio": self.dominance_ratio,
            "ringAnalysis": {
                "ring1": self.ring1_analysis,
                "ring2": self.ring2_analysis,
                "ring3": self.ring3_analysis,
            },
            "reasoning": self.reasoning,
            "metadata": {
                "computedAt": self.profiled_at.isoformat() if self.profiled_at else None,
                "apiCallsMade": self.api_calls_made,
                "cached": self.cached,
                "processingTimeMs": self.processing_time_ms,
                "apiKeyConfigured": self.api_key_configured,
                "warnings": self.warnings,
                "version": self.version,
            },
            "primaryType": self.primary_type,
            "areaContext": self.area_context,
            "movementType": self.movement_type,
            "llmEnhancement": {
                "used": self.llm_used,
                "reason": self.llm_reason,
                "mode": self.llm_mode,
            },
        }
