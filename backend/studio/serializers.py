from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Campaign, ScreenBundle

User = get_user_model()


# ---------------------------------------------------------------------------
# Auth serializers
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    
    company_name = serializers.CharField(write_only=True, required=True, max_length=255)
    confirm_password = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'confirm_password', 'phone', 'company_name']
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        company_name = validated_data.pop('company_name', '')
        
        user = User.objects.create_user(**validated_data)
        # Note: Console's company field is a FK to Company model.
        # Studio registration stores the company name but doesn't link to a Company object.
        # Company linking can be handled by admin later.
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for login."""
    email = serializers.EmailField()
    password = serializers.CharField()


class VerifyCodeSerializer(serializers.Serializer):
    """Serializer for code verification."""
    email = serializers.EmailField()
    code = serializers.CharField()


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer for password reset."""
    email = serializers.EmailField()
    new_password = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user profile."""
    
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'phone', 'company', 'is_staff', 'is_superuser']
        read_only_fields = ['id', 'email']


# ---------------------------------------------------------------------------
# Campaign
# ---------------------------------------------------------------------------

class CampaignSerializer(serializers.ModelSerializer):
    """Serializer for the flat Campaign model."""

    class Meta:
        model = Campaign
        fields = [
            'campaign_id', 'user', 'campaign_name', 'location',
            'start_date', 'end_date', 'booked_screens', 'price_snapshot',
            'total_slots_booked', 'total_budget', 'budget_range',
            'status', 'created_at', 'last_edited',
        ]
        read_only_fields = ['campaign_id', 'user', 'created_at', 'last_edited']


# ---------------------------------------------------------------------------
# Screen Bundle
# ---------------------------------------------------------------------------

class ScreenBundleSerializer(serializers.ModelSerializer):
    """Serializer for the flat ScreenBundle model."""

    class Meta:
        model = ScreenBundle
        fields = [
            'id', 'campaign', 'name', 'screen_slots',
            'status', 'creative_suggestion_url', 'created_at',
        ]
        read_only_fields = ['id', 'campaign', 'created_at']

