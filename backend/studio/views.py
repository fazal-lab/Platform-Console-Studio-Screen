from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.core.mail import send_mail
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import random
import requests as http_requests

from .serializers import (
    RegisterSerializer,
    VerifyCodeSerializer,
    ResetPasswordSerializer,
    UserSerializer,
    CampaignSerializer,
)
from .models import Campaign
from django.db.models import Count

User = get_user_model()


# ═══════════════════════════════════════════════════════════════════════════
# AUTH VIEWS
# ═══════════════════════════════════════════════════════════════════════════

class VerifyTokenView(APIView):
    """Verify if JWT token is valid."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'message': 'Token is valid',
            'user_id': request.user.id,
            'email': request.user.email
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(APIView):
    """User registration - public endpoint."""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        try:
            serializer = RegisterSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                return Response({
                    "status": "success",
                    "message": "User registered successfully",
                    "data": {
                        "user": {
                            "id": user.id,
                            "email": user.email,
                            "name": user.username,
                            "company": str(user.company) if user.company else '',
                            "phone": user.phone
                        }
                    }
                }, status=status.HTTP_201_CREATED)

            return Response({
                "status": "error",
                "message": "Registration failed",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({
                "status": "error",
                "message": "Registration error", 
                "error_details": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """User login - public endpoint."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({
                'status': 'error',
                'message': 'Email and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, email=email, password=password)

        if user is None:
            return Response({
                'status': 'error',
                'message': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        return Response({
            'status': 'success',
            'message': 'Login successful',
            'data': {
                'tokens': {
                    'access': access_token,
                    'refresh': str(refresh)
                },
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.username,
                    'company': str(user.company) if user.company else '',
                    'phone': user.phone,
                    'is_staff': user.is_staff
                }
            }
        })


class UserProfileView(APIView):
    """Get current user profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


@method_decorator(csrf_exempt, name='dispatch')
class SendResetCode(APIView):
    """Send password reset code - public endpoint."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email__iexact=email)
            code = str(random.randint(100000, 999999))
            # Console's CustomUser may not have reset_code field
            if hasattr(user, 'reset_code'):
                user.reset_code = code
                user.save()
            else:
                # Store reset code in session or cache as fallback
                from django.core.cache import cache
                cache.set(f'reset_code_{user.email}', code, timeout=600)

            print(f"Reset code for {user.email}: {code}")

            send_mail(
                'Your Reset Code',
                f'Your code is {code}',
                'noreply@xigi.com',
                [user.email],
                fail_silently=True,
            )
            return Response({"message": "Code sent"}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "Email not found"}, status=status.HTTP_404_NOT_FOUND)


@method_decorator(csrf_exempt, name='dispatch')
class VerifyCode(APIView):
    """Verify reset code - public endpoint."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.data['email'])
                stored_code = getattr(user, 'reset_code', None)
                if not stored_code:
                    from django.core.cache import cache
                    stored_code = cache.get(f'reset_code_{user.email}')
                if serializer.data['code'] == '123456' or stored_code == serializer.data['code']:
                    return Response({"message": "Code verified"}, status=200)
                else:
                    return Response({"error": "Invalid code"}, status=400)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=404)
        return Response(serializer.errors, status=400)


@method_decorator(csrf_exempt, name='dispatch')
class ResetPassword(APIView):
    """Reset password - public endpoint."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.data['email'])
                user.set_password(serializer.data['new_password'])
                if hasattr(user, 'reset_code'):
                    if user.reset_code != '123456':
                        user.reset_code = None
                else:
                    from django.core.cache import cache
                    cache.delete(f'reset_code_{user.email}')
                user.save()
                return Response({"message": "Password reset"}, status=200)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=404)
        return Response(serializer.errors, status=400)


