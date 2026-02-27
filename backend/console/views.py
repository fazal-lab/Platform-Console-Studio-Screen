from rest_framework import views, status, response, permissions, viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone
from .models import Locality, Company, Campaign, Creative, Ticket, Dispute, AuditLog, ScreenSpec, CustomUser, PlaybackLog, SlotBooking, CampaignAsset
from .screen_profiler.models import ScreenProfile
from .serializers import (
    UserSerializer, LocalitySerializer, VerificationSerializer,
    CompanySerializer, CampaignSerializer, CreativeSerializer,
    TicketSerializer, DisputeSerializer, ScreenSpecSerializer,
    AuditLogSerializer, PlaybackLogSerializer, SlotBookingSerializer,
    CampaignAssetSerializer, FileUploadSerializer
)
import subprocess
import mimetypes
import json
import os
from datetime import date
from .utils import log_action
# from .services.area_context_service import get_area_context_service  # Temporarily commented - services folder missing

class AdminLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '')
        password = request.data.get('password')

        # Domain normalization: Allow both .in and .com for xigi
        if email.endswith('@xigi.in'):
            email = email.replace('@xigi.in', '@xigi.com')
        
        user = authenticate(email=email, password=password)

        if user:
            if user.role not in ['admin', 'ops']:
                return response.Response(
                    {"error": "Access denied. Admin or Ops role required."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            refresh = RefreshToken.for_user(user)
            log_action(user, "User Login", "Auth", request=request)
            return response.Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data
            })
        return response.Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED
        )

class PartnerLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '')
        password = request.data.get('password')
        
        user = authenticate(email=email, password=password)

        if user:
            # Only allow Partners to login here
            if user.role.lower() != 'partner':
                return response.Response(
                    {"error": "Access denied. Partner account required."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            refresh = RefreshToken.for_user(user)
            log_action(user, "Partner Login", "Auth", request=request)
            return response.Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data
            })
        return response.Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED
        )

