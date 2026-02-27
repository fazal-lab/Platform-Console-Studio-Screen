"""
Studio Models — Uses Console's CustomUser as AUTH_USER_MODEL.
Studio-specific models: Campaign, ScreenBundle.
"""

from django.db import models
from django.conf import settings


# ---------------------------------------------------------------------------
# Campaign
# ---------------------------------------------------------------------------

class Campaign(models.Model):
    """Single flat campaign table — filled on 'Create Campaign' submit."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    # Custom campaign ID  e.g. "SUM-CHE-001"
    campaign_id = models.CharField(
        max_length=20,
        primary_key=True,
        editable=False,
        help_text="Auto-generated: 3-letter name + 3-letter location + unique number"
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='studio_campaigns'
    )

    campaign_name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField()

    # {"screen_id": slot_count, ...}  e.g. {"scr_01": 3, "scr_02": 5}
    booked_screens = models.JSONField(
        default=dict,
        help_text='Map of screen_id → slot_count'
    )

    # {"screen_id": price_per_slot, ...}  — price at draft time
    price_snapshot = models.JSONField(
        default=dict,
        help_text='Map of screen_id → price_per_slot at booking time'
    )

    total_slots_booked = models.IntegerField(default=0)
    total_budget = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    budget_range = models.DecimalField(max_digits=12, decimal_places=2, default=0,
        help_text='Gate budget entered by user')

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    last_edited = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Campaign'
        verbose_name_plural = 'Campaigns'
        ordering = ['-created_at']

    @staticmethod
    def generate_campaign_id(campaign_name, location):
        """Generate ID like SUM-CHE-001 from name + location + sequence."""
        name_prefix = campaign_name[:3].upper().strip()
        loc_prefix = location[:3].upper().strip()
        base = f"{name_prefix}-{loc_prefix}"

        # Find the highest existing number for this prefix
        existing = Campaign.objects.filter(
            campaign_id__startswith=base
        ).order_by('-campaign_id')

        if existing.exists():
            last_id = existing.first().campaign_id
            # Extract the number after the last hyphen
            try:
                last_num = int(last_id.rsplit('-', 1)[1])
            except (ValueError, IndexError):
                last_num = 0
            next_num = last_num + 1
        else:
            next_num = 1

        return f"{base}-{next_num:03d}"

    def save(self, *args, **kwargs):
        if not self.campaign_id:
            self.campaign_id = Campaign.generate_campaign_id(
                self.campaign_name, self.location
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.campaign_id} — {self.campaign_name}"


# ---------------------------------------------------------------------------
# Screen Bundle
# ---------------------------------------------------------------------------

class ScreenBundle(models.Model):
    """
    A single bundle created on the Creative Preparation page.
    """

    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Suggestion Ready', 'Suggestion Ready'),
    ]

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name='bundles'
    )
    name = models.CharField(max_length=255)
    screen_slots = models.JSONField(
        default=list,
        help_text='List of {screen_id, screen_name, slots[]} objects'
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='Draft'
    )
    creative_suggestion_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        default=None
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Screen Bundle'
        verbose_name_plural = 'Screen Bundles'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.name} ({self.campaign_id})"