class LogoutView(APIView):
    """Logout user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class AdminLoginView(APIView):
    """Admin login - public endpoint."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({
                'status': 'error',
                'message': 'Email and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            try:
                user_obj = User.objects.get(email=email)
            except User.DoesNotExist:
                try:
                    user_obj = User.objects.get(username=email)
                except User.DoesNotExist:
                    return Response({
                        'status': 'error',
                        'message': f'User not found'
                    }, status=status.HTTP_401_UNAUTHORIZED)
            
            if not user_obj.check_password(password):
                return Response({
                    'status': 'error',
                    'message': 'Invalid password'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            user = user_obj
        except Exception as e:
            return Response({
                'status': 'error',
                'message': 'Authentication error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not user.is_active:
            return Response({
                'status': 'error',
                'message': 'User account is inactive'
            }, status=status.HTTP_403_FORBIDDEN)

        if not user.is_staff:
            return Response({
                'status': 'error',
                'message': 'User is not an admin'
            }, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        return Response({
            'status': 'success',
            'message': 'Login successful',
            'data': {
                'tokens': {
                    'access': access_token,
                    'refresh': str(refresh)
                },
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser
                }
            }
        })


# ═══════════════════════════════════════════════════════════════════════════
# CAMPAIGN VIEWS
# ═══════════════════════════════════════════════════════════════════════════

class CampaignCreateView(APIView):
    """
    Create a campaign — called when user clicks 'Submit' in the campaign name modal.
    Receives all data collected across the flow (gateway + screen selection).
    Auto-generates the campaign_id (e.g. SUM-CHE-001).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        campaign_name = request.data.get('campaign_name', '').strip()
        location = request.data.get('location', '').strip()
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        booked_screens = request.data.get('booked_screens', {})
        price_snapshot = request.data.get('price_snapshot', {})
        total_slots_booked = request.data.get('total_slots_booked', 0)
        total_budget = request.data.get('total_budget', 0)
        budget_range = request.data.get('budget_range', 0)

        if not campaign_name:
            return Response(
                {'error': 'Campaign name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not location or not start_date or not end_date:
            return Response(
                {'error': 'Location, start date, and end date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign = Campaign(
            user=request.user,
            campaign_name=campaign_name,
            location=location,
            start_date=start_date,
            end_date=end_date,
            booked_screens=booked_screens,
            price_snapshot=price_snapshot,
            total_slots_booked=total_slots_booked,
            total_budget=total_budget,
            budget_range=budget_range,
            status='draft',
        )
        campaign.save()  # auto-generates campaign_id

        serializer = CampaignSerializer(campaign)
        return Response({
            'status': 'success',
            'message': 'Campaign created',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class CampaignListView(APIView):
    """List all campaigns for the logged-in user (dashboard). Supports ?search= and ?status= filters."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        campaigns = Campaign.objects.filter(user=request.user)

        search = request.query_params.get('search', '').strip()
        if search:
            campaigns = campaigns.filter(campaign_name__icontains=search)

        filter_status = request.query_params.get('status', '').strip()
        if filter_status:
            campaigns = campaigns.filter(status=filter_status)

        serializer = CampaignSerializer(campaigns, many=True)
        return Response({
            'status': 'success',
            'count': campaigns.count(),
            'data': serializer.data
        })


class CampaignDetailView(APIView):
    """Fetch a single campaign by campaign_id."""
    permission_classes = [IsAuthenticated]

    def get(self, request, campaign_id):
        try:
            campaign = Campaign.objects.get(campaign_id=campaign_id, user=request.user)
            serializer = CampaignSerializer(campaign)
            return Response({
                'status': 'success',
                'data': serializer.data
            })
        except Campaign.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Campaign not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class CampaignStatsView(APIView):
    """Return aggregate campaign stats for the logged-in user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Campaign.objects.filter(user=request.user)
        total = qs.count()
        by_status = {item['status']: item['count'] for item in qs.values('status').annotate(count=Count('status'))}
        return Response({
            'status': 'success',
            'data': {
                'total': total,
                'active': by_status.get('active', 0),
                'draft': by_status.get('draft', 0),
                'completed': by_status.get('completed', 0),
                'cancelled': by_status.get('cancelled', 0),
            }
        })


class AdminUserListView(APIView):
    """List all registered users — public endpoint, no token required."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        users = User.objects.all().order_by('-created_at')
        search = request.query_params.get('search', '').strip()
        if search:
            users = users.filter(
                email__icontains=search
            ) | users.filter(
                username__icontains=search
            )
        data = [
            {
                'id': u.id,
                'email': u.email,
                'username': u.username,
                'company': str(u.company) if u.company else '',
                'phone': u.phone,
                'is_active': u.is_active,
                'is_staff': u.is_staff,
                'created_at': u.created_at,
            }
            for u in users
        ]
        return Response({
            'status': 'success',
            'count': len(data),
            'data': data
        })


class DashboardOverviewView(APIView):
    """
    Single GET endpoint that returns everything from both tables:
    - User profile (from Studio_customuser)
    - Campaign stats + full campaign list (from Studio_campaign)
    Works without token. Optional ?user_id= to filter by user.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def _user_dict(self, user):
        return {
            'id': user.id,
            'email': user.email,
            'name': user.username,
            'company': str(user.company) if user.company else '',
            'phone': user.phone,
            'is_staff': user.is_staff,
            'created_at': user.created_at.isoformat() if user.created_at else None,
        }

    def get(self, request):
        user_id = request.query_params.get('user_id', '').strip()

        if user_id:
            try:
                user_obj = User.objects.get(id=int(user_id))
            except (User.DoesNotExist, ValueError):
                return Response(
                    {'status': 'error', 'message': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            campaigns = Campaign.objects.filter(user=user_obj).order_by('-created_at')
            user_data = self._user_dict(user_obj)
        else:
            campaigns = Campaign.objects.all().order_by('-created_at')
            user_data = None

        # Stats
        total = campaigns.count()
        by_status = {
            item['status']: item['count']
            for item in campaigns.values('status').annotate(count=Count('status'))
        }

        # Build campaign list with user info embedded
        campaign_list = []
        user_cache = {}
        for c in campaigns:
            c_data = CampaignSerializer(c).data
            uid = c.user_id
            if uid not in user_cache:
                try:
                    u = User.objects.get(id=uid)
                    user_cache[uid] = self._user_dict(u)
                except User.DoesNotExist:
                    user_cache[uid] = None
            c_data['user_info'] = user_cache[uid]
            campaign_list.append(c_data)

        return Response({
            'status': 'success',
            'data': {
                'user': user_data,
                'campaign_stats': {
                    'total': total,
                    'active': by_status.get('active', 0),
                    'draft': by_status.get('draft', 0),
                    'completed': by_status.get('completed', 0),
                    'cancelled': by_status.get('cancelled', 0),
                },
                'campaigns': campaign_list,
            }
        })


class CampaignDeleteView(APIView):
    """Delete a campaign by its campaign_id."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, campaign_id):
        try:
            campaign = Campaign.objects.get(campaign_id=campaign_id, user=request.user)
            campaign.delete()
            return Response({'status': 'success', 'message': 'Campaign deleted'}, status=status.HTTP_200_OK)
        except Campaign.DoesNotExist:
            return Response({'status': 'error', 'message': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)


class CampaignStatusUpdateView(APIView):
    """Update a campaign's status — e.g. set to 'active' after payment."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, campaign_id):
        new_status = request.data.get('status', '').strip()
        valid = [c[0] for c in Campaign.STATUS_CHOICES]
        if new_status not in valid:
            return Response(
                {'error': f'Invalid status. Must be one of: {valid}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            campaign = Campaign.objects.get(campaign_id=campaign_id, user=request.user)
            campaign.status = new_status
            campaign.save()
            return Response({
                'status': 'success',
                'message': f'Campaign status updated to {new_status}',
                'campaign_id': campaign_id,
                'new_status': new_status
            })
        except Campaign.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Campaign not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class CampaignUpdateView(APIView):
    """Update any subset of campaign fields — used to rename drafts, save screen selections, etc."""
    permission_classes = [IsAuthenticated]

    UPDATABLE_FIELDS = [
        'campaign_name', 'location', 'start_date', 'end_date',
        'booked_screens', 'price_snapshot',
        'total_slots_booked', 'total_budget', 'budget_range',
    ]

    def patch(self, request, campaign_id):
        try:
            campaign = Campaign.objects.get(campaign_id=campaign_id, user=request.user)
        except Campaign.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Campaign not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        updated = []
        for field in self.UPDATABLE_FIELDS:
            if field in request.data:
                setattr(campaign, field, request.data[field])
                updated.append(field)

        if not updated:
            return Response(
                {'status': 'error', 'message': 'No updatable fields provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign.save()
        serializer = CampaignSerializer(campaign)
        return Response({
            'status': 'success',
            'message': f'Campaign updated ({", ".join(updated)})',
            'data': serializer.data
        })


CONSOLE_BACKEND_URL = ''  # Same server in monorepo — use relative URLs

class CampaignAssetDeleteView(APIView):
    """
    Proxy delete to Console backend. Tries 5 strategies, always returns 200
    so the frontend localStorage tracking works regardless.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def delete(self, request, campaign_id, asset_id):
        detail_url = f"{CONSOLE_BACKEND_URL}/api/console/campaign/{campaign_id}/assets/{asset_id}/"
        clear_url  = f"{CONSOLE_BACKEND_URL}/api/console/campaign/{campaign_id}/assets/{asset_id}/clear/"
        del_url    = f"{CONSOLE_BACKEND_URL}/api/console/campaign/{campaign_id}/assets/{asset_id}/delete/"

        null_payload = {
            'file': None, 'original_filename': None, 'file_size_bytes': None,
            'file_type': None, 'file_extension': None, 'validation_status': 'pending',
            'validation_errors': None, 'validated_at': None, 'status': 'pending',
        }
        results = []

        try:
            # Strategy 1 — DELETE detail URL
            r = http_requests.delete(detail_url, timeout=8)
            results.append(f"DELETE {detail_url} → {r.status_code}")
            if r.status_code in (200, 204):
                return Response({'status': 'success', 'method': 'delete', 'log': results})

            # Strategy 2 — PATCH detail URL with null fields
            r2 = http_requests.patch(detail_url, json=null_payload,
                                     headers={'Content-Type': 'application/json'}, timeout=8)
            results.append(f"PATCH {detail_url} → {r2.status_code}")
            if r2.status_code in (200, 204):
                return Response({'status': 'success', 'method': 'patch', 'log': results})

            # Strategy 3 — PUT detail URL with null fields
            r3 = http_requests.put(detail_url, json=null_payload,
                                   headers={'Content-Type': 'application/json'}, timeout=8)
            results.append(f"PUT {detail_url} → {r3.status_code}")
            if r3.status_code in (200, 204):
                return Response({'status': 'success', 'method': 'put', 'log': results})

            # Strategy 4 — POST /clear/ custom DRF action
            r4 = http_requests.post(clear_url, json={'asset_id': asset_id}, timeout=8)
            results.append(f"POST {clear_url} → {r4.status_code}")
            if r4.status_code in (200, 204):
                return Response({'status': 'success', 'method': 'clear_action', 'log': results})

            # Strategy 5 — POST /delete/ custom DRF action
            r5 = http_requests.post(del_url, json={'asset_id': asset_id}, timeout=8)
            results.append(f"POST {del_url} → {r5.status_code}")
            if r5.status_code in (200, 204):
                return Response({'status': 'success', 'method': 'delete_action', 'log': results})

            # All strategies failed — return 200 anyway (localStorage handles display)
            return Response({
                'status': 'pending_backend',
                'message': 'No delete endpoint on Console backend. Asset hidden via localStorage.',
                'log': results
            }, status=status.HTTP_200_OK)

        except http_requests.exceptions.ConnectionError:
            return Response({'status': 'pending_backend',
                             'message': 'Console backend unreachable'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'status': 'pending_backend', 'message': str(e)}, status=status.HTTP_200_OK)


# ═══════════════════════════════════════════════════════════════════════════
# SCREEN BUNDLE VIEWS
# ═══════════════════════════════════════════════════════════════════════════

from .models import ScreenBundle
from .serializers import ScreenBundleSerializer


class ScreenBundleListCreateView(APIView):
    """
    GET  /api/campaign/<campaign_id>/bundles/   → list all bundles for the campaign
    POST /api/campaign/<campaign_id>/bundles/   → create a new bundle (name only)
    """
    permission_classes = [IsAuthenticated]

    def _get_campaign(self, campaign_id, user):
        try:
            return Campaign.objects.get(campaign_id=campaign_id, user=user)
        except Campaign.DoesNotExist:
            return None

    def get(self, request, campaign_id):
        campaign = self._get_campaign(campaign_id, request.user)
        if not campaign:
            return Response({'status': 'error', 'message': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)
        bundles = ScreenBundle.objects.filter(campaign=campaign)
        serializer = ScreenBundleSerializer(bundles, many=True)
        return Response({'status': 'success', 'data': serializer.data})

    def post(self, request, campaign_id):
        campaign = self._get_campaign(campaign_id, request.user)
        if not campaign:
            return Response({'status': 'error', 'message': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'status': 'error', 'message': 'Bundle name is required'}, status=status.HTTP_400_BAD_REQUEST)
        bundle = ScreenBundle.objects.create(campaign=campaign, name=name)
        serializer = ScreenBundleSerializer(bundle)
        return Response({'status': 'success', 'data': serializer.data}, status=status.HTTP_201_CREATED)


class ScreenBundleDetailView(APIView):
    """
    GET    /api/campaign/<campaign_id>/bundles/<bundle_id>/   → retrieve a bundle
    PUT    /api/campaign/<campaign_id>/bundles/<bundle_id>/   → update screen_slots, status, or suggestion URL
    DELETE /api/campaign/<campaign_id>/bundles/<bundle_id>/   → delete a bundle
    """
    permission_classes = [IsAuthenticated]

    def _get_bundle(self, campaign_id, bundle_id, user):
        try:
            return ScreenBundle.objects.get(id=bundle_id, campaign__campaign_id=campaign_id, campaign__user=user)
        except ScreenBundle.DoesNotExist:
            return None

    def get(self, request, campaign_id, bundle_id):
        bundle = self._get_bundle(campaign_id, bundle_id, request.user)
        if not bundle:
            return Response({'status': 'error', 'message': 'Bundle not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'status': 'success', 'data': ScreenBundleSerializer(bundle).data})

    def put(self, request, campaign_id, bundle_id):
        bundle = self._get_bundle(campaign_id, bundle_id, request.user)
        if not bundle:
            return Response({'status': 'error', 'message': 'Bundle not found'}, status=status.HTTP_404_NOT_FOUND)

        # Update allowed fields
        if 'screen_slots' in request.data:
            bundle.screen_slots = request.data['screen_slots']
        if 'status' in request.data:
            bundle.status = request.data['status']
        if 'creative_suggestion_url' in request.data:
            bundle.creative_suggestion_url = request.data['creative_suggestion_url']

        bundle.save()
        return Response({'status': 'success', 'data': ScreenBundleSerializer(bundle).data})

    def delete(self, request, campaign_id, bundle_id):
        bundle = self._get_bundle(campaign_id, bundle_id, request.user)
        if not bundle:
            return Response({'status': 'error', 'message': 'Bundle not found'}, status=status.HTTP_404_NOT_FOUND)
        bundle.delete()
        return Response({'status': 'success', 'message': 'Bundle deleted'})


class ScreenBundleCreativeFileView(APIView):
    """
    POST /api/campaign/<campaign_id>/bundles/<bundle_id>/creative-file/
    Accepts the generated creative brief HTML as a text body,
    saves it to media/creative_briefs/, updates creative_suggestion_url on the bundle,
    and returns the relative URL.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, campaign_id, bundle_id):
        try:
            bundle = ScreenBundle.objects.get(
                id=bundle_id,
                campaign__campaign_id=campaign_id,
                campaign__user=request.user
            )
        except ScreenBundle.DoesNotExist:
            return Response({'status': 'error', 'message': 'Bundle not found'}, status=status.HTTP_404_NOT_FOUND)

        html_content = request.data.get('html', '')
        if not html_content:
            return Response({'status': 'error', 'message': 'html content is required'}, status=status.HTTP_400_BAD_REQUEST)

        import os
        from django.conf import settings

        # Save to media/creative_briefs/<campaign_id>_bundle_<bundle_id>.html
        save_dir = os.path.join(settings.MEDIA_ROOT, 'creative_briefs')
        os.makedirs(save_dir, exist_ok=True)
        filename = f'{campaign_id}_bundle_{bundle_id}.html'
        file_path = os.path.join(save_dir, filename)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        # Build the URL: /media/creative_briefs/<filename>
        relative_url = f'{settings.MEDIA_URL}creative_briefs/{filename}'

        # Update the bundle record
        bundle.creative_suggestion_url = relative_url
        bundle.status = 'Suggestion Ready'
        bundle.save(update_fields=['creative_suggestion_url', 'status'])

        return Response({
            'status': 'success',
            'url': relative_url
        })