class UserViewSet(viewsets.ModelViewSet):
    """
    Module A2: Users and Roles management.
    """
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Send welcome email for partner users
        raw_password = request.data.get('password', '')
        if user.role == 'partner' and user.email:
            self._send_welcome_email(user, raw_password)

        headers = self.get_success_headers(serializer.data)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def _send_welcome_email(self, user, raw_password):
        """Send a professional welcome email to a new partner user."""
        from django.core.mail import send_mail
        from django.conf import settings

        partner_name = user.username or user.email.split('@')[0]
        company_name = ''
        if user.company:
            company_name = user.company.name

        subject = 'Welcome to Xigi — Your Partner Dashboard is Ready'

        message = (
            f"Dear {partner_name},\n\n"
            f"Greetings from Xigi!\n\n"
            f"We are pleased to inform you that your partner account has been successfully created. "
            f"You can now access your dedicated dashboard to manage your screens, campaigns, insights, and more.\n\n"
            f"Here are your login credentials:\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"  Dashboard : http://localhost:5173/\n"
            f"  Email     : {user.email}\n"
            f"  Password  : {raw_password}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"Please log in at the earliest and explore your dashboard. "
            f"We recommend changing your password after your first login for security.\n\n"
            f"If you have any questions or need assistance, feel free to reach out to our team.\n\n"
            f"Warm regards,\n"
            f"Team Xigi\n"
            f"support@xigi.in\n"
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            print(f"✅ Welcome email sent to {user.email}")
        except Exception as e:
            print(f"⚠️ Failed to send welcome email to {user.email}: {e}")

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        """
        POST /api/console/users/<pk>/reset-password/
        Body: { "new_password": "..." }
        Sets a new password for the user.
        """
        user = self.get_object()
        new_password = request.data.get('new_password', '').strip()
        if not new_password or len(new_password) < 6:
            return response.Response(
                {'error': 'Password must be at least 6 characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.set_password(new_password)
        user.save()
        return response.Response({'message': f'Password reset successfully for {user.email}.'})

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Module A3: Audit Log Viewer.
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer

class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all().order_by('-created_at')
    serializer_class = CompanySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class ScreenInventoryView(views.APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        status_filter = request.query_params.get('status')
        if status_filter:
            screens = ScreenSpec.objects.filter(status=status_filter)
        else:
            screens = ScreenSpec.objects.all()
        serializer = ScreenSpecSerializer(screens, many=True)
        return response.Response(serializer.data)

class ScreenVerifyView(views.APIView):
    def post(self, request, pk):
        try:
            screen = ScreenSpec.objects.get(pk=pk)
        except ScreenSpec.DoesNotExist:
            return response.Response(status=status.HTTP_404_NOT_FOUND)

        serializer = VerificationSerializer(data=request.data)
        if serializer.is_valid():
            # Map APPROVED → VERIFIED for internal consistency
            status_map = {
                'APPROVED': 'VERIFIED',
                'REJECTED': 'REJECTED',
                'VERIFIED': 'VERIFIED',
            }
            old_status = screen.status
            new_status = serializer.validated_data['status']
            screen.status = status_map.get(new_status, new_status)
            screen.remarks = serializer.validated_data.get('remarks', '')
            screen.reviewed_by = request.data.get('reviewed_by', 'Console Admin')
            screen.save()
            
            log_action(
                user=request.user,
                action=f"Changed verification status from {old_status} to {new_status}",
                component="Inventory",
                target_id=screen.id,
                payload={"remarks": serializer.validated_data.get('remarks')},
                request=request
            )
            return response.Response(ScreenSpecSerializer(screen).data)
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ScreenVerifyBodyView(views.APIView):
    """
    POST endpoint for verify/reject screens.
    Accepts screen_id in request body instead of URL path.
    Body: { screen_id, status, remarks, reviewed_by }
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        screen_id = request.data.get('screen_id')
        new_status = request.data.get('status')
        remarks = request.data.get('remarks', '')
        reviewed_by = request.data.get('reviewed_by', '')

        if not screen_id:
            return response.Response(
                {"error": "screen_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            screen = ScreenSpec.objects.get(pk=screen_id)
        except ScreenSpec.DoesNotExist:
            return response.Response(
                {"error": "Not Found", "message": f"Screen with id {screen_id} does not exist"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Map APPROVED → VERIFIED for internal consistency
        status_map = {
            'APPROVED': 'VERIFIED',
            'REJECTED': 'REJECTED',
            'VERIFIED': 'VERIFIED',
        }
        old_status = screen.status
        mapped_status = status_map.get(new_status, new_status)
        screen.status = mapped_status
        screen.remarks = remarks
        screen.reviewed_by = reviewed_by
        screen.save()

        return response.Response({
            "message": f"Screen '{screen.screen_name}' has been {new_status} successfully.",
            "screen_id": screen.id,
            "screen_name": screen.screen_name,
            "city": screen.city,
            "admin_name": screen.admin_name,
            "previous_status": old_status,
            "new_status": mapped_status,
            "remarks": remarks,
            "reviewed_by": reviewed_by,
            "reviewed_at": screen.updated_at,
        }, status=status.HTTP_200_OK)

class ScreenProfileView(views.APIView):
    """
    Module E: Profiling operations - The "Truth" layer.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            profile = ScreenProfile.objects.get(screen_id=pk)
            return response.Response(profile.to_response_dict())
        except ScreenProfile.DoesNotExist:
            return response.Response(
                {"error": "Profile not found for this screen"},
                status=status.HTTP_404_NOT_FOUND
            )

    def post(self, request, pk):
        log_action(request.user, "Triggered Profiling Engine", "Profiling", target_id=pk, request=request)
        return response.Response({"status": "Profiling engine job triggered"}, status=status.HTTP_202_ACCEPTED)

class PlaybackLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Module H: Proof & Monitoring - Delivery Truth.
    """
    queryset = PlaybackLog.objects.all()
    serializer_class = PlaybackLogSerializer
    filterset_fields = ['locality', 'campaign']

class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [permissions.AllowAny]

class CreativeViewSet(viewsets.ModelViewSet):
    queryset = Creative.objects.all()
    serializer_class = CreativeSerializer

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(
            user=self.request.user,
            action=f"Updated creative validation to {instance.validation_status}",
            component="CreativeOps",
            target_id=instance.id,
            request=self.request
        )

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer

class DisputeViewSet(viewsets.ModelViewSet):
    queryset = Dispute.objects.all()
    serializer_class = DisputeSerializer

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        dispute = self.get_object()
        
        # 1. Update Dispute Status
        dispute.status = 'Resolved'
        dispute.save()
        
        # 2. Close Related Ticket
        if hasattr(dispute, 'ticket'):
            ticket = dispute.ticket
            ticket.status = 'Closed'
            ticket.save()
            
        # 3. Log Audit
        log_action(
            user=request.user,
            action=f"Resolved Dispute {dispute.id} for Campaign {dispute.campaign.name}",
            component="Disputes",
            target_id=dispute.id,
            payload={"resolution_notes": request.data.get('notes', 'Resolved via Console')},
            request=request
        )
        
        return response.Response({'status': 'dispute resolved', 'ticket_status': 'closed'})


class IntelligenceView(views.APIView):
    def get(self, request):
        total_screens = Locality.objects.count()
        approved_screens = Locality.objects.filter(verification_status='approved').count()
        total_campaigns = Campaign.objects.count()
        
        return response.Response({
            "network_size": total_screens,
            "verification_rate": (approved_screens / total_screens * 100) if total_screens > 0 else 0,
            "campaign_count": total_campaigns,
            "data_freshness": timezone.now()
        })

class ScreenSpecViewset(viewsets.ModelViewSet):
    """
    API endpoint that allows Screen Specs to be viewed or edited.

    GET Query Params:
      - city: filter by city (case-insensitive partial match)
      - role: filter by role (xigi/partner/franchise)
      - screen_name: filter by screen name (partial match)
      - screen_id: filter by screen_id field (exact match)
      - status: filter by status (e.g. VERIFIED, PENDING)
      - environment: filter by environment (Indoor/Outdoor)
    """
    queryset = ScreenSpec.objects.all().order_by('-created_at')
    serializer_class = ScreenSpecSerializer
    permission_classes = [permissions.AllowAny]

    def perform_update(self, serializer):
        instance = self.get_object()
        # If the screen was already profiled, any update puts it into 'REPROFILE' state
        if instance.profile_status in ['PROFILED', 'REPROFILE']:
            serializer.save(profile_status='REPROFILE')
        else:
            serializer.save()

    def get_queryset(self):
        qs = super().get_queryset()

        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(city__icontains=city)

        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role__iexact=role)

        screen_name = self.request.query_params.get('screen_name')
        if screen_name:
            qs = qs.filter(screen_name__icontains=screen_name)

        screen_id = self.request.query_params.get('screen_id')
        if screen_id:
            qs = qs.filter(screen_id=screen_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)

        environment = self.request.query_params.get('environment')
        if environment:
            qs = qs.filter(environment__iexact=environment)

        return qs

class CmsSyncMonitorView(views.APIView):
    """
    Module J: CMS Sync & Execution Monitoring.
    """
    def get(self, request):
        # Mocking sync status as per PRD for v1
        # Success and fail counts from orchestration logs
        return response.Response({
            "sync_health": "Stable",
            "last_sync_time": timezone.now(),
            "success_count": 1240,
            "fail_count": 12,
            "retry_queue_size": 2
        })


class ExternalScreenSubmissionView(views.APIView):
    """
    POST endpoint for receiving screen data from external partner websites.
    
    External screens arrive with status='PENDING' and source='EXTERNAL'.
    They must be verified by an admin before AI profiling can be triggered.
    
    Flow: External Submit → PENDING → Admin Verifies → AI Profile
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk=None):
        """
        GET — Partner fetches their screens.
        
        If pk is provided (e.g. /screens/external-submit/42/),
        returns a single screen by ID.
        
        Otherwise returns a list with optional query params:
          ?uid=CHN-TNG-002       → filter by partner UID
          ?status=PENDING        → filter by status
        """
        # ── Single screen by ID ──
        if pk is not None:
            try:
                screen = ScreenSpec.objects.get(id=pk)
            except ScreenSpec.DoesNotExist:
                return response.Response({
                    "message": f"Screen with id {pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)
            serializer = ScreenSpecSerializer(screen)
            return response.Response(serializer.data, status=status.HTTP_200_OK)

        # ── List screens ──
        screens = ScreenSpec.objects.all()

        # Auto-flip any SCHEDULED_BLOCK screens whose date has passed → BLOCKED
        from datetime import date as _date
        _today = _date.today()
        expired = screens.filter(status='SCHEDULED_BLOCK', scheduled_block_date__lte=_today)
        if expired.exists():
            expired.update(status='BLOCKED', scheduled_block_date=None)
            # Re-fetch to get updated data
            screens = ScreenSpec.objects.all()

        status_filter = request.query_params.get('status')
        if status_filter:
            screens = screens.filter(status__iexact=status_filter)

        serializer = ScreenSpecSerializer(screens, many=True)
        return response.Response({
            "total": screens.count(),
            "screens": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data.copy()

        # ── Strip fields we don't store ──
        for field in ['id', 'enable_downtime']:
            data.pop(field, None)

        # ── Handle file URL fields ──
        # Partner sends full URLs for documents; extract relative path after /media/
        for doc_field in ['ownership_proof_uploaded', 'permission_noc_available']:
            val = data.get(doc_field, '')
            if isinstance(val, str) and '/media/' in val:
                # Extract path after /media/ → e.g. "compliance/ownership/file.pdf"
                data[doc_field] = val.split('/media/')[-1]

        # ── Auto-fill CMS API when cms_type is Xigi CMS ──
        cms_type = (data.get('cms_type') or '').strip().lower()
        if cms_type in ('xigi cms', 'xigi'):
            data['cms_api'] = 'https://in.vnnox.com/'

        # ── Force external submission defaults ──
        data['status'] = 'PENDING'
        data['source'] = 'EXTERNAL'
        data['is_profiled'] = False
        data['profile_status'] = 'UNPROFILED'

        # ── Resubmission: If a REJECTED screen with the same name exists, update it ──
        screen_name = data.get('screen_name', '').strip()
        existing_screen = None
        if screen_name:
            try:
                existing_screen = ScreenSpec.objects.get(
                    screen_name__iexact=screen_name,
                    status='REJECTED'
                )
            except ScreenSpec.DoesNotExist:
                existing_screen = None

        if existing_screen:
            # Clear previous rejection remarks on resubmission
            data['remarks'] = ''
            data['reviewed_by'] = ''
            data['status'] = 'RESUBMITTED'  # Distinct status so admin can see it was resubmitted
            serializer = ScreenSpecSerializer(existing_screen, data=data, partial=False)
            if serializer.is_valid():
                screen = serializer.save()
                return response.Response({
                    "message": "Screen resubmitted successfully. Pending re-verification.",
                    "id": screen.id,
                    "status": screen.status,
                    "source": screen.source,
                    "resubmission": True,
                }, status=status.HTTP_200_OK)
            return response.Response({
                "message": "Resubmission validation failed. Please check the submitted data.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── New submission ──
        serializer = ScreenSpecSerializer(data=data)
        if serializer.is_valid():
            screen = serializer.save()
            return response.Response({
                "message": "Screen submitted successfully. Pending verification.",
                "id": screen.id,
                "status": screen.status,
                "source": screen.source,
            }, status=status.HTTP_201_CREATED)
        
        return response.Response({
            "message": "Validation failed. Please check the submitted data.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, pk=None):
        """
        PUT — Update an existing screen by ID.
        e.g. PUT /screens/external-submit/49/
        """
        if pk is None:
            return response.Response({
                "message": "Screen ID is required. Use /screens/external-submit/<id>/"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            screen = ScreenSpec.objects.get(id=pk)
        except ScreenSpec.DoesNotExist:
            return response.Response({
                "message": f"Screen with id {pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()

        # ── Field remapping ──
        if 'partner_id' in data:
            data['uid'] = data.pop('partner_id')

        # ── Strip fields we don't allow updating ──
        for field in ['id', 'enable_downtime']:
            data.pop(field, None)

        # ── Handle file URL fields ──
        for doc_field in ['ownership_proof_uploaded', 'permission_noc_available']:
            val = data.get(doc_field, '')
            if isinstance(val, str) and '/media/' in val:
                data[doc_field] = val.split('/media/')[-1]

        # ── Auto-fill CMS API when cms_type is Xigi CMS ──
        cms_type = (data.get('cms_type') or '').strip().lower()
        if cms_type in ('xigi cms', 'xigi'):
            data['cms_api'] = 'https://in.vnnox.com/'

        serializer = ScreenSpecSerializer(screen, data=data, partial=True)
        if serializer.is_valid():
            updated_screen = serializer.save()
            return response.Response({
                "message": "Screen updated successfully.",
                "screen_id": updated_screen.id,
                "screen_name": updated_screen.screen_name,
                "uid": updated_screen.uid,
                "status": updated_screen.status,
            }, status=status.HTTP_200_OK)

        return response.Response({
            "message": "Validation failed. Please check the submitted data.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk=None):
        """
        DELETE — Remove an existing screen by ID.
        e.g. DELETE /screens/external-submit/49/
        """
        if pk is None:
            return response.Response({
                "message": "Screen ID is required. Use /screens/external-submit/<id>/"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            screen = ScreenSpec.objects.get(id=pk)
        except ScreenSpec.DoesNotExist:
            return response.Response({
                "message": f"Screen with id {pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        screen_id = screen.id
        screen_name = screen.screen_name
        screen.delete()

        return response.Response({
            "message": f"Screen #{screen_id} ({screen_name}) deleted successfully.",
        }, status=status.HTTP_200_OK)


def _expire_stale_hold_bookings():
    """
    Auto-expire HOLD bookings older than 10 minutes.
    Only applies to XIGI-sourced bookings — PARTNER bookings are never auto-expired.
    Called from every booking-related operation to ensure stale holds
    are cleaned up whenever availability is checked.
    """
    from datetime import timedelta
    expiry_cutoff = timezone.now() - timedelta(minutes=10)
    SlotBooking.objects.filter(
        status='HOLD',
        payment='UNPAID',
        source='XIGI',          # ← PARTNER bookings are NEVER auto-expired
        created_at__lte=expiry_cutoff
    ).update(status='EXPIRED')


def _calculate_screen_availability(screen, start_date, end_date):
    """
    Shared utility: calculate how many slots are available on a screen
    for a given date range. Used by both ScreenDiscoveryView and CapacityCheckView.
    
    Also auto-expires stale HOLD bookings before calculating.
    Returns (available_slots, overlapping_bookings_queryset)
    """
    _expire_stale_hold_bookings()

    from django.db.models import Sum
    overlapping_bookings = screen.slot_bookings.filter(
        status__in=['ACTIVE', 'HOLD'],
        start_date__lte=end_date,
        end_date__gte=start_date,
    )
    booked_in_period = overlapping_bookings.aggregate(total=Sum('num_slots'))['total'] or 0
    available_slots = screen.total_slots_per_loop - screen.reserved_slots - booked_in_period
    return available_slots, overlapping_bookings





class ScreenDiscoveryView(views.APIView):
    """
    POST endpoint for advertisers to discover available screens.
    
    Accepts:
      - location: city name (string) OR list of city names (required)
                   Also supports comma-separated string: "Chennai, Theni"
      - start_date: campaign start date (required)
      - end_date: campaign end date (required)
      - budget_range: max total budget in INR (required)
    
    Filters (applied in order):
      1. Only VERIFIED + AI-profiled screens
      2. City matches any of the given locations (case-insensitive)
      3. Available slots > 0 (total_slots - reserved_slots - booked_slots > 0)
      4. Budget check: base_price_per_slot × number_of_days <= budget_range
    
    Returns matching screens with all relevant details + ai_profile.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        location_raw = request.data.get('location', '')
        start_date = request.data.get('start_date', '')
        end_date = request.data.get('end_date', '')
        budget_range = request.data.get('budget_range', '')

        # ── Normalize location to a list of entries ──
        # Each entry is one location query (could be a city or a full address)
        if isinstance(location_raw, list):
            locations = [str(loc).strip() for loc in location_raw if str(loc).strip()]
        elif isinstance(location_raw, str) and location_raw.strip():
            locations = [location_raw.strip()]
        else:
            locations = []

        # ── Validate required fields ──
        errors = {}
        if not locations:
            errors['location'] = 'This field is required. Provide a city name or list of locations.'
        if not start_date:
            errors['start_date'] = 'This field is required.'
        if not end_date:
            errors['end_date'] = 'This field is required.'
        if not budget_range:
            errors['budget_range'] = 'This field is required.'
        
        if errors:
            return response.Response({
                "message": "Missing required fields.",
                "errors": errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Parse dates and calculate number of days ──
        from datetime import datetime
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            num_days = (end - start).days
            if num_days <= 0:
                return response.Response({
                    "message": "end_date must be after start_date.",
                }, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return response.Response({
                "message": "Invalid date format. Use YYYY-MM-DD.",
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Parse budget ──
        try:
            budget = float(budget_range)
        except (ValueError, TypeError):
            return response.Response({
                "message": "budget_range must be a number.",
            }, status=status.HTTP_400_BAD_REQUEST)
        # ── Calculate daily budget (once, outside loop) ──
        daily_budget = budget / num_days

        # ── Smart Location Matching ──
        # Extract meaningful tokens from each location entry and search across
        # city, full_address, and nearest_landmark fields using icontains.
        import re
        from django.db.models import Q

        NOISE_TERMS = {
            'india', 'tamil nadu', 'karnataka', 'kerala', 'andhra pradesh',
            'telangana', 'maharashtra', 'rajasthan', 'uttar pradesh',
            'madhya pradesh', 'west bengal', 'gujarat', 'bihar',
            'odisha', 'punjab', 'haryana', 'jharkhand', 'chhattisgarh',
            'uttarakhand', 'himachal pradesh', 'goa', 'tripura',
            'meghalaya', 'manipur', 'nagaland', 'mizoram', 'arunachal pradesh',
            'sikkim', 'assam', 'jammu and kashmir', 'ladakh',
            'puducherry', 'chandigarh', 'delhi', 'lakshadweep',
            'andaman and nicobar islands', 'dadra and nagar haveli',
            'daman and diu',
        }

        def _extract_tokens(location_str):
            """Split a location string into meaningful search tokens."""
            parts = [p.strip() for p in location_str.split(',') if p.strip()]
            tokens = []
            for part in parts:
                # Remove pin codes (Indian 6-digit or any pure number sequences)
                cleaned = re.sub(r'\b\d{3,}\b', '', part).strip()
                if not cleaned:
                    continue
                if cleaned.lower() in NOISE_TERMS:
                    continue
                tokens.append(cleaned)
            return tokens

        # Build the master location Q filter
        # Search across ScreenSpec fields AND the AI profile's geocoded address
        location_q = Q()
        all_tokens = []
        for loc_entry in locations:
            tokens = _extract_tokens(loc_entry)
            all_tokens.extend(tokens)
            for token in tokens:
                location_q |= Q(city__icontains=token)
                location_q |= Q(full_address__icontains=token)
                location_q |= Q(nearest_landmark__icontains=token)
                # Also search the AI profile's geocoded English address
                location_q |= Q(ai_profile__formatted_address__icontains=token)
                location_q |= Q(ai_profile__city__icontains=token)

        if not location_q:
            # Fallback: if all tokens were noise, try the raw location strings
            for loc_entry in locations:
                location_q |= Q(city__icontains=loc_entry)
                location_q |= Q(full_address__icontains=loc_entry)
                location_q |= Q(ai_profile__formatted_address__icontains=loc_entry)

        screens = ScreenSpec.objects.filter(
            location_q,
            status__in=['VERIFIED', 'SCHEDULED_BLOCK'],
            profile_status__in=['PROFILED', 'REPROFILE'],
        ).distinct()  # Avoid duplicates from JOIN across ai_profile

        # ── Check Availability + Budget for each screen ──
        all_screen_data = []  # (screen, estimated_cost, available_slots, is_available, reason, extra)
        for screen in screens:
            # Use shared availability calculation
            available_slots_raw, overlapping_bookings = _calculate_screen_availability(screen, start, end)

            available_slots = available_slots_raw
            base_price = float(screen.base_price_per_slot_inr or 0)
            estimated_cost = base_price * num_days

            if available_slots <= 0:
                # Find when slots will free up — earliest booking end_date
                earliest_booking = overlapping_bookings.order_by('end_date').first()
                next_available = str(earliest_booking.end_date) if earliest_booking else None
                slots_freeing = earliest_booking.num_slots if earliest_booking else 0
                all_screen_data.append((screen, estimated_cost, 0, False, 'No slots available for the selected dates', (next_available, slots_freeing)))
            elif daily_budget < base_price:
                all_screen_data.append((screen, estimated_cost, available_slots, False, 'Exceeds budget', None))
            else:
                all_screen_data.append((screen, estimated_cost, available_slots, True, None, None))

        # ── Build response ──
        serializer = ScreenSpecSerializer([s for s, _, _, _, _, _ in all_screen_data], many=True)
        result = []
        for (screen_obj, est_cost, avail_slots, is_avail, reason, next_avail), screen_data in zip(all_screen_data, serializer.data):
            combined = dict(screen_data)
            combined['available_slots'] = avail_slots
            combined['estimated_cost_for_period'] = est_cost
            combined['campaign_days'] = num_days
            combined['is_available'] = is_avail
            if reason:
                combined['unavailability_reason'] = reason
            if next_avail:
                combined['next_available_date'] = next_avail[0]
                combined['slots_freeing_up'] = next_avail[1]

            # ── SCHEDULED_BLOCK awareness ──
            # If this screen is scheduled to block and the campaign end_date
            # extends beyond the block date, warn the advertiser.
            if screen_obj.status == 'SCHEDULED_BLOCK' and screen_obj.scheduled_block_date:
                combined['available_until'] = str(screen_obj.scheduled_block_date)
                block_date = screen_obj.scheduled_block_date
                if end.date() > block_date:
                    combined['block_warning'] = (
                        f"This screen is available only until {block_date}. "
                        f"You may schedule your campaign within this date range."
                    )

            # Attach AI profile data
            try:
                ai_profile = screen_obj.ai_profile
                combined['ai_profile'] = ai_profile.to_response_dict()
            except Exception:
                combined['ai_profile'] = None
            result.append(combined)

        # ── Determine which requested locations had no matching screens ──
        # For each location entry, check if any of its tokens matched any screen
        not_available = []
        for loc_entry in locations:
            tokens = _extract_tokens(loc_entry)
            if not tokens:
                tokens = [loc_entry]  # fallback to raw string
            # Check if any screen matches any token from this location
            loc_matched = False
            for screen_obj, _, _, _, _, _ in all_screen_data:
                # Build searchable text from ScreenSpec + AI profile
                screen_text = f"{screen_obj.city} {screen_obj.full_address} {screen_obj.nearest_landmark}"
                try:
                    screen_text += f" {screen_obj.ai_profile.formatted_address} {screen_obj.ai_profile.city}"
                except Exception:
                    pass
                screen_text = screen_text.lower()
                if any(token.lower() in screen_text for token in tokens):
                    loc_matched = True
                    break
            if not loc_matched:
                not_available.append(loc_entry)

        available_count = sum(1 for _, _, _, is_avail, _, _ in all_screen_data if is_avail)
        unavailable_count = len(all_screen_data) - available_count

        return response.Response({
            "query": {
                "locations": locations,
                "search_tokens_used": all_tokens,
                "start_date": start_date,
                "end_date": end_date,
                "budget_range": budget_range,
                "campaign_days": num_days,
            },
            "total_screens_found": len(result),
            "available_screens": available_count,
            "unavailable_screens": unavailable_count,
            "not_available_locations": not_available,
            "screens": result,
        }, status=status.HTTP_200_OK)


class AvailableCitiesView(views.APIView):
    """GET endpoint to return unique cities with available screens."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cities = (
            ScreenSpec.objects
            .filter(status__in=['VERIFIED', 'SCHEDULED_BLOCK'], profile_status__in=['PROFILED', 'REPROFILE'])
            .values_list('city', flat=True)
            .distinct()
            .order_by('city')
        )
        return response.Response({
            "cities": list(cities)
        }, status=status.HTTP_200_OK)


class PartnerSlotBlockView(views.APIView):
    """
    POST endpoint for partners to block slots on their screens.
    Partners use this to mark slots as occupied by their own direct clients.
    
    These blocks show up in the SlotBooking table with source='PARTNER'
    and are factored into availability calculations during discovery.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        screen_id = request.data.get('screen_id')
        num_slots = request.data.get('num_slots')
        start_date = request.data.get('start_date', '')
        end_date = request.data.get('end_date', '')
        reason = request.data.get('reason', '')

        # ── Validate required fields ──
        errors = {}
        if not screen_id:
            errors['screen_id'] = 'This field is required.'
        if not num_slots:
            errors['num_slots'] = 'This field is required.'
        if not start_date:
            errors['start_date'] = 'This field is required.'
        if not end_date:
            errors['end_date'] = 'This field is required.'

        if errors:
            return response.Response({
                "message": "Missing required fields.",
                "errors": errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Validate screen exists ──
        try:
            screen = ScreenSpec.objects.get(id=screen_id)
        except ScreenSpec.DoesNotExist:
            return response.Response({
                "message": f"Screen with id {screen_id} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        # ── Parse dates ──
        from datetime import datetime
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            if end <= start:
                return response.Response({
                    "message": "end_date must be after start_date."
                }, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return response.Response({
                "message": "Invalid date format. Use YYYY-MM-DD."
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Parse num_slots ──
        try:
            num_slots = int(num_slots)
            if num_slots <= 0:
                return response.Response({
                    "message": "num_slots must be a positive number."
                }, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return response.Response({
                "message": "num_slots must be a valid integer."
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Check availability for this date range ──
        from django.db.models import Sum
        booked_in_period = screen.slot_bookings.filter(
            status='ACTIVE',
            start_date__lt=end,
            end_date__gt=start,
        ).aggregate(total=Sum('num_slots'))['total'] or 0

        available = screen.total_slots_per_loop - screen.reserved_slots - booked_in_period
        if num_slots > available:
            return response.Response({
                "message": f"Not enough slots available. Requested: {num_slots}, Available: {available}",
                "available_slots": available,
                "total_slots": screen.total_slots_per_loop,
                "reserved_slots": screen.reserved_slots,
                "booked_in_period": booked_in_period,
            }, status=status.HTTP_409_CONFLICT)

        # ── Create the booking ──
        booking = SlotBooking.objects.create(
            screen=screen,
            num_slots=num_slots,
            start_date=start,
            end_date=end,
            source='PARTNER',
            campaign_id=reason,
            status='ACTIVE',
            payment='PAID',
            notes=reason or 'Partner direct block',
        )

        remaining = available - num_slots

        return response.Response({
            "message": "Slots blocked successfully.",
            "booking": {
                "id": booking.id,
                "screen_id": screen.id,
                "screen_name": screen.screen_name,
                "num_slots": booking.num_slots,
                "start_date": str(booking.start_date),
                "end_date": str(booking.end_date),
                "source": booking.source,
                "status": booking.status,
                "notes": booking.notes,
                "reason": booking.campaign_id,
                "created_at": str(booking.created_at),
            },
            "availability_after_block": {
                "total_slots": screen.total_slots_per_loop,
                "reserved_slots": screen.reserved_slots,
                "booked_in_period": booked_in_period + num_slots,
                "remaining_available": remaining,
            }
        }, status=status.HTTP_201_CREATED)


class CapacityCheckView(views.APIView):
    """
    Inventory Capacity Check for Proposal Lock.
    
    Checks if user's selected screen slots are still available
    before locking a proposal. Prevents race conditions where
    another buyer books the same slots while the user was deciding.
    
    POST:
      - start_date: campaign start date (required)
      - end_date: campaign end date (required)
      - booked_screens: [{screen_id, slots_booked}, ...] (required)
    
    Returns per-screen pass/fail + overall capacity_ready boolean.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        booked_screens = request.data.get('booked_screens', [])

        # ── Validate required fields ──
        missing = []
        if not start_date:
            missing.append('start_date')
        if not end_date:
            missing.append('end_date')
        if not booked_screens:
            missing.append('booked_screens')

        if missing:
            return response.Response({
                'status': 'error',
                'message': f'Missing required fields: {", ".join(missing)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Parse dates ──
        from datetime import datetime
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            if (end - start).days <= 0:
                return response.Response({
                    'status': 'error',
                    'message': 'end_date must be after start_date.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return response.Response({
                'status': 'error',
                'message': 'Invalid date format. Use YYYY-MM-DD.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Check each screen's capacity ──
        results = []
        all_passed = True

        for entry in booked_screens:
            screen_id = entry.get('screen_id')
            slots_requested = entry.get('slots_booked', 0)

            if not screen_id:
                results.append({
                    'screen_id': screen_id,
                    'screen_name': None,
                    'available_slots': 0,
                    'requested_slots': slots_requested,
                    'passed': False,
                    'error': 'Missing screen_id'
                })
                all_passed = False
                continue

            try:
                screen = ScreenSpec.objects.get(id=screen_id)
            except ScreenSpec.DoesNotExist:
                results.append({
                    'screen_id': screen_id,
                    'screen_name': None,
                    'available_slots': 0,
                    'requested_slots': slots_requested,
                    'passed': False,
                    'error': f'Screen with id {screen_id} not found'
                })
                all_passed = False
                continue

            # ── Reject BLOCKED screens outright ──
            if screen.status == 'BLOCKED':
                results.append({
                    'screen_id': screen.id,
                    'screen_name': screen.screen_name,
                    'available_slots': 0,
                    'requested_slots': slots_requested,
                    'passed': False,
                    'error': 'Screen is blocked and cannot accept campaigns.'
                })
                all_passed = False
                continue

            # Use the SAME availability calculation as the discover API
            available_slots, _ = _calculate_screen_availability(screen, start, end)
            passed = available_slots >= slots_requested

            if not passed:
                all_passed = False

            result_entry = {
                'screen_id': screen.id,
                'screen_name': screen.screen_name,
                'available_slots': max(available_slots, 0),
                'requested_slots': slots_requested,
                'passed': passed
            }

            # ── SCHEDULED_BLOCK warning ──
            if screen.status == 'SCHEDULED_BLOCK' and screen.scheduled_block_date:
                result_entry['available_until'] = str(screen.scheduled_block_date)
                if end.date() > screen.scheduled_block_date:
                    result_entry['block_warning'] = (
                        f"This screen is available only until {screen.scheduled_block_date}. "
                        f"You may schedule your campaign within this date range."
                    )

            results.append(result_entry)

        return response.Response({
            'status': 'success',
            'capacity_ready': all_passed,
            'screens': results
        }, status=status.HTTP_200_OK)


class SlotBookingView(views.APIView):
    """
    POST endpoint to create a SlotBooking record.
    GET endpoint to list all bookings (with optional filters).
    
    POST Body:
      - screen (int, required): ScreenSpec ID
      - num_slots (int, required): Number of slots to book
      - start_date (str, required): YYYY-MM-DD
      - end_date (str, required): YYYY-MM-DD
      - campaign_id (str, optional): Campaign reference
      - user_id (str, optional): Advertiser identifier
      - status (str, optional): ACTIVE/EXPIRED/CANCELLED (default: ACTIVE)
      - source (str, optional): XIGI/PARTNER (default: XIGI)
    
    GET Query Params:
      - screen: filter by screen ID
      - status: filter by status
      - source: filter by source
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Auto-expire HOLD bookings older than 10 minutes (only XIGI, never PARTNER)
        from datetime import timedelta
        expiry_cutoff = timezone.now() - timedelta(minutes=10)
        SlotBooking.objects.filter(
            status='HOLD',
            payment='UNPAID',
            source='XIGI',
            created_at__lte=expiry_cutoff
        ).update(status='EXPIRED')

        bookings = SlotBooking.objects.all()

        # Optional filters
        screen_id = request.query_params.get('screen')
        if screen_id:
            bookings = bookings.filter(screen_id=screen_id)

        status_filter = request.query_params.get('status')
        if status_filter:
            bookings = bookings.filter(status__iexact=status_filter)

        source_filter = request.query_params.get('source')
        if source_filter:
            bookings = bookings.filter(source__iexact=source_filter)

        campaign_id = request.query_params.get('campaign_id')
        if campaign_id:
            bookings = bookings.filter(campaign_id__icontains=campaign_id)

        user_id = request.query_params.get('user_id')
        if user_id:
            bookings = bookings.filter(user_id__icontains=user_id)

        payment_filter = request.query_params.get('payment')
        if payment_filter:
            bookings = bookings.filter(payment__iexact=payment_filter)

        serializer = SlotBookingSerializer(bookings, many=True)
        return response.Response({
            "total": bookings.count(),
            "bookings": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        _expire_stale_hold_bookings()
        serializer = SlotBookingSerializer(data=request.data)
        if serializer.is_valid():
            screen = serializer.validated_data['screen']
            # Auto-determine source from the screen's role
            role = (screen.role or '').lower()
            source = 'PARTNER' if role == 'partner' else 'XIGI'

            # Auto-fill notes based on source
            notes = serializer.validated_data.get('notes', '') or request.data.get('notes', '')
            if not notes:
                notes = 'Xigi Campaigns' if source == 'XIGI' else 'Partner direct block'

            # Partner bookings go straight to ACTIVE + PAID (no payment flow)
            if source == 'PARTNER':
                booking = serializer.save(source=source, notes=notes, status='ACTIVE', payment='PAID')
            else:
                booking = serializer.save(source=source, notes=notes)
            return response.Response({
                "message": "Slot booking created successfully.",
                "booking": SlotBookingSerializer(booking).data,
            }, status=status.HTTP_201_CREATED)

        return response.Response({
            "message": "Validation failed.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        """
        PUT endpoint to update an existing SlotBooking.
        Body must include 'booking_id' (int) plus any fields to update:
          - num_slots, start_date, end_date, campaign_id, user_id,
            status, payment, notes
        """
        booking_id = request.data.get('booking_id')
        if not booking_id:
            return response.Response(
                {"message": "booking_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            booking = SlotBooking.objects.get(id=booking_id)
        except SlotBooking.DoesNotExist:
            return response.Response(
                {"message": f"Booking #{booking_id} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Partner bookings can only be ACTIVE or DELETED
        if booking.source == 'PARTNER' and 'status' in request.data:
            new_status = request.data['status'].upper()
            if new_status not in ('ACTIVE', 'DELETED'):
                return response.Response(
                    {"message": "Partner bookings can only be ACTIVE or DELETED."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Fields allowed to update
        allowed_fields = [
            'num_slots', 'start_date', 'end_date',
            'campaign_id', 'user_id', 'status', 'payment', 'notes'
        ]
        for field in allowed_fields:
            if field in request.data:
                setattr(booking, field, request.data[field])

        booking.save()
        serializer = SlotBookingSerializer(booking)
        return response.Response({
            "message": "Booking updated successfully.",
            "booking": serializer.data,
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        """
        DELETE endpoint to remove a SlotBooking.
        Pass 'booking_id' as a query param or in the request body.
        """
        booking_id = request.query_params.get('booking_id') or request.data.get('booking_id')
        if not booking_id:
            return response.Response(
                {"message": "booking_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            booking = SlotBooking.objects.get(id=booking_id)
        except SlotBooking.DoesNotExist:
            return response.Response(
                {"message": f"Booking #{booking_id} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        booking_data = SlotBookingSerializer(booking).data
        booking.status = 'DELETED'
        booking.save()
        return response.Response({
            "message": f"Booking #{booking_id} marked as deleted.",
            "booking": SlotBookingSerializer(booking).data,
        }, status=status.HTTP_200_OK)


class SlotBookingPaymentView(views.APIView):
    """
    POST endpoint to update payment status of a SlotBooking.
    
    If payment is marked PAID within 10 minutes of creation:
      → payment = PAID, status = ACTIVE
    If 10 minutes have already passed:
      → payment stays UNPAID, status = EXPIRED
    
    Body:
      - booking_id (int, required): SlotBooking ID
      - payment (str, required): "PAID"
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        campaign_id = request.data.get('campaign_id')
        payment_status = request.data.get('payment', '').upper()

        if not campaign_id:
            return response.Response({
                "message": "campaign_id is required."
            }, status=status.HTTP_400_BAD_REQUEST)

        if payment_status != 'PAID':
            return response.Response({
                "message": "payment must be 'PAID'."
            }, status=status.HTTP_400_BAD_REQUEST)

        bookings = SlotBooking.objects.filter(campaign_id=campaign_id)
        if not bookings.exists():
            return response.Response({
                "message": f"No bookings found for campaign_id '{campaign_id}'."
            }, status=status.HTTP_404_NOT_FOUND)

        from datetime import timedelta
        now = timezone.now()
        activated = []
        expired = []

        for booking in bookings:
            if booking.payment == 'PAID':
                activated.append(booking)
                continue

            time_elapsed = now - booking.created_at
            if time_elapsed <= timedelta(minutes=10):
                booking.payment = 'PAID'
                booking.status = 'ACTIVE'
                booking.save()
                activated.append(booking)
            else:
                booking.status = 'EXPIRED'
                booking.save()
                expired.append(booking)

        all_expired = len(activated) == 0 and len(expired) > 0

        return response.Response({
            "message": "All bookings expired. Payment window passed." if all_expired
                       else f"Payment confirmed. {len(activated)} booking(s) activated, {len(expired)} expired.",
            "campaign_id": campaign_id,
            "activated": SlotBookingSerializer(activated, many=True).data,
            "expired": SlotBookingSerializer(expired, many=True).data,
        }, status=status.HTTP_410_GONE if all_expired else status.HTTP_200_OK)


class SlotBookingStatusView(views.APIView):
    """
    GET endpoint to check booking/payment status for a campaign.
    Read-only — no data is modified (except auto-expiring stale holds).
    
    Query Params:
      - campaign_id (str, required)
    
    Status priority:
      - If any booking is ACTIVE + PAID → return ACTIVE/PAID
      - If any booking is HOLD + UNPAID → return HOLD/UNPAID
      - If all are EXPIRED → return EXPIRED/UNPAID
      - If no bookings → return null/null
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        campaign_id = request.query_params.get('campaign_id')

        if not campaign_id:
            return response.Response({
                "message": "campaign_id query param is required."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Auto-expire stale holds before checking
        _expire_stale_hold_bookings()

        bookings = SlotBooking.objects.filter(campaign_id=campaign_id)
        total = bookings.count()

        if total == 0:
            return response.Response({
                "campaign_id": campaign_id,
                "booking_status": None,
                "payment_status": None,
                "total_bookings": 0
            }, status=status.HTTP_200_OK)

        # Priority: ACTIVE+PAID > HOLD+UNPAID > EXPIRED+UNPAID
        statuses = set(bookings.values_list('status', flat=True))
        payments = set(bookings.values_list('payment', flat=True))

        if 'ACTIVE' in statuses and 'PAID' in payments:
            booking_status = 'ACTIVE'
            payment_status = 'PAID'
        elif 'HOLD' in statuses:
            booking_status = 'HOLD'
            payment_status = 'UNPAID'
        else:
            booking_status = 'EXPIRED'
            payment_status = 'UNPAID'

        return response.Response({
            "campaign_id": campaign_id,
            "booking_status": booking_status,
            "payment_status": payment_status,
            "total_bookings": total
        }, status=status.HTTP_200_OK)


# ═══════════════════════════════════════════════════════════════
# CAMPAIGN ASSET VIEWS
# ═══════════════════════════════════════════════════════════════

class CampaignManifestView(views.APIView):
    """
    POST /api/console/campaign/<campaign_id>/manifest/  → auto-create asset rows from SlotBookings
    GET  /api/console/campaign/<campaign_id>/manifest/   → list all asset rows for this campaign
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, campaign_id):
        """Return all CampaignAsset rows for this campaign."""
        assets = CampaignAsset.objects.filter(campaign_id=campaign_id)
        serializer = CampaignAssetSerializer(assets, many=True)
        return response.Response({
            'status': 'success',
            'campaign_id': campaign_id,
            'total_slots': assets.count(),
            'assets': serializer.data
        })

    def post(self, request, campaign_id):
        """
        Read campaign's SlotBookings, fetch ScreenSpec data,
        and auto-create CampaignAsset rows for each booked slot.
        """
        # Find all SlotBookings for this campaign
        bookings = SlotBooking.objects.filter(campaign_id=campaign_id)
        if not bookings.exists():
            return response.Response(
                {'status': 'error', 'message': 'No SlotBookings found for this campaign'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_assets = []
        errors = []

        for booking in bookings:
            screen = booking.screen  # FK to ScreenSpec
            screen_id = screen.id
            slot_count = booking.num_slots

            # Create one row per slot
            for slot_num in range(1, slot_count + 1):
                # Skip if already exists
                if CampaignAsset.objects.filter(
                    campaign_id=campaign_id, screen_id=screen_id, slot_number=slot_num
                ).exists():
                    continue

                # Parse max_file_size_mb safely
                max_file_size = 0
                try:
                    max_file_size = int(str(screen.max_file_size_mb).replace('MB', '').replace('mb', '').strip() or 0)
                except (ValueError, TypeError):
                    pass

                asset = CampaignAsset.objects.create(
                    campaign_id=campaign_id,
                    screen_id=screen_id,
                    screen_name=screen.screen_name or '',
                    screen_location=screen.city or '',
                    slot_number=slot_num,
                    # Snapshot screen constraints from ScreenSpec
                    req_resolution_width=screen.resolution_width or 0,
                    req_resolution_height=screen.resolution_height or 0,
                    req_orientation=screen.orientation or '',
                    req_max_duration_sec=screen.standard_ad_duration_sec or 0,
                    req_max_file_size_mb=max_file_size,
                    req_supported_formats=screen.supported_formats_json or [],
                    req_audio_supported=screen.audio_supported or False,
                )
                created_assets.append(asset)

        serializer = CampaignAssetSerializer(created_assets, many=True)
        result = {
            'status': 'success',
            'campaign_id': campaign_id,
            'created_count': len(created_assets),
            'assets': serializer.data,
        }
        if errors:
            result['warnings'] = errors

        return response.Response(result, status=status.HTTP_201_CREATED)


class CampaignAssetUploadView(views.APIView):
    """
    POST /api/console/campaign/<campaign_id>/assets/  → upload file to a specific slot
    GET  /api/console/campaign/<campaign_id>/assets/   → list all assets for campaign
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, campaign_id):
        """List all assets for a campaign."""
        assets = CampaignAsset.objects.filter(campaign_id=campaign_id)
        serializer = CampaignAssetSerializer(assets, many=True)
        return response.Response({
            'status': 'success',
            'campaign_id': campaign_id,
            'total': assets.count(),
            'assets': serializer.data
        })

    def post(self, request, campaign_id):
        """Upload a file to a specific slot for a campaign."""
        upload_serializer = FileUploadSerializer(data=request.data)
        if not upload_serializer.is_valid():
            return response.Response(
                {'status': 'error', 'errors': upload_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        screen_id = upload_serializer.validated_data['screen_id']
        slot_number = upload_serializer.validated_data['slot_number']
        uploaded_file = upload_serializer.validated_data['file']

        # Find matching asset row
        try:
            asset = CampaignAsset.objects.get(
                campaign_id=campaign_id, screen_id=screen_id, slot_number=slot_number
            )
        except CampaignAsset.DoesNotExist:
            return response.Response(
                {'status': 'error', 'message': f'No manifest row for screen {screen_id} slot {slot_number}. Run POST manifest first.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Detect resubmission: if previously rejected, mark it
        was_rejected = (asset.validation_status == 'failed')

        # Save file and fill metadata
        asset.file = uploaded_file
        asset.original_filename = uploaded_file.name
        asset.file_size_bytes = uploaded_file.size
        asset.file_type = uploaded_file.content_type or mimetypes.guess_type(uploaded_file.name)[0] or ''
        ext = os.path.splitext(uploaded_file.name)[1].lstrip('.').lower()
        asset.file_extension = ext
        asset.status = 'uploaded'

        if was_rejected:
            asset.is_resubmission = True
            asset.validation_status = 'pending'
            asset.validation_errors = None
            asset.validated_at = None

        # Set all validation checks to True since file is uploaded
        asset.is_file_format = True
        asset.is_file_size = True
        asset.is_video_duration = True
        asset.is_resolution = True
        asset.is_orientation = True
        asset.save()

        serializer = CampaignAssetSerializer(asset)
        return response.Response({
            'status': 'success',
            'message': f'File uploaded to screen {screen_id} slot {slot_number}',
            'asset': serializer.data
        }, status=status.HTTP_200_OK)

    def delete(self, request, campaign_id):
        """Remove uploaded file from a specific slot, reset status to 'pending'."""
        screen_id = request.query_params.get('screen_id') or request.data.get('screen_id')
        slot_number = request.query_params.get('slot_number') or request.data.get('slot_number')

        if not screen_id or not slot_number:
            return response.Response(
                {'status': 'error', 'message': 'screen_id and slot_number are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            asset = CampaignAsset.objects.get(
                campaign_id=campaign_id, screen_id=screen_id, slot_number=slot_number
            )
        except CampaignAsset.DoesNotExist:
            return response.Response(
                {'status': 'error', 'message': f'No asset for screen {screen_id} slot {slot_number}.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete the actual file from storage
        if asset.file:
            asset.file.delete(save=False)

        # Clear all file-related fields
        asset.file = None
        asset.original_filename = None
        asset.file_size_bytes = None
        asset.file_type = None
        asset.file_extension = None

        # Reset status and validation
        asset.status = 'pending'
        asset.validation_status = 'pending'
        asset.validation_errors = None
        asset.validated_at = None
        asset.is_file_format = False
        asset.is_file_size = False
        asset.is_video_duration = False
        asset.is_resolution = False
        asset.is_orientation = False

        asset.save()

        return response.Response({
            'status': 'success',
            'message': f'File removed from screen {screen_id} slot {slot_number}. Status reset to pending.',
            'asset': CampaignAssetSerializer(asset).data
        }, status=status.HTTP_200_OK)

class CampaignAssetDeleteView(views.APIView):
    """
    DELETE /api/console/campaign/<campaign_id>/assets/<asset_id>/
    Remove uploaded file from an asset by its ID, reset status to 'pending'.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def delete(self, request, campaign_id, asset_id):
        try:
            asset = CampaignAsset.objects.get(id=asset_id, campaign_id=campaign_id)
        except CampaignAsset.DoesNotExist:
            return response.Response(
                {'status': 'error', 'message': f'Asset #{asset_id} not found for campaign {campaign_id}.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete the actual file from storage
        if asset.file:
            asset.file.delete(save=False)

        # Clear all file-related fields
        asset.file = None
        asset.original_filename = None
        asset.file_size_bytes = None
        asset.file_type = None
        asset.file_extension = None

        # Reset status and validation
        asset.status = 'pending'
        asset.validation_status = 'pending'
        asset.validation_errors = None
        asset.validated_at = None
        asset.is_file_format = False
        asset.is_file_size = False
        asset.is_video_duration = False
        asset.is_resolution = False
        asset.is_orientation = False

        asset.save()

        return response.Response({
            'status': 'success',
            'message': f'File removed from asset #{asset_id}. Status reset to pending.',
            'asset': CampaignAssetSerializer(asset).data
        }, status=status.HTTP_200_OK)


class CampaignAssetValidateView(views.APIView):
    """
    POST /api/console/campaign/<campaign_id>/assets/<asset_id>/validate/
    Runs server-side validation (ffprobe for video, Pillow for image).
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request, campaign_id, asset_id):
        try:
            asset = CampaignAsset.objects.get(id=asset_id, campaign_id=campaign_id)
        except CampaignAsset.DoesNotExist:
            return response.Response(
                {'status': 'error', 'message': 'Asset not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not asset.file:
            return response.Response(
                {'status': 'error', 'message': 'No file uploaded yet. Upload first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file_path = asset.file.path
        ext = (asset.file_extension or '').lower()
        errors = []

        # ── Detect file properties ──
        video_extensions = {'mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'}
        image_extensions = {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'}

        if ext in video_extensions:
            self._detect_video(asset, file_path, errors)
        elif ext in image_extensions:
            self._detect_image(asset, file_path, errors)
        else:
            errors.append(f'Unknown file extension: .{ext}')

        # ── Validate against requirements ──
        # Format check
        supported = [f.upper() for f in (asset.req_supported_formats or [])]
        if supported and ext.upper() not in supported:
            errors.append(f'Format .{ext.upper()} not in supported formats: {supported}')

        # File size check
        if asset.req_max_file_size_mb and asset.file_size_bytes:
            max_bytes = asset.req_max_file_size_mb * 1024 * 1024
            if asset.file_size_bytes > max_bytes:
                errors.append(
                    f'File size {asset.file_size_bytes / (1024*1024):.1f}MB exceeds max {asset.req_max_file_size_mb}MB'
                )

        # Resolution check
        if asset.detected_width and asset.detected_height:
            if asset.req_resolution_width and asset.req_resolution_height:
                if (asset.detected_width != asset.req_resolution_width or
                    asset.detected_height != asset.req_resolution_height):
                    errors.append(
                        f'Resolution mismatch: {asset.detected_width}x{asset.detected_height} '
                        f'vs required {asset.req_resolution_width}x{asset.req_resolution_height}'
                    )

        # Duration check (video only)
        if asset.detected_duration_sec and asset.req_max_duration_sec:
            if asset.detected_duration_sec > asset.req_max_duration_sec:
                errors.append(
                    f'Duration {asset.detected_duration_sec:.1f}s exceeds max {asset.req_max_duration_sec}s'
                )

        # Audio check
        if asset.detected_has_audio and not asset.req_audio_supported:
            errors.append('File has audio but screen does not support audio')

        # ── Set validation result ──
        asset.validation_errors = errors if errors else None
        asset.validation_status = 'failed' if errors else 'passed'
        asset.validated_at = timezone.now()
        if not errors:
            asset.status = 'validated'
        asset.save()

        serializer = CampaignAssetSerializer(asset)
        return response.Response({
            'status': 'success',
            'validation_status': asset.validation_status,
            'errors': errors,
            'asset': serializer.data
        })

    def _detect_video(self, asset, file_path, errors):
        """Use ffprobe to detect video properties."""
        try:
            cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_streams', '-show_format', file_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                errors.append(f'ffprobe failed: {result.stderr[:200]}')
                return

            probe = json.loads(result.stdout)

            # Find video stream
            for stream in probe.get('streams', []):
                if stream.get('codec_type') == 'video':
                    asset.detected_width = int(stream.get('width', 0))
                    asset.detected_height = int(stream.get('height', 0))
                    break

            # Duration from format
            fmt = probe.get('format', {})
            if fmt.get('duration'):
                asset.detected_duration_sec = float(fmt['duration'])

            # Check for audio stream
            asset.detected_has_audio = any(
                s.get('codec_type') == 'audio' for s in probe.get('streams', [])
            )

        except FileNotFoundError:
            errors.append('ffprobe not found. Install ffmpeg to enable video validation.')
        except subprocess.TimeoutExpired:
            errors.append('ffprobe timed out')
        except Exception as e:
            errors.append(f'Video detection error: {str(e)}')

    def _detect_image(self, asset, file_path, errors):
        """Use Pillow to detect image properties."""
        try:
            from PIL import Image
            with Image.open(file_path) as img:
                asset.detected_width = img.width
                asset.detected_height = img.height
                asset.detected_duration_sec = None
                asset.detected_has_audio = False
        except ImportError:
            errors.append('Pillow not installed. Run: pip install Pillow')
        except Exception as e:
            errors.append(f'Image detection error: {str(e)}')


class CampaignAssetListView(views.APIView):
    """Global list of all CampaignAssets for the Creative Validation Queue.
    GET  — list all assets (optional filters: ?status=, ?campaign_id=, ?validation_status=)
    PATCH — update a single asset's status/policy fields by ?asset_id=
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        assets = CampaignAsset.objects.all().order_by('-created_at')

        # Optional filters
        asset_status = request.query_params.get('status')
        if asset_status:
            assets = assets.filter(status=asset_status)

        validation_status = request.query_params.get('validation_status')
        if validation_status:
            assets = assets.filter(validation_status=validation_status)

        campaign_id = request.query_params.get('campaign_id')
        if campaign_id:
            assets = assets.filter(campaign_id=campaign_id)

        screen_id = request.query_params.get('screen_id')
        if screen_id:
            assets = assets.filter(screen_id=screen_id)

        # Serialize and enrich with ScreenSpec policy data
        serializer = CampaignAssetSerializer(assets, many=True)
        results = []
        for asset_data in serializer.data:
            screen_id = asset_data.get('screen_id')
            # Try to fetch ScreenSpec policy fields
            policy_info = {}
            try:
                spec = ScreenSpec.objects.get(id=screen_id)
                policy_info = {
                    'restricted_categories': spec.restricted_categories_json or [],
                    'sensitive_zone_flags': spec.sensitive_zone_flags_json or [],
                    'screen_spec_name': spec.screen_name or '',
                    'screen_spec_city': spec.city or '',
                    'screen_spec_environment': spec.environment or '',
                }
            except ScreenSpec.DoesNotExist:
                policy_info = {
                    'restricted_categories': [],
                    'sensitive_zone_flags': [],
                    'screen_spec_name': '',
                    'screen_spec_city': '',
                    'screen_spec_environment': '',
                }
            asset_data['policy_info'] = policy_info
            results.append(asset_data)

        return response.Response(results)

    def patch(self, request):
        asset_id = request.query_params.get('asset_id') or request.data.get('asset_id')
        if not asset_id:
            return response.Response(
                {'error': 'asset_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            asset = CampaignAsset.objects.get(id=asset_id)
        except CampaignAsset.DoesNotExist:
            return response.Response(
                {'error': 'Asset not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Update allowed fields
        new_status = request.data.get('status')
        if new_status in ['pending', 'uploaded', 'validated', 'approved', 'live']:
            asset.status = new_status

        new_validation = request.data.get('validation_status')
        if new_validation in ['pending', 'passed', 'failed', 'warning']:
            asset.validation_status = new_validation

        validation_errors = request.data.get('validation_errors')
        if validation_errors is not None:
            asset.validation_errors = validation_errors

        if new_validation in ['passed', 'failed', 'warning']:
            asset.validated_at = timezone.now()

        # Reset resubmission flag when reviewer takes action
        if new_status in ['approved'] or new_validation in ['passed', 'failed']:
            asset.is_resubmission = False

        asset.save()
        serializer = CampaignAssetSerializer(asset)
        return response.Response(serializer.data)


class BlockScreenView(views.APIView):
    """
    POST /api/console/screens/<pk>/block/

    Checks active SlotBookings on the screen:
    - If active bookings exist → status = SCHEDULED_BLOCK, scheduled_block_date = MAX(end_date)
    - If no active bookings   → status = BLOCKED immediately

    Also auto-flips SCHEDULED_BLOCK → BLOCKED if scheduled_block_date has passed (check-on-request).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            screen = ScreenSpec.objects.get(pk=pk)
        except ScreenSpec.DoesNotExist:
            return response.Response(
                {'error': 'Screen not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        today = date.today()

        # ── Auto-flip if a SCHEDULED_BLOCK screen's date has already passed ──
        if screen.status == 'SCHEDULED_BLOCK' and screen.scheduled_block_date and screen.scheduled_block_date <= today:
            screen.status = 'BLOCKED'
            screen.save(update_fields=['status'])
            return response.Response({
                'status': 'BLOCKED',
                'scheduled_block_date': None,
                'message': 'Screen has been blocked (scheduled date passed).'
            })

        # ── Prevent re-blocking an already blocked screen ──
        if screen.status == 'BLOCKED':
            return response.Response(
                {'error': 'Screen is already blocked.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── Find active/hold bookings whose end_date is in the future ──
        active_bookings = SlotBooking.objects.filter(
            screen=screen,
            status__in=['ACTIVE', 'HOLD'],
            end_date__gte=today
        )

        if active_bookings.exists():
            # Find the latest campaign end date
            latest_end = active_bookings.order_by('-end_date').values_list('end_date', flat=True).first()
            screen.status = 'SCHEDULED_BLOCK'
            screen.scheduled_block_date = latest_end
            screen.save(update_fields=['status', 'scheduled_block_date'])
            return response.Response({
                'status': 'SCHEDULED_BLOCK',
                'scheduled_block_date': str(latest_end),
                'active_bookings_count': active_bookings.count(),
                'message': f'Screen is scheduled to block after {latest_end}. All active campaigns will complete uninterrupted.'
            })
        else:
            # No active campaigns — block immediately
            screen.status = 'BLOCKED'
            screen.scheduled_block_date = today
            screen.save(update_fields=['status', 'scheduled_block_date'])
            return response.Response({
                'status': 'BLOCKED',
                'scheduled_block_date': str(today),
                'message': 'Screen has been blocked immediately. No active campaigns were affected.'
            })
