from django import forms
from django.utils.safestring import mark_safe


class DatalistWidget(forms.TextInput):
    """
    Custom widget that renders an input with HTML5 datalist for autocomplete.
    Users can either type freely or select from suggestions.
    """
    
    def __init__(self, choices=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.choices = choices or []
    
    def render(self, name, value, attrs=None, renderer=None):
        # Add the list attribute to link to datalist
        if attrs is None:
            attrs = {}
        attrs['list'] = f'{name}_datalist'
        attrs['autocomplete'] = 'off'
        
        # Render the text input
        text_input = super().render(name, value, attrs, renderer)
        
        # Create datalist with options
        options = ''.join([f'<option value="{choice}">' for choice in self.choices])
        datalist = f'<datalist id="{name}_datalist">{options}</datalist>'
        
        return mark_safe(f'{text_input}{datalist}')


# Predefined suggestion lists for each field
SCREEN_TYPE_SUGGESTIONS = ['LED', 'LCD', 'Projection', 'OLED', 'Digital Kiosk', 'Video Wall']
INSTALLATION_TYPE_SUGGESTIONS = ['Rooftop', 'Wall Mounted', 'Pole Mounted', 'Ground Level', 'Indoor Mall', 'Indoor Airport', 'Indoor Station', 'Indoor Other']
FACING_DIRECTION_SUGGESTIONS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West']
ROAD_TYPE_SUGGESTIONS = ['Highway', 'Arterial', 'Collector', 'Local', 'Internal', 'Flyover', 'Signal Junction']
TRAFFIC_DIRECTION_SUGGESTIONS = ['One Way', 'Both Ways']
OBSTRUCTION_RISK_SUGGESTIONS = ['None', 'Low', 'Medium', 'High']
CMS_TYPE_SUGGESTIONS = ['Xigi CMS', 'Partner CMS', 'Custom CMS', 'No CMS']
PARTNER_CMS_BRAND_SUGGESTIONS = ['Broadsign', 'Scala', 'Signagelive', 'Screenly', 'Novastar', 'Colorlight']
INTERNET_TYPE_SUGGESTIONS = ['Fiber', 'Broadband', '4G', '5G', 'WiFi', 'Starlink', 'Ethernet']
POWER_BACKUP_SUGGESTIONS = ['None', 'UPS', 'Generator', 'UPS + Generator', 'Solar', 'Battery']
BOOKING_TYPE_SUGGESTIONS = ['Solo', 'Bundle Only', 'Both', 'Premium Only']
CAMERA_MODEL_SUGGESTIONS = ['Quividi', 'AdMobilize', 'Linkett', 'Hikvision', 'Custom']
