from django.apps import AppConfig


class XiaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'xia'
    verbose_name = 'XIA - Xigi Intelligence Agent'

    def ready(self):
        """Connect Django signals for real-time sync on app startup."""
        from xia.signals import connect_screen_signals
        connect_screen_signals()
