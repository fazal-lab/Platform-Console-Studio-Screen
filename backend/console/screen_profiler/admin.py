from django.contrib import admin
from .models import ScreenProfile


@admin.register(ScreenProfile)
class ScreenProfileAdmin(admin.ModelAdmin):
    list_display = ('screen', 'city', 'primary_type', 'confidence', 'movement_type', 'dwell_category', 'mode', 'created_at')
    list_filter = ('mode', 'city_tier', 'primary_type', 'confidence', 'llm_used')
    search_fields = ('city', 'state', 'primary_type', 'area_context', 'formatted_address')
    readonly_fields = ('created_at', 'updated_at', 'ring1_analysis', 'ring2_analysis', 'ring3_analysis', 'reasoning')

    fieldsets = (
        ('Screen', {
            'fields': ('screen',)
        }),
        ('Input', {
            'fields': ('latitude', 'longitude', 'mode')
        }),
        ('Geographic Context', {
            'fields': ('city', 'state', 'country', 'city_tier', 'formatted_address')
        }),
        ('Area Classification', {
            'fields': ('primary_type', 'area_context', 'confidence', 'classification_detail', 'dominant_group')
        }),
        ('Movement & Dwell', {
            'fields': ('movement_type', 'movement_context', 'dwell_category', 'dwell_confidence', 'dwell_score', 'dominance_ratio')
        }),
        ('Ring Analysis (JSON)', {
            'fields': ('ring1_analysis', 'ring2_analysis', 'ring3_analysis'),
            'classes': ('collapse',)
        }),
        ('Reasoning', {
            'fields': ('reasoning',),
            'classes': ('collapse',)
        }),
        ('LLM Enhancement', {
            'fields': ('llm_used', 'llm_reason', 'llm_mode')
        }),
        ('Metadata', {
            'fields': ('profiled_at', 'api_calls_made', 'cached', 'processing_time_ms', 'api_key_configured', 'warnings', 'version', 'created_at', 'updated_at'),
        }),
    )
