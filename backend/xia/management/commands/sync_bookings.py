"""
Management Command: sync_bookings
----------------------------------
Fetches all slot bookings from API #3 and upserts into xia_slot_booking.

Usage:
    python manage.py sync_bookings
"""

from django.core.management.base import BaseCommand

from xia.services.sync_service import ScreenSyncService


class Command(BaseCommand):
    help = 'Sync slot bookings from the console API into xia_slot_booking'

    def handle(self, *args, **options):
        self.stdout.write('Starting bookings sync...')
        svc = ScreenSyncService()
        created, updated, errors = svc.sync_bookings()
        self.stdout.write(
            self.style.SUCCESS(
                f'Sync complete — {created} created, {updated} updated, {errors} errors'
            )
        )
