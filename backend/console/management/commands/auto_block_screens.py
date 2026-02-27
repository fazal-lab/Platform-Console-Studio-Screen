"""
Management command: auto_block_screens

Finds all ScreenSpec records with status=SCHEDULED_BLOCK whose
scheduled_block_date has passed (i.e., <= today) and flips them to BLOCKED.

Usage:
    python manage.py auto_block_screens

Schedule via Windows Task Scheduler or Linux cron to run daily at midnight.
"""
from datetime import date
from django.core.management.base import BaseCommand
from console.models import ScreenSpec


class Command(BaseCommand):
    help = 'Auto-flip SCHEDULED_BLOCK screens to BLOCKED when their scheduled_block_date has passed.'

    def handle(self, *args, **options):
        today = date.today()

        # Find screens that are past their scheduled block date
        due_screens = ScreenSpec.objects.filter(
            status='SCHEDULED_BLOCK',
            scheduled_block_date__lte=today
        )

        count = due_screens.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No screens to block today.'))
            return

        # Flip them all to BLOCKED
        updated = due_screens.update(status='BLOCKED')
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Blocked {updated} screen(s) that were scheduled to block on or before {today}.'
            )
        )

        # Print details
        for screen in ScreenSpec.objects.filter(status='BLOCKED', scheduled_block_date__lte=today):
            self.stdout.write(f'   → [{screen.id}] {screen.screen_name} (scheduled: {screen.scheduled_block_date})')
