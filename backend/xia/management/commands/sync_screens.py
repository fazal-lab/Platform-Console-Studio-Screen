"""
Management command: sync_screens
---------------------------------
Fetches all screens + profiles + bookings from the console API
and syncs everything into XIA tables in one shot.

Usage:
    python manage.py sync_screens
"""

from django.core.management.base import BaseCommand

from xia.services.sync_service import ScreenSyncService


class Command(BaseCommand):
    help = 'Sync screens + profiles + bookings from console API into XIA tables'

    def handle(self, *args, **options):
        service = ScreenSyncService()

        # ── API #1 + #2: Screens + Profiles ──────────────────────────
        self.stdout.write('Starting screen sync...')
        try:
            created, updated, errors = service.sync()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Screens — {created} created, {updated} updated, {errors} errors'
                )
            )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Screen sync failed: {e}'))
            return

        # ── API #3: Slot Bookings ─────────────────────────────────────
        self.stdout.write('Starting bookings sync...')
        try:
            bc, bu, be = service.sync_bookings()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Bookings — {bc} created, {bu} updated, {be} errors'
                )
            )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Bookings sync failed: {e}'))
