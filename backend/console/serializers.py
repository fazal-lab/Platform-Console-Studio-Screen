from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Locality, Company, AdSlot, Campaign, Creative, Ticket, Dispute, ScreenSpec, AuditLog, PlaybackLog, SlotBooking, CampaignAsset

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'role', 'phone', 'company', 'company_name', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User.objects.create_user(
            email=validated_data.pop('email'),
            password=password,
            **validated_data
        )
        return user

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'
        read_only_fields = ('partner_id', 'created_at', 'updated_at')


class LocalitySerializer(serializers.ModelSerializer):
    cms_brand = serializers.CharField(source='screen_spec_pack.cms_brand', read_only=True)
    cms_api_endpoint = serializers.URLField(source='screen_spec_pack.cms_api_endpoint', read_only=True)

    class Meta:
        model = Locality
        fields = '__all__'

class AdSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdSlot
        fields = '__all__'

class CampaignSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    
    class Meta:
        model = Campaign
        fields = '__all__'

class CreativeSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='campaign.company.name', read_only=True)
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)

    class Meta:
        model = Creative
        fields = '__all__'

class TicketSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    assigned_to_email = serializers.EmailField(source='assigned_to.email', read_only=True)
    
    class Meta:
        model = Ticket
        fields = '__all__'

class DisputeSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    partner_name = serializers.CharField(source='campaign.company.name', read_only=True)
    ticket_id = serializers.CharField(source='ticket.id', read_only=True)
    ticket_status = serializers.CharField(source='ticket.status', read_only=True)

    class Meta:
        model = Dispute
        fields = '__all__'

class ScreenSpecSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()
    partner_name = serializers.SerializerMethodField()

    class Meta:
        model = ScreenSpec
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def get_company_name(self, obj):
        if obj.role:
            return obj.role
        return "Independent"

    def get_partner_name(self, obj):
        if obj.admin_name:
            return obj.admin_name
        return "PartnerX"

class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = '__all__'

class PlaybackLogSerializer(serializers.ModelSerializer):
    locality_name = serializers.CharField(source='locality.name', read_only=True)
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    creative_name = serializers.CharField(source='creative.name', read_only=True)

    class Meta:
        model = PlaybackLog
        fields = '__all__'

class VerificationSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['APPROVED', 'REJECTED', 'VERIFIED'])
    remarks = serializers.CharField(required=False, allow_blank=True)


class SlotBookingSerializer(serializers.ModelSerializer):
    screen_name = serializers.CharField(source='screen.screen_name', read_only=True)

    class Meta:
        model = SlotBooking
        fields = '__all__'
        read_only_fields = ('created_at', 'source', 'status', 'payment')


class CampaignAssetSerializer(serializers.ModelSerializer):
    """Serializer for CampaignAsset — read/write all fields."""

    class Meta:
        model = CampaignAsset
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class FileUploadSerializer(serializers.Serializer):
    """Serializer for multipart file upload to a specific slot."""
    file = serializers.FileField()
    screen_id = serializers.IntegerField()
    slot_number = serializers.IntegerField()
