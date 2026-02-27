"""
XIA Admin
---------
"""

from django.contrib import admin

from .models import ScreenMaster


@admin.register(ScreenMaster)
class ScreenMasterAdmin(admin.ModelAdmin):
    list_display = [
        'screenid', 'screen_name', 'company_name', 'spec_city',
        'technology', 'status', 'is_profiled', 'synced_at',
    ]
    list_filter = ['status', 'technology', 'environment', 'is_profiled', 'source']
    search_fields = ['screen_name', 'company_name', 'spec_city', 'gst']
    readonly_fields = ['synced_at']
    ordering = ['screenid']
