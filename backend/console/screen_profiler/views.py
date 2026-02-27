from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny  # For testing, change to IsAuthenticated later
from django.conf import settings


class ScreenProfileAPIView(APIView):
    """
    API endpoint for Area Context Intelligence
    Analyzes screen locations and returns area context profile
    
    POST /api/screen-profile/<screen_id>/  - Analyze by screen ID
    POST /api/screen-profile/  - Analyze by coordinates in body
    GET  /api/screen-profile/<screen_id>/  - Retrieve saved profile
    """
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated for production
    
    def get(self, request, screen_id):
        """Retrieve the profiling result for a screen."""
        from .models import ScreenProfile
        try:
            profile = ScreenProfile.objects.get(screen_id=screen_id)
            return Response({
                'status': 'success',
                'mode': profile.mode,
                'data': profile.to_response_dict()
            }, status=status.HTTP_200_OK)
        except ScreenProfile.DoesNotExist:
            return Response({
                'status': 'error',
                'error': 'No profile found for this screen'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def post(self, request, screen_id=None):
        """
        Analyze screen location and return area context profile
        """
        try:
            screen_obj = None
            
            # 1. Get parameters from request body first
            latitude = request.data.get('latitude')
            longitude = request.data.get('longitude')
            indoor_input = request.data.get('indoor')
            height_input = request.data.get('height_from_ground_ft')
            mode = request.data.get('mode', 'hybrid')
            
            # 2. Handle screen_id from URL to fill missing data
            if screen_id:
                from console.models import ScreenSpec
                try:
                    screen_obj = ScreenSpec.objects.get(pk=screen_id)
                    # Use screen coordinates if not provided in body
                    if latitude is None:
                        latitude = screen_obj.latitude
                    if longitude is None:
                        longitude = screen_obj.longitude
                    
                    # Also use indoor status and height if not provided
                    if indoor_input is None:
                        indoor_input = (screen_obj.environment == 'Indoor')
                    if height_input is None:
                        height_input = float(screen_obj.mounting_height_ft or 0.0)
                        
                except (ScreenSpec.DoesNotExist, ValueError):
                    return Response({
                        'status': 'error',
                        'error': {
                            'code': 'SCREEN_NOT_FOUND',
                            'message': f'Screen with ID {screen_id} not found'
                        }
                    }, status=status.HTTP_404_NOT_FOUND)
            
            # 3. Final defaults and validation
            if latitude is None or longitude is None:
                return Response({
                    'status': 'error',
                    'error': {
                        'code': 'INVALID_INPUT',
                        'message': 'latitude and longitude are required (either in body or via screen_id)'
                    }
                }, status=status.HTTP_400_BAD_REQUEST)
            
            indoor = bool(indoor_input) if indoor_input is not None else False
            height_from_ground_ft = float(height_input) if height_input is not None else 0.0
            
            # Validate mode
            if mode not in ['rules', 'hybrid']:
                return Response({
                    'status': 'error',
                    'error': {
                        'code': 'INVALID_MODE',
                        'message': 'mode must be "rules" or "hybrid"'
                    }
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Import and use area context service
            from .area_context_service import get_area_context_service
            
            area_context_service = get_area_context_service()
            
            # Choose analysis method based on mode
            if mode == 'hybrid':
                profile = area_context_service.analyze_screen_location_hybrid(
                    latitude=float(latitude),
                    longitude=float(longitude),
                    indoor=indoor,
                    height_from_ground_ft=float(height_from_ground_ft)
                )
            else:
                profile = area_context_service.analyze_screen_location(
                    latitude=float(latitude),
                    longitude=float(longitude),
                    indoor=indoor,
                    height_from_ground_ft=float(height_from_ground_ft)
                )
            
            # Save results to Database
            try:
                from .models import ScreenProfile
                from django.utils.dateparse import parse_datetime
                
                geo = profile.get("geoContext", {})
                area = profile.get("area", {})
                mvm = profile.get("movement", {})
                meta = profile.get("metadata", {})
                llm = profile.get("llmEnhancement", {})
                rings = profile.get("ringAnalysis", {})
                
                computed_at = None
                if meta.get("computedAt"):
                    computed_at = parse_datetime(meta["computedAt"])

                # Upsert: one profile per screen, re-profile overwrites
                ScreenProfile.objects.update_or_create(
                    screen=screen_obj,
                    defaults={
                        # Input
                        'latitude': float(latitude),
                        'longitude': float(longitude),
                        'mode': mode,

                        # Geo Context
                        'city': geo.get("city", ""),
                        'state': geo.get("state", ""),
                        'country': geo.get("country", ""),
                        'city_tier': geo.get("cityTier", ""),
                        'formatted_address': geo.get("formattedAddress", ""),

                        # Area
                        'primary_type': area.get("primaryType", ""),
                        'area_context': area.get("context", ""),
                        'confidence': area.get("confidence", ""),
                        'classification_detail': area.get("classificationDetail", ""),
                        'dominant_group': area.get("dominantGroup", ""),

                        # Movement
                        'movement_type': mvm.get("type", ""),
                        'movement_context': mvm.get("context", ""),

                        # Dwell
                        'dwell_category': profile.get("dwellCategory", ""),
                        'dwell_confidence': profile.get("dwellConfidence"),
                        'dwell_score': profile.get("dwellScore"),

                        # Dominance
                        'dominance_ratio': profile.get("dominanceRatio"),

                        # Ring Analysis
                        'ring1_analysis': rings.get("ring1"),
                        'ring2_analysis': rings.get("ring2"),
                        'ring3_analysis': rings.get("ring3"),

                        # Reasoning
                        'reasoning': profile.get("reasoning", []),

                        # LLM
                        'llm_used': llm.get("used", False),
                        'llm_reason': llm.get("reason", ""),
                        'llm_mode': llm.get("mode", ""),

                        # Metadata
                        'profiled_at': computed_at,
                        'api_calls_made': meta.get("apiCallsMade", 0),
                        'cached': meta.get("cached", False),
                        'processing_time_ms': meta.get("processingTimeMs"),
                        'api_key_configured': meta.get("apiKeyConfigured", True),
                        'warnings': meta.get("warnings", []),
                        'version': meta.get("version", ""),
                    }
                )
                
                # If we have a screen object, update its profiling status
                if screen_obj:
                    screen_obj.is_profiled = True
                    screen_obj.profile_status = 'PROFILED'
                    screen_obj.save()
                    
            except Exception as save_error:
                # Log but don't fail the main request if DB save fails
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error saving ScreenProfile to database: {save_error}")
            
            return Response({
                'status': 'success',
                'mode': mode,
                'data': profile
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            error_details = {
                'code': 'COMPUTATION_ERROR',
                'message': str(e),
            }
            
            if settings.DEBUG:
                error_details['traceback'] = traceback.format_exc()
            
            return Response({
                'status': 'error',
                'error': error_details
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ScreenProfileListView(APIView):
    """
    GET endpoint to list all screen AI profiles with optional filters.

    GET Query Params:
      - screen_id: filter by screen FK id (exact match)
      - city: filter by city (case-insensitive partial match)
      - primary_type: filter by area primary type (e.g. COMMERCIAL, MIXED_BIASED)
      - confidence: filter by confidence level (high/medium/low)
      - movement_type: filter by movement type (e.g. SLOW_FLOW)
      - dwell_category: filter by dwell category (e.g. MEDIUM_WAIT)
      - state: filter by state (case-insensitive partial match)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from .models import ScreenProfile

        profiles = ScreenProfile.objects.all().order_by('-created_at')

        # Optional filters
        screen_id = request.query_params.get('screen_id')
        if screen_id:
            profiles = profiles.filter(screen_id=screen_id)

        city = request.query_params.get('city')
        if city:
            profiles = profiles.filter(city__icontains=city)

        state = request.query_params.get('state')
        if state:
            profiles = profiles.filter(state__icontains=state)

        primary_type = request.query_params.get('primary_type')
        if primary_type:
            profiles = profiles.filter(primary_type__icontains=primary_type)

        confidence = request.query_params.get('confidence')
        if confidence:
            profiles = profiles.filter(confidence__iexact=confidence)

        movement_type = request.query_params.get('movement_type')
        if movement_type:
            profiles = profiles.filter(movement_type__icontains=movement_type)

        dwell_category = request.query_params.get('dwell_category')
        if dwell_category:
            profiles = profiles.filter(dwell_category__icontains=dwell_category)

        # Build response
        data = []
        for profile in profiles:
            data.append({
                "id": profile.id,
                "screen_id": profile.screen_id,
                "screen_name": str(profile.screen.screen_name) if profile.screen else None,
                "city": profile.city,
                "state": profile.state,
                "country": profile.country,
                "city_tier": profile.city_tier,
                "formatted_address": profile.formatted_address,
                "primary_type": profile.primary_type,
                "area_context": profile.area_context,
                "confidence": profile.confidence,
                "classification_detail": profile.classification_detail,
                "dominant_group": profile.dominant_group,
                "movement_type": profile.movement_type,
                "movement_context": profile.movement_context,
                "dwell_category": profile.dwell_category,
                "dwell_confidence": profile.dwell_confidence,
                "dwell_score": profile.dwell_score,
                "dominance_ratio": profile.dominance_ratio,
                "llm_used": profile.llm_used,
                "llm_reason": profile.llm_reason,
                "mode": profile.mode,
                "latitude": float(profile.latitude),
                "longitude": float(profile.longitude),
                "profiled_at": profile.profiled_at,
                "created_at": profile.created_at,
                "updated_at": profile.updated_at,
            })

        return Response({
            "total": len(data),
            "profiles": data,
        }, status=status.HTTP_200_OK)
