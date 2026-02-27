"""
XIA Tests
---------
"""

from django.test import TestCase


class XiaAppTest(TestCase):
    """Basic smoke tests for the XIA app."""

    def test_app_config(self):
        """Verify the app config loads correctly."""
        from xia.apps import XiaConfig
        self.assertEqual(XiaConfig.name, 'xia')
        self.assertEqual(XiaConfig.verbose_name, 'XIA - Xigi Intelligence Agent')

    def test_health_endpoint(self):
        """Verify the health check endpoint responds."""
        response = self.client.get('/xia/health/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['app'], 'xia')
