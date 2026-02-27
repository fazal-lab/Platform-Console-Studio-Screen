"""
XIA Views
---------
"""

import uuid
import re
import os
import logging

from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status

from .models import ScreenMaster, ChatSession
from .serializers import ScreenMasterSerializer
from .services.sync_service import ScreenSyncService
from .services.discover_service import discover_screens

logger = logging.getLogger('xia.views')


class HealthCheckView(APIView):
    """
    GET /xia/health/
    Simple health check — proves XIA is alive.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(
            {
                'status': 'ok',
                'app': 'xia',
                'version': '0.1.0',
            },
            status=status.HTTP_200_OK,
        )


class ScreenMasterListView(ListAPIView):
    """
    GET /xia/screens/
    Returns all screens from the ScreenMaster table.
    """
    queryset = ScreenMaster.objects.all()
    serializer_class = ScreenMasterSerializer


class SyncScreensView(APIView):
    """
    POST /xia/sync/screens/
    Triggers a full sync from the console screens API.
    """

    def post(self, request):
        service = ScreenSyncService()

        try:
            created, updated, errors = service.sync()
        except Exception as e:
            return Response(
                {'status': 'error', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                'status': 'ok',
                'created': created,
                'updated': updated,
                'errors': errors,
            },
            status=status.HTTP_200_OK,
        )


class ScreenDiscoverView(APIView):
    """
    POST /xia/discover/
    Replicates Console's screen discovery endpoint.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        location_raw = request.data.get('location', '')
        start_date = request.data.get('start_date', '')
        end_date = request.data.get('end_date', '')
        budget_range = request.data.get('budget_range', '')

        if isinstance(location_raw, list):
            locations = [str(loc).strip() for loc in location_raw if str(loc).strip()]
        elif isinstance(location_raw, str) and location_raw.strip():
            locations = [location_raw.strip()]
        else:
            locations = []

        errors = {}
        if not locations:
            errors['location'] = 'This field is required.'
        if not start_date:
            errors['start_date'] = 'This field is required.'
        if not end_date:
            errors['end_date'] = 'This field is required.'
        if not budget_range:
            errors['budget_range'] = 'This field is required.'
        if errors:
            return Response(
                {'message': 'Missing required fields.', 'errors': errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = discover_screens(locations, start_date, end_date, str(budget_range))
        except Exception as e:
            return Response(
                {'message': f'Discovery failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(result, status=status.HTTP_200_OK)


class XIAChatView(APIView):
    """
    POST /xia/chat/

    Conversational endpoint for XIA-guided screen discovery.

    First message (no session_id):
      - XIA generates a session_id
      - Stores gateway params + user/campaign
      - Runs initial discover
      - Returns session_id + screens + reply

    Subsequent messages (with session_id):
      - Loads existing session
      - (Future) LLM extracts intent → modifies filters
      - Re-runs discover with updated filters
      - Returns updated screens + reply

    Request body:
      {
        "session_id": null,               // null on first call
        "user_id": "user_123",            // from Studio auth
        "campaign_id": "camp_456",        // from Studio
        "gateway": {
          "start_date": "2026-03-01",
          "end_date": "2026-03-15",
          "location": ["Chennai"],
          "budget_range": "50000"
        },
        "message": "I want transit screens"
      }
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        session_id = request.data.get('session_id')
        user_id = request.data.get('user_id', '')
        campaign_id = request.data.get('campaign_id', '')
        gateway = request.data.get('gateway', {})
        message = request.data.get('message', '')
        debug_mode = request.data.get('debug', False)

        # Validate basics
        if not user_id:
            return Response(
                {'message': 'user_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not message:
            return Response(
                {'message': 'message is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Session management ──────────────────────────────────────
        if not session_id:
            # FIRST MESSAGE — create new session
            if not campaign_id:
                return Response(
                    {'message': 'campaign_id is required for first message.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate gateway on first message
            gw_location = gateway.get('location', [])
            gw_start = gateway.get('start_date', '')
            gw_end = gateway.get('end_date', '')
            gw_budget = gateway.get('budget_range', '')

            if isinstance(gw_location, str):
                gw_location = [gw_location] if gw_location.strip() else []

            gw_errors = {}
            if not gw_location:
                gw_errors['location'] = 'Required in gateway.'
            if not gw_start:
                gw_errors['start_date'] = 'Required in gateway.'
            if not gw_end:
                gw_errors['end_date'] = 'Required in gateway.'
            if not gw_budget:
                gw_errors['budget_range'] = 'Required in gateway.'
            if gw_errors:
                return Response(
                    {'message': 'Gateway fields missing.', 'errors': gw_errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            new_session_id = uuid.uuid4()
            session = ChatSession.objects.create(
                session_id=new_session_id,
                user_id=user_id,
                campaign_id=campaign_id,
                gateway_start_date=gw_start,
                gateway_end_date=gw_end,
                gateway_location=gw_location,
                gateway_budget_range=str(gw_budget),
                active_filters={},
            )
            logger.info(f'New chat session: {new_session_id} for user={user_id} campaign={campaign_id}')

        else:
            # SUBSEQUENT MESSAGE — load existing session
            try:
                session = ChatSession.objects.get(session_id=session_id)
            except ChatSession.DoesNotExist:
                return Response(
                    {'message': f'Session {session_id} not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # If gateway is passed again, allow updates
            if gateway:
                if gateway.get('start_date'):
                    session.gateway_start_date = gateway['start_date']
                if gateway.get('end_date'):
                    session.gateway_end_date = gateway['end_date']
                if gateway.get('location'):
                    loc = gateway['location']
                    session.gateway_location = [loc] if isinstance(loc, str) else loc
                if gateway.get('budget_range'):
                    session.gateway_budget_range = str(gateway['budget_range'])
                session.save()

        # ── Input sanitization ──────────────────────────────────────
        # Strip HTML tags, script injections
        message = re.sub(r'<[^>]+>', '', message)
        # Truncate overly long inputs (>2000 chars)
        if len(message) > 2000:
            message = message[:2000]

        now = timezone.now().isoformat()

        # ── Rate limiting (50 messages per 15 minutes per session) ──
        if session_id and hasattr(session, 'messages'):
            recent_cutoff = (timezone.now() - timezone.timedelta(minutes=15)).isoformat()
            recent_user_msgs = [
                m for m in session.messages
                if m.get('role') == 'user'
                and m.get('timestamp', '') >= recent_cutoff
            ]
            if len(recent_user_msgs) >= 50:
                return Response({
                    'session_id': str(session.session_id),
                    'reply': "You're sending messages too quickly. Please wait a moment before continuing.",
                    'screens': [],
                    'rate_limited': True,
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # ── Append user message to session ─────────────────────────
        session.messages.append({
            'role': 'user',
            'content': message,
            'timestamp': now,
        })

        # ── CALL #1: Understanding + Extraction ────────────────────
        from .services.llm_service import LLMService
        from .services.filter_menu import build_filter_menu
        from .prompts.call1_prompt import build_call1_prompt

        # Build dynamic filter menu from DB
        filter_menu = build_filter_menu()

        # ── Question Pipeline: determine next core question ──────
        def get_next_question_topic(sess):
            """Return the next unanswered core question topic, or '' if all done."""
            if not sess.ad_category:
                return 'ad_category'
            if not sess.brand_objective:
                return 'brand_objective'
            if not sess.target_audience:
                return 'target_audience'
            return ''  # All 3 answered → discovery complete

        next_question_topic = get_next_question_topic(session)

        # Build system prompt with current state + pipeline hint
        system_prompt = build_call1_prompt(
            user_message=message,
            history=session.messages[:-1],
            filter_menu=filter_menu,
            active_filters=session.active_filters,
            gateway={
                'start_date': session.gateway_start_date,
                'end_date': session.gateway_end_date,
                'location': session.gateway_location,
                'budget_range': session.gateway_budget_range,
            },
            next_question_topic=next_question_topic,
        )

        # Prepare conversation history for LLM (role + content only)
        history_for_llm = [
            {'role': m['role'], 'content': m['content']}
            for m in session.messages[:-1]  # exclude the just-appended message
        ]

        # ── Warnings tracker (surfaced in response for Studio) ─────
        warnings = []

        # Call Groq
        llm = LLMService()
        try:
            call1_result = llm.call1_extract(
                system_prompt=system_prompt,
                user_message=message,
                conversation_history=history_for_llm,
            )
        except Exception as e:
            logger.error(f'Call #1 failed: {e}')
            warnings.append(f'Understanding: {e}. Using fallback defaults')
            call1_result = {
                'intent': 'greeting',
                'detected_persona': '',
                'filters': {},
                'exclude': {},
                'text_search': '',
                'gateway_edits': {},
                'gateway_edit_pending': False,
                'remove_filters': [],
                'question_to_ask': '',
                'pending_questions': [],
                'ad_category': '',
                'brand_objective': '',
                'target_audience': '',
                '_meta': {'error': str(e), 'fallback': True},
            }

        logger.info(f'Call #1 result: intent={call1_result.get("intent")} '
                     f'persona={call1_result.get("detected_persona")} '
                     f'filters={call1_result.get("filters")}')

        # Detect LLM-service-level fallback (e.g. Groq 429 caught internally)
        c1_meta_check = call1_result.get('_meta', {})
        if c1_meta_check.get('fallback'):
            warnings.append(f'Understanding: {c1_meta_check.get("error", "unknown error")}. Using fallback defaults')

        # ── Process Call #1 output ──────────────────────────────────

        intent = call1_result.get('intent', 'greeting')
        new_filters = call1_result.get('filters', {})
        exclude_filters = call1_result.get('exclude', {})
        text_search = call1_result.get('text_search', '')
        gateway_edits = call1_result.get('gateway_edits', {})
        gateway_edit_pending = call1_result.get('gateway_edit_pending', False)
        gateway_updated = False
        remove_filters_list = call1_result.get('remove_filters', [])
        question_to_ask = call1_result.get('question_to_ask', '')
        pending_questions = call1_result.get('pending_questions', [])

        # ── Clean placeholder hallucinations from Call #1 ────────────
        # LLM sometimes returns "not specified", "unknown", "N/A" etc.
        _INVALID_PLACEHOLDERS = {
            'not specified', 'not provided', 'unknown', 'n/a', 'na',
            'none', 'null', 'undefined', 'tbd', 'not sure',
            'not applicable', 'not available', 'not yet', 'pending',
            '', 'any', 'general',
        }

        def _clean(val):
            """Return None if value is a placeholder hallucination."""
            if not val:
                return None
            if isinstance(val, str) and val.strip().lower() in _INVALID_PLACEHOLDERS:
                return None
            return val

        # Clean string fields
        text_search = _clean(text_search) or ''
        question_to_ask = _clean(question_to_ask) or ''

        # Clean filter dicts (remove keys with placeholder values)
        new_filters = {k: v for k, v in new_filters.items() if _clean(v) is not None} if new_filters else {}
        exclude_filters = {k: v for k, v in exclude_filters.items() if _clean(v) is not None} if exclude_filters else {}

        # Clean campaign context fields inline (applied when storing below)
        _clean_ad_category = _clean(call1_result.get('ad_category', ''))
        _clean_product_category = _clean(call1_result.get('product_category', ''))
        _clean_brand_objective = _clean(call1_result.get('brand_objective', ''))
        _clean_target_audience = _clean(call1_result.get('target_audience', ''))

        # ── Handle filter removal ───────────────────────────────────
        # Save current filters BEFORE any changes (for revert support)
        _prev_filters = dict(session.active_filters) if session.active_filters else {}

        # Revert intent: restore previous filter state from DB
        if intent == 'revert':
            if session.previous_filters:
                session.active_filters = session.previous_filters
            else:
                session.active_filters = {}
            # Skip normal filter processing
            new_filters = {}
            remove_filters_list = []

        # Safety net: show_all intent ALWAYS clears all filters
        if intent == 'show_all':
            remove_filters_list = ['__all__']

        if remove_filters_list:
            if '__all__' in remove_filters_list:
                session.active_filters = {}
            else:
                for key in remove_filters_list:
                    session.active_filters.pop(key, None)

        # Store prev state in DB for next revert
        session.previous_filters = _prev_filters

        # ══════════════════════════════════════════════════════════════
        # ── CODE ENFORCEMENT: Validate & fix Call #1 output ──────────
        # The LLM extracts intent + filters. The SYSTEM validates them.
        # This is the state management layer that coordinates all 3 calls.
        # ══════════════════════════════════════════════════════════════

        # ── 1. Intercept non-gateway cities in spec_city filter ──────
        # If LLM puts a city in spec_city that's NOT in the gateway,
        # Discover will return 0 results. Auto-convert to gateway_edit.
        gateway_cities_lower = [
            c.strip().lower() for c in (session.gateway_location or [])
        ]

        if 'spec_city' in new_filters:
            city_val = new_filters['spec_city']
            cities = city_val if isinstance(city_val, list) else [city_val]

            gateway_only = [c for c in cities if c.strip().lower() in gateway_cities_lower]
            non_gateway = [c for c in cities if c.strip().lower() not in gateway_cities_lower]

            if non_gateway:
                logger.warning(
                    f'Intercepted non-gateway cities in spec_city filter: {non_gateway}. '
                    f'Converting to gateway_edit.'
                )
                # Auto-convert to gateway edit
                gateway_edit_pending = True
                gateway_edits = gateway_edits or {}
                if len(non_gateway) == 1:
                    gateway_edits['gateway_location_add'] = non_gateway[0]
                else:
                    gateway_edits['gateway_location_add'] = non_gateway

            # Keep only valid gateway cities in the filter
            if gateway_only:
                new_filters['spec_city'] = gateway_only if len(gateway_only) > 1 else gateway_only[0]
            else:
                del new_filters['spec_city']

        # ── 2. Validate enum filter values against DB ────────────────
        # LLM sometimes invents filter values. Reject anything not in DB.
        from xia.services.filter_menu import ENUM_FIELDS, _get_distinct_values

        ENUM_FIELD_NAMES = {f[0] for f in ENUM_FIELDS}
        for field in list(new_filters.keys()):
            if field in ENUM_FIELD_NAMES and field != 'spec_city':
                valid_values = set(_get_distinct_values(field))
                if not valid_values:
                    continue  # Can't validate if no DB values yet

                val = new_filters[field]
                if isinstance(val, list):
                    cleaned = [v for v in val if v in valid_values]
                    if cleaned:
                        new_filters[field] = cleaned if len(cleaned) > 1 else cleaned[0]
                    else:
                        logger.warning(f'Removed invalid filter: {field}={val} (none valid)')
                        del new_filters[field]
                elif val not in valid_values:
                    logger.warning(f'Removed invalid filter: {field}={val}')
                    del new_filters[field]

        # ── 2b. Budget interceptor ────────────────────────────────────
        # There are TWO different "budget" concepts:
        #   A) gateway_budget_range — total campaign budget (e.g. "my budget is 500")
        #   B) base_price_per_slot_inr — per-slot screen price filter
        #      (e.g. "show me screens under 200/slot")
        #
        # LLM sometimes maps (A) into (B). We use message keywords to
        # distinguish which one the user actually meant.
        if 'base_price_per_slot_inr' in new_filters:
            price_filter = new_filters['base_price_per_slot_inr']
            user_lower = message.strip().lower()

            # Keywords that signal CAMPAIGN BUDGET (gateway edit)
            budget_keywords = {
                'budget', 'my budget', 'total budget', 'campaign budget',
                'i have', 'i only have', 'can spend', 'can afford',
                'spending limit', 'money', 'funds',
            }
            # Keywords that signal PER-SLOT PRICE (legitimate filter)
            price_keywords = {
                'per slot', 'per day', 'slot price', 'price per',
                'cost per', 'daily rate', 'rate per', 'slot rate',
                'cheap screen', 'expensive screen', 'affordable screen',
            }

            is_budget_intent = any(kw in user_lower for kw in budget_keywords)
            is_price_intent = any(kw in user_lower for kw in price_keywords)

            if is_budget_intent and not is_price_intent:
                # User is talking about CAMPAIGN BUDGET → gateway edit
                budget_value = None
                if isinstance(price_filter, dict):
                    vals = list(price_filter.values())
                    if len(vals) == 1:
                        budget_value = float(vals[0])
                elif isinstance(price_filter, (int, float, str)):
                    try:
                        budget_value = float(price_filter)
                    except (ValueError, TypeError):
                        pass

                if budget_value is not None:
                    logger.warning(
                        f'Budget interceptor: "{message}" looks like a '
                        f'campaign budget change (not price filter). '
                        f'Converting base_price_per_slot_inr={price_filter} '
                        f'to gateway_budget_range={budget_value}.'
                    )
                    del new_filters['base_price_per_slot_inr']
                    gateway_edit_pending = True
                    gateway_edits = gateway_edits or {}
                    gateway_edits['gateway_budget_range'] = str(int(budget_value))
            elif is_price_intent:
                # User explicitly asked about per-slot price → keep as filter
                logger.info(f'Budget interceptor: keeping price filter (price intent detected)')
            else:
                # Ambiguous — ask user to clarify
                logger.info(f'Budget interceptor: ambiguous, asking user to clarify')
                del new_filters['base_price_per_slot_inr']
                # Store the ambiguous value so Call #3 can reference it
                question_to_ask = (
                    f'You mentioned a number — did you mean your total campaign '
                    f'budget is ₹{price_filter if not isinstance(price_filter, dict) else list(price_filter.values())[0]}, '
                    f'or are you looking for screens priced under that per slot?'
                )
                intent = 'needs_more_info'

        # ── 3. Stack validated filters onto session ──────────────────
        if new_filters:
            for key, value in new_filters.items():
                if key == 'spec_city':
                    logger.info(f'Skipping spec_city filter — gateway handles location filtering')
                    continue
                session.active_filters[key] = value

        # ── Store exclude filters (separate from active_filters) ────
        # Exclude filters are applied at discover time, not stored
        # They're passed directly to discover_screens

        # ── 4. Gateway edit management ───────────────────────────────
        # CRITICAL ORDER:
        #   Step A: Check for EXISTING pending edits from a PREVIOUS turn.
        #           If they exist, the user's current message is a response
        #           to "Do you want to add X?" — apply or reject.
        #   Step B: THEN store any NEW proposed edits (if no existing ones).
        #
        # Why this order matters: When user says "Yes, add it", Call #1
        # returns gateway_edit_pending=True AGAIN (it sees the Theni
        # conversation and keeps proposing it). If we store first, the
        # approval check never fires.

        existing_pending = session.pending_gateway_edits or {}

        if existing_pending:
            # ── Step A: Process existing pending edits ────────────────
            # User is responding to a previous gateway edit proposal.
            # Check for rejection signals in the user's message.
            user_lower = message.strip().lower()
            rejection_signals = {'no', "don't", 'cancel', 'never mind',
                                 'keep current', 'forget it', 'nah',
                                 'not now', 'skip', 'remove'}

            is_rejection = any(sig in user_lower for sig in rejection_signals)
            is_start_over = (intent == 'start_over')

            if is_rejection or is_start_over:
                session.pending_gateway_edits = {}
                logger.info(f'Pending gateway edits rejected: {existing_pending}')
            else:
                # Apply the existing pending edits
                logger.info(f'Applying pending gateway edits: {existing_pending}')

                if 'gateway_location_add' in existing_pending:
                    new_city = existing_pending['gateway_location_add']
                    add_cities = new_city if isinstance(new_city, list) else [new_city]
                    current_locs = list(session.gateway_location or [])
                    current_locs_lower = [c.strip().lower() for c in current_locs]
                    for city in add_cities:
                        if city.strip().lower() not in current_locs_lower:
                            current_locs.append(city)
                    session.gateway_location = current_locs
                    logger.info(f'Gateway location updated: {current_locs}')

                if 'gateway_location' in existing_pending:
                    new_loc = existing_pending['gateway_location']
                    session.gateway_location = [new_loc] if isinstance(new_loc, str) else new_loc
                    logger.info(f'Gateway location replaced: {session.gateway_location}')

                if 'gateway_start_date' in existing_pending:
                    session.gateway_start_date = existing_pending['gateway_start_date']
                if 'gateway_end_date' in existing_pending:
                    session.gateway_end_date = existing_pending['gateway_end_date']
                if 'gateway_budget_range' in existing_pending:
                    session.gateway_budget_range = str(existing_pending['gateway_budget_range'])

                session.pending_gateway_edits = {}
                # Override: edits are now APPLIED, not pending anymore.
                # Change intent so pipeline flags recalculate correctly
                # and Call #3 presents results instead of re-asking.
                gateway_edit_pending = False
                gateway_edits = {}
                gateway_updated = True
                intent = 'screen_search'
                logger.info('Gateway edits applied — intent overridden to screen_search')

        elif gateway_edit_pending and gateway_edits:
            # ── Step B: Store NEW proposed edits (no existing ones) ───
            # But first: strip out gateway_location_add for cities already in gateway
            if 'gateway_location_add' in gateway_edits:
                add_val = gateway_edits['gateway_location_add']
                add_list = add_val if isinstance(add_val, list) else [add_val]
                existing_lower = [c.strip().lower() for c in (session.gateway_location or [])]
                truly_new = [c for c in add_list if c.strip().lower() not in existing_lower]
                if not truly_new:
                    # All proposed cities already in gateway — skip the edit entirely
                    del gateway_edits['gateway_location_add']
                    logger.info(f'gateway_location_add skipped — cities already in gateway: {add_list}')
                elif len(truly_new) == 1:
                    gateway_edits['gateway_location_add'] = truly_new[0]
                else:
                    gateway_edits['gateway_location_add'] = truly_new

            # Only store if there are still edits left
            if gateway_edits:
                session.pending_gateway_edits = gateway_edits
            else:
                gateway_edit_pending = False
                logger.info('All proposed gateway edits were redundant — no pending edits stored')

        # ── 5. Intent-based pipeline flags ───────────────────────────
        # These flags control what happens downstream, ensuring all 3
        # calls see consistent state.
        #
        # skip_ranking: Don't waste tokens on Call #2
        # suppress_screens: Don't show screen results in Call #3
        SKIP_RANKING_INTENTS = {
            'gateway_edit_pending', 'greeting', 'clarification',
            'start_over', 'needs_more_info',
        }
        SUPPRESS_SCREEN_INTENTS = {
            'gateway_edit_pending', 'greeting', 'start_over',
        }

        skip_ranking = intent in SKIP_RANKING_INTENTS
        suppress_screens = intent in SUPPRESS_SCREEN_INTENTS

        logger.info(
            f'Pipeline flags: intent={intent}, skip_ranking={skip_ranking}, '
            f'suppress_screens={suppress_screens}, gateway_edit_pending={gateway_edit_pending}'
        )

        # ══════════════════════════════════════════════════════════════

        # ── Store campaign context (accumulates over messages) ──────
        if _clean_ad_category:
            session.ad_category = _clean_ad_category
        if _clean_product_category:
            session.product_category = _clean_product_category
        if _clean_brand_objective:
            session.brand_objective = _clean_brand_objective
        if _clean_target_audience:
            session.target_audience = _clean_target_audience

        # ── Check if discovery pipeline is complete ─────────────────
        if (session.ad_category and session.brand_objective and
                session.target_audience and not session.discovery_complete):
            session.discovery_complete = True
            # Clear any question Call #1 generated — it was built BEFORE
            # we knew all 3 answers were in, so it's stale.
            question_to_ask = ''
            logger.info('Discovery pipeline complete — all 3 core questions answered. '
                        'Suppressed leftover question_to_ask.')

        # Guard: suppress any questions after discovery is done (handles
        # both the transition turn above AND later turns where Call #1
        # might still hallucinate a question despite empty pipeline hint)
        if session.discovery_complete and question_to_ask:
            logger.info(f'Post-discovery question suppressed: "{question_to_ask}"')
            question_to_ask = ''

        # ── Store persona (with anti-flickering) ────────────────────
        new_persona = call1_result.get('detected_persona', '')
        new_confidence = call1_result.get('persona_confidence', 0.6)
        if new_persona:
            if not session.detected_persona:
                # First detection — just set it
                session.detected_persona = new_persona
                session.persona_confidence = new_confidence
            elif new_persona == session.detected_persona:
                # Same persona — boost confidence slightly
                session.persona_confidence = min(1.0, session.persona_confidence + 0.05)
            else:
                # Different persona detected — apply stability rules
                # Only switch if significantly more confident (shared_rules.md)
                confidence_gap = new_confidence - session.persona_confidence
                if confidence_gap >= 0.2 or new_confidence >= 0.8:
                    logger.info(
                        f'Persona switch: {session.detected_persona} -> {new_persona} '
                        f'(gap={confidence_gap:.2f}, new_conf={new_confidence:.2f})'
                    )
                    session.detected_persona = new_persona
                    session.persona_confidence = new_confidence
                # else: keep current persona, ignore the flicker

        # ── Store pending questions ─────────────────────────────────
        if pending_questions:
            session.pending_questions = pending_questions

        # ── Handle start_over intent ─────────────────────────────
        if intent == 'start_over':
            session.active_filters = {}
            session.ad_category = ''
            session.product_category = ''
            session.brand_objective = ''
            session.target_audience = ''
            session.discovery_complete = False
            session.pending_gateway_edits = {}
            session.pending_questions = []
            session.question_attempts = {}
            logger.info('Start over: cleared filters, campaign context, and discovery pipeline')

        # ── Question attempt counter (Pattern 5) ─────────────────
        # Track how many times each question topic was asked.
        # If asked 2+ times → skip it, try next from pending_questions.
        MAX_QUESTION_ATTEMPTS = 2
        if question_to_ask:
            attempts = session.question_attempts or {}
            q_key = question_to_ask.strip().lower()
            current_count = attempts.get(q_key, 0)

            if current_count >= MAX_QUESTION_ATTEMPTS:
                logger.info(f'Skipping question (asked {current_count}x): {q_key}')
                # Try the next pending question instead
                fallback_q = ''
                remaining = list(session.pending_questions or [])
                while remaining:
                    candidate = remaining.pop(0)
                    c_key = candidate.strip().lower()
                    if attempts.get(c_key, 0) < MAX_QUESTION_ATTEMPTS:
                        fallback_q = candidate
                        break
                question_to_ask = fallback_q
                session.pending_questions = remaining

            # Increment counter for the chosen question
            if question_to_ask:
                q_key = question_to_ask.strip().lower()
                attempts[q_key] = attempts.get(q_key, 0) + 1
                session.question_attempts = attempts

        # ── Discover: ALWAYS runs ────────────────────────────────────
        # Once the user enters XIA chat, XIA's discover API takes over
        # from Studio's discover. Gateway-filtered screens are mandatory
        # on every message, regardless of intent.
        discover_result = None
        try:
            discover_result = discover_screens(
                locations=session.gateway_location,
                start_date_str=session.gateway_start_date,
                end_date_str=session.gateway_end_date,
                budget_range=session.gateway_budget_range,
                xia_filters=session.active_filters,
                exclude_filters=exclude_filters,
                text_search=text_search,
            )
        except Exception as e:
            logger.error(f'Discover failed in chat: {e}')
            discover_result = {
                'screens': [], 'total_screens_found': 0,
                'available_screens': 0, 'unavailable_screens': 0,
            }

        # ── CALL #2: Ranking + Reasoning ───────────────────────────
        # Controlled by skip_ranking flag from intent-based routing.
        call2_result = None
        if discover_result and not skip_ranking:
            raw_screens = discover_result.get('screens', [])
            if len(raw_screens) >= 2:
                try:
                    call2_result = llm.call2_rank(
                        screens=raw_screens,
                        ad_category=session.ad_category,
                        product_category=session.product_category,
                        brand_objective=session.brand_objective,
                        target_audience=session.target_audience,
                        persona=session.detected_persona,
                        user_message=message,
                    )

                    # Reorder screens by ranking
                    ranking = call2_result.get('ranking', [])
                    scores = call2_result.get('screen_scores', {})
                    rubrics = call2_result.get('screen_rubrics', {})

                    screen_by_id = {s['id']: s for s in raw_screens}
                    ranked_screens = []
                    for sid in ranking:
                        if sid in screen_by_id:
                            screen = screen_by_id[sid]
                            screen['relevance_score'] = scores.get(str(sid), 0)
                            # Extract rubric (flat sub-scores + summary)
                            rubric = rubrics.get(str(sid), {})
                            if isinstance(rubric, dict):
                                screen['score_rubric'] = rubric
                                screen['ranking_reason'] = rubric.get('summary', '')
                            else:
                                screen['ranking_reason'] = str(rubric) if rubric else ''
                                screen['score_rubric'] = {}
                            ranked_screens.append(screen)

                    # Append any screens not in ranking at the end
                    ranked_ids = set(ranking)
                    for s in raw_screens:
                        if s['id'] not in ranked_ids:
                            s['relevance_score'] = 0
                            s['ranking_reason'] = 'Not ranked.'
                            s['score_rubric'] = {}
                            ranked_screens.append(s)

                    discover_result['screens'] = ranked_screens

                    logger.info(
                        f'Call #2 ranking applied: {ranking} | '
                        f'Scores: {scores}'
                    )
                except Exception as e:
                    logger.error(f'Call #2 failed: {e}. Screens in original order.')
                    warnings.append(f'Ranking: {e}. Screens returned unranked')
                    call2_result = {
                        '_meta': {'error': str(e), 'fallback': True},
                    }
            elif len(raw_screens) == 1:
                # Single screen — skip ranking, still attach a score
                raw_screens[0]['relevance_score'] = 100
                raw_screens[0]['ranking_reason'] = 'Only screen matching your criteria.'

        # ── Prepare screen data ──────────────────────────────────────
        total = discover_result['total_screens_found']
        available = discover_result['available_screens']
        unavailable = discover_result['unavailable_screens']
        unavailability_breakdown = discover_result.get('unavailability_breakdown', {})
        screens_data = discover_result.get('screens', [])

        # ── CALL #3: Response Generation ─────────────────────────────
        try:
            call3_result = llm.call3_respond(
                intent=intent,
                persona=session.detected_persona,
                screens=screens_data,
                user_message=message,
                conversation_history=session.messages,
                ad_category=session.ad_category,
                product_category=session.product_category,
                brand_objective=session.brand_objective,
                target_audience=session.target_audience,
                gateway_edit_pending=gateway_edit_pending,
                gateway_edits=gateway_edits,
                question_to_ask=question_to_ask,
                total_screens=total,
                available_screens=available,
                location=session.gateway_location,
                start_date=session.gateway_start_date,
                end_date=session.gateway_end_date,
                budget_range=session.gateway_budget_range,
                active_filters=session.active_filters,
                suppress_screens=suppress_screens,
                unavailability_breakdown=unavailability_breakdown,
                discovery_complete=session.discovery_complete,
            )
        except Exception as e:
            logger.error(f'Call #3 failed: {e}')
            warnings.append(f'Response: {e}. Using fallback reply')
            call3_result = {
                'reply': "I found some screens for you. Check the results!",
                'quick_replies': [],
                '_meta': {'error': str(e), 'fallback': True},
            }

        reply = call3_result.get('reply', '')
        quick_replies = call3_result.get('quick_replies', [])

        # Detect LLM-service-level fallback for Call #3
        c3_meta_check = call3_result.get('_meta', {})
        if c3_meta_check.get('fallback') and f'Response:' not in ' '.join(warnings):
            warnings.append(f'Response: {c3_meta_check.get("error", "unknown error")}. Using fallback reply')

        # ── Append assistant reply to session ───────────────────────
        screen_ids = [s['id'] for s in screens_data]
        session.messages.append({
            'role': 'assistant',
            'content': reply,
            'timestamp': timezone.now().isoformat(),
            'screens_returned': screen_ids,
            'intent': intent,
            'filters_snapshot': dict(session.active_filters),
        })

        # ── Persist restore fields for GET /xia/chat/<session_id>/ ───
        session.last_intent = intent
        session.last_quick_replies = quick_replies
        session.last_question_to_ask = question_to_ask

        # ── Persist debug data for live monitoring ───────────────────
        # IMPORTANT: deep copy meta because the response builder strips
        # system_prompt / messages_sent / raw_response for non-debug requests.
        import copy
        c1_full = copy.deepcopy(call1_result.get('_meta', {}))
        c2_full = copy.deepcopy(call2_result.get('_meta', {})) if call2_result else {}
        c3_full = copy.deepcopy(call3_result.get('_meta', {}))
        session.last_turn_debug = {
            'call1_meta': c1_full,
            'call2_meta': c2_full,
            'call3_meta': c3_full,
            'discover_meta': {
                'ran': True,
                'input': {
                    'locations': session.gateway_location,
                    'start_date': session.gateway_start_date,
                    'end_date': session.gateway_end_date,
                    'budget_range': session.gateway_budget_range,
                    'xia_filters': dict(session.active_filters),
                },
                'raw_result': discover_result,
            },
            'intent': intent,
            'detected_persona': session.detected_persona,
            'screens': screens_data,
            'total_screens_found': total,
            'available_screens': available,
            'unavailable_screens': unavailable,
            'filters_applied': {
                'gateway': {
                    'location': session.gateway_location,
                    'start_date': session.gateway_start_date,
                    'end_date': session.gateway_end_date,
                    'budget_range': session.gateway_budget_range,
                },
                'xia_filters': dict(session.active_filters),
            },
            'reply': reply,
            'quick_replies': quick_replies,
            'warnings': warnings,
            'gateway_updated': gateway_updated,
            'message_count': len(session.messages),
            'timestamp': timezone.now().isoformat(),
        }

        # ── Save session ────────────────────────────────────────────
        session.save()

        # ── Build response ───────────────────────────────────────────
        c1_meta = call1_result.get('_meta', {})
        c2_meta = call2_result.get('_meta', {}) if call2_result else {}
        c3_meta = call3_result.get('_meta', {})

        # Strip heavy debug data unless debug=true
        if not debug_mode:
            for meta in [c1_meta, c2_meta, c3_meta]:
                meta.pop('system_prompt', None)
                meta.pop('messages_sent', None)
                meta.pop('raw_response', None)

        return Response({
            'session_id': str(session.session_id),
            'reply': reply,
            'warnings': warnings,
            'quick_replies': quick_replies,
            'intent': intent,
            'detected_persona': session.detected_persona,
            'screens': screens_data,
            'total_screens_found': total,
            'available_screens': available,
            'unavailable_screens': unavailable,
            'filters_applied': {
                'gateway': {
                    'location': session.gateway_location,
                    'start_date': session.gateway_start_date,
                    'end_date': session.gateway_end_date,
                    'budget_range': session.gateway_budget_range,
                },
                'xia_filters': session.active_filters,
            },
            'gateway_edit_pending': gateway_edit_pending,
            'gateway_updated': gateway_updated,
            'pending_gateway_edits': session.pending_gateway_edits,
            'question_to_ask': question_to_ask,
            'call1_meta': c1_meta,
            'call2_meta': c2_meta,
            'call3_meta': c3_meta,
            'discover_meta': {
                'ran': True,
                'input': {
                    'locations': session.gateway_location,
                    'start_date': session.gateway_start_date,
                    'end_date': session.gateway_end_date,
                    'budget_range': session.gateway_budget_range,
                    'xia_filters': dict(session.active_filters),
                    'exclude': exclude_filters,
                    'text_search': text_search,
                },
                'raw_result': discover_result,
            } if debug_mode else {},
            'history': [
                {'role': m['role'], 'content': m['content']}
                for m in session.messages
            ],
        }, status=status.HTTP_200_OK)


class XIAChatRestoreView(APIView):
    """
    GET /xia/chat/<session_id>/

    Restores a full XIA session so the frontend can hydrate state on page
    reload or re-visit. Re-runs discover with saved filters to get fresh
    screen data (slots may have changed), then returns everything Studio
    needs to reconstruct the UI.

    Sessions expire after 24 hours of inactivity → returns 404.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, session_id):
        from datetime import timedelta

        try:
            session = ChatSession.objects.get(session_id=session_id)
        except ChatSession.DoesNotExist:
            return Response(
                {'error': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── Session expiry: 24h of inactivity ────────────────────
        expiry_hours = int(os.environ.get('XIA_SESSION_EXPIRY_HOURS', 24))
        if (timezone.now() - session.updated_at) > timedelta(hours=expiry_hours):
            return Response(
                {'error': 'Session expired'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── Re-run discover for fresh screen data ─────────────────
        screens_data = []
        total = 0
        available = 0
        unavailable = 0
        try:
            discover_result = discover_screens(
                locations=session.gateway_location,
                start_date_str=session.gateway_start_date,
                end_date_str=session.gateway_end_date,
                budget_range=session.gateway_budget_range,
                xia_filters=session.active_filters,
            )
            screens_data = discover_result.get('screens', [])
            total = discover_result.get('total_screens_found', 0)
            available = discover_result.get('available_screens', 0)
            unavailable = discover_result.get('unavailable_screens', 0)
        except Exception as e:
            logger.error(f'Discover failed during session restore: {e}')

        # ── Build response ────────────────────────────────────────
        return Response({
            'session_id': str(session.session_id),
            'status': 'active',
            'created_at': session.created_at.isoformat(),
            'last_activity': session.updated_at.isoformat(),

            'user_id': session.user_id,
            'campaign_id': session.campaign_id,

            'detected_persona': session.detected_persona,
            'intent': session.last_intent,

            'gateway': {
                'start_date': session.gateway_start_date,
                'end_date': session.gateway_end_date,
                'location': session.gateway_location,
                'budget_range': session.gateway_budget_range,
            },

            'filters_applied': {
                'gateway': {
                    'location': session.gateway_location,
                    'start_date': session.gateway_start_date,
                    'end_date': session.gateway_end_date,
                    'budget_range': session.gateway_budget_range,
                },
                'xia_filters': dict(session.active_filters),
            },

            'screens': screens_data,
            'total_screens_found': total,
            'available_screens': available,
            'unavailable_screens': unavailable,

            'quick_replies': session.last_quick_replies,
            'question_to_ask': session.last_question_to_ask,

            'gateway_edit_pending': bool(session.pending_gateway_edits),
            'pending_gateway_edits': session.pending_gateway_edits,

            'discovery_complete': session.discovery_complete,
            'ad_category': session.ad_category,
            'brand_objective': session.brand_objective,
            'target_audience': session.target_audience,

            'history': [
                {'role': m['role'], 'content': m['content']}
                for m in session.messages
            ],

            'message_count': len(session.messages),
            'last_turn_debug': session.last_turn_debug or {},
        }, status=status.HTTP_200_OK)


class XIADebugView(APIView):
    """
    GET /xia/debug/
    Serves the debug dashboard HTML page.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        import os
        html_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'templates', 'debug.html',
        )
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()
        from django.http import HttpResponse
        return HttpResponse(html, content_type='text/html')


class XIAChatOpenView(APIView):
    """
    POST /xia/chat-open/
    Dual-mode chat entry point.

    mode='normal' (default): Gateway collection — XIA collects location, dates, budget.
    mode='live': Context-aware help — XIA sees what the user sees and helps contextually.

    Request: { user_id, campaign_id, message, session_id?, mode?, page_context? }
    """
    authentication_classes = []
    permission_classes = []

    GATEWAY_FIELDS = ['location', 'start_date', 'end_date', 'budget_range']

    def post(self, request):
        data = request.data
        session_id = data.get('session_id')
        user_id = str(data.get('user_id', '')).strip()
        campaign_id = str(data.get('campaign_id', '')).strip()
        message = str(data.get('message', '')).strip()
        mode = data.get('mode', 'normal')
        page_context = data.get('page_context', None)

        # ── Validate ────────────────────────────────────────────────
        if not user_id:
            return Response(
                {'message': 'user_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not message:
            return Response(
                {'message': 'message is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Session management ──────────────────────────────────────
        if not session_id:
            # First message — create new session
            if not campaign_id:
                return Response(
                    {'message': 'campaign_id is required for first message.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            new_session_id = uuid.uuid4()
            session = ChatSession.objects.create(
                session_id=new_session_id,
                user_id=user_id,
                campaign_id=campaign_id,
                mode=mode,
                gateway_location=[],
                gateway_start_date='',
                gateway_end_date='',
                gateway_budget_range='',
                active_filters={},
                last_page_context=page_context or {},
            )
            logger.info(f'Open chat session ({mode}): {new_session_id} for user={user_id}')
        else:
            # Subsequent message — load existing session
            try:
                session = ChatSession.objects.get(session_id=session_id)
            except ChatSession.DoesNotExist:
                return Response(
                    {'message': f'Session {session_id} not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # ── Input sanitization ──────────────────────────────────────
        message = re.sub(r'<[^>]+>', '', message)
        if len(message) > 2000:
            message = message[:2000]

        now = timezone.now().isoformat()

        # ── Update page context (sent with every live message) ──────
        if page_context:
            session.last_page_context = page_context

        # ── Branch by mode ──────────────────────────────────────────
        if mode == 'live':
            return self._handle_live_mode(session, message, page_context, now)
        else:
            return self._handle_normal_mode(session, message, now)

    # ================================================================
    #  LIVE MODE — Context-aware help
    # ================================================================

    def _handle_live_mode(self, session, message, page_context, now):
        """Handle mode='live' — XIA sees the page and helps contextually."""

        # Determine if this is the init message
        is_init = message == '[LIVE_MODE_INIT]'

        # Use a friendly init message for the LLM instead of the raw trigger
        llm_message = (
            "The user just opened Live Mode on this page. "
            "Generate a proactive, contextual greeting referencing what they see."
        ) if is_init else message

        # Append user message to session (skip [LIVE_MODE_INIT] from visible history)
        if not is_init:
            session.messages.append({
                'role': 'user',
                'content': message,
                'timestamp': now,
            })

        # ── Build prompt and call LLM ──────────────────────────────
        from .services.llm_service import LLMService
        from .prompts.context_prompt import build_context_system_prompt

        effective_context = page_context or session.last_page_context or {}

        system_prompt = build_context_system_prompt(
            page_context=effective_context,
            is_init=is_init,
        )

        llm = LLMService()
        result = llm.context_help(
            system_prompt=system_prompt,
            user_message=llm_message,
            conversation_history=session.messages if not is_init else None,
        )

        # ── Append assistant reply to session ──────────────────────
        reply = result.get('reply', "I'm here to help! What would you like to know about this page?")
        quick_replies = result.get('quick_replies', ['Explain this page', 'Guide me', 'What can I do here?'])
        redirect = result.get('redirect', None)

        session.messages.append({
            'role': 'assistant',
            'content': reply,
            'timestamp': timezone.now().isoformat(),
        })

        session.save()

        # ── Response ───────────────────────────────────────────────
        response_data = {
            'session_id': str(session.session_id),
            'mode': 'live',
            'reply': reply,
            'quick_replies': quick_replies,
            '_meta': result.get('_meta', {}),
        }

        if redirect:
            response_data['redirect'] = redirect

        return Response(response_data, status=status.HTTP_200_OK)

    # ================================================================
    #  NORMAL MODE — Gateway collection
    # ================================================================

    def _handle_normal_mode(self, session, message, now):
        """Handle mode='normal' — conversational gateway collection."""

        # Append user message to session
        session.messages.append({
            'role': 'user',
            'content': message,
            'timestamp': now,
        })

        # ── Determine collected vs missing gateway fields ──────────
        collected = {}
        missing = []

        if session.gateway_location:
            collected['location'] = session.gateway_location
        else:
            missing.append('location')

        if session.gateway_start_date:
            collected['start_date'] = session.gateway_start_date
        else:
            missing.append('start_date')

        if session.gateway_end_date:
            collected['end_date'] = session.gateway_end_date
        else:
            missing.append('end_date')

        if session.gateway_budget_range:
            collected['budget_range'] = session.gateway_budget_range
        else:
            missing.append('budget_range')

        # ── Call LLM — gateway collection ──────────────────────────
        from .services.llm_service import LLMService
        from .prompts.gateway_prompt import build_gateway_system_prompt

        system_prompt = build_gateway_system_prompt(
            collected=collected,
            missing=missing,
            conversation_history=session.messages,
        )

        llm = LLMService()
        result = llm.gateway_collect(
            system_prompt=system_prompt,
            user_message=message,
            conversation_history=session.messages[:-1],
        )

        # ── Extract and save gateway values ────────────────────────
        extracted = result.get('extracted', {})

        if extracted.get('location') and not session.gateway_location:
            loc = extracted['location']
            session.gateway_location = loc if isinstance(loc, list) else [loc]

        if extracted.get('start_date') and not session.gateway_start_date:
            session.gateway_start_date = extracted['start_date']

        if extracted.get('end_date') and not session.gateway_end_date:
            session.gateway_end_date = extracted['end_date']

        if extracted.get('budget_range') and not session.gateway_budget_range:
            session.gateway_budget_range = str(extracted['budget_range'])

        # ── Append assistant reply to session ──────────────────────
        reply = result.get('reply', "Which city would you like to advertise in?")
        quick_replies = result.get('quick_replies', ['Chennai', 'Mumbai', 'Bengaluru'])

        session.messages.append({
            'role': 'assistant',
            'content': reply,
            'timestamp': timezone.now().isoformat(),
        })

        session.save()

        # ── Build gateway status ───────────────────────────────────
        gateway_status = {
            'location': {
                'collected': bool(session.gateway_location),
                'value': session.gateway_location or None,
            },
            'start_date': {
                'collected': bool(session.gateway_start_date),
                'value': session.gateway_start_date or None,
            },
            'end_date': {
                'collected': bool(session.gateway_end_date),
                'value': session.gateway_end_date or None,
            },
            'budget_range': {
                'collected': bool(session.gateway_budget_range),
                'value': session.gateway_budget_range or None,
            },
        }

        gateway_complete = all(
            gateway_status[f]['collected'] for f in self.GATEWAY_FIELDS
        )

        # ── Response ───────────────────────────────────────────────
        return Response({
            'session_id': str(session.session_id),
            'mode': 'normal',
            'reply': reply,
            'quick_replies': quick_replies,
            'gateway_status': gateway_status,
            'gateway_complete': gateway_complete,
            '_meta': result.get('_meta', {}),
        }, status=status.HTTP_200_OK)


class XIACreativeSuggestionView(APIView):
    """
    POST /xia/creative-suggestion/
    Bundle-based creative brief generation.
    Generates one creative brief per screen in the bundle.

    Request: {
        user_id, campaign_id, bundle_id, bundle_name,
        screen_slots: [{ screen_id, slots }, ...]
    }
    Response: {
        session, bundle_id, bundle_name,
        suggestions: [{ screen_id, slots, screen_name, brief }, ...]
    }
    """
    authentication_classes = []
    permission_classes = []

    def _build_screen_data(self, screen):
        """Build the full screen data dict from a ScreenMaster instance."""
        return {
            # Identification
            'id': screen.id,
            'screenid': screen.screenid,
            'screen_name': screen.screen_name,
            'company_name': screen.company_name,
            'partner_name': screen.partner_name,
            'admin_name': screen.admin_name,
            'role': screen.role,

            # Location (spec)
            'spec_city': screen.spec_city,
            'spec_latitude': float(screen.spec_latitude) if screen.spec_latitude else None,
            'spec_longitude': float(screen.spec_longitude) if screen.spec_longitude else None,
            'spec_full_address': screen.spec_full_address,
            'spec_nearest_landmark': screen.spec_nearest_landmark,

            # Hardware
            'technology': screen.technology,
            'environment': screen.environment,
            'screen_type': screen.screen_type,
            'screen_width': float(screen.screen_width) if screen.screen_width else None,
            'screen_height': float(screen.screen_height) if screen.screen_height else None,
            'resolution_width': screen.resolution_width,
            'resolution_height': screen.resolution_height,
            'resolution': f'{screen.resolution_width}x{screen.resolution_height}' if screen.resolution_width and screen.resolution_height else None,
            'orientation': screen.orientation,
            'pixel_pitch_mm': screen.pixel_pitch_mm,
            'brightness_nits': screen.brightness_nits,
            'refresh_rate_hz': screen.refresh_rate_hz,
            'installation_type': screen.installation_type,
            'mounting_height_ft': float(screen.mounting_height_ft) if screen.mounting_height_ft else None,
            'facing_direction': screen.facing_direction,
            'road_type': screen.road_type,
            'traffic_direction': screen.traffic_direction,

            # Scheduling & Slots
            'standard_ad_duration_sec': screen.standard_ad_duration_sec,
            'total_slots_per_loop': screen.total_slots_per_loop,
            'loop_length_sec': screen.loop_length_sec,
            'reserved_slots': screen.reserved_slots,

            # Media & Connectivity
            'supported_formats_json': screen.supported_formats_json,
            'max_file_size_mb': screen.max_file_size_mb,
            'internet_type': screen.internet_type,
            'average_bandwidth_mbps': screen.average_bandwidth_mbps,
            'power_backup_type': screen.power_backup_type,

            # Operations
            'days_active_per_week': screen.days_active_per_week,
            'downtime_windows': screen.downtime_windows,
            'audio_supported': screen.audio_supported,
            'backup_internet': screen.backup_internet,

            # Pricing
            'base_price_per_slot_inr': float(screen.base_price_per_slot_inr) if screen.base_price_per_slot_inr else None,
            'minimum_booking_days': screen.minimum_booking_days,
            'seasonal_pricing': screen.seasonal_pricing,
            'seasons_json': screen.seasons_json,
            'enable_min_booking': screen.enable_min_booking,
            'surcharge_percent': float(screen.surcharge_percent) if screen.surcharge_percent else None,

            # Content Restrictions
            'restricted_categories_json': screen.restricted_categories_json,
            'sensitive_zone_flags_json': screen.sensitive_zone_flags_json,

            # CMS & Monitoring
            'cms_type': screen.cms_type,
            'cms_api': screen.cms_api,
            'ai_camera_installed': screen.ai_camera_installed,
            'screen_health_ping': screen.screen_health_ping,
            'playback_logs': screen.playback_logs,
            'ai_camera_api': screen.ai_camera_api,

            # Compliance & Media
            'ownership_proof_uploaded': screen.ownership_proof_uploaded,
            'permission_noc_available': screen.permission_noc_available,
            'screen_image_front': screen.screen_image_front,
            'screen_image_back': screen.screen_image_back,
            'screen_image_long': screen.screen_image_long,
            'gst': screen.gst,
            'content_policy_accepted': screen.content_policy_accepted,

            # Status & Meta
            'source': screen.source,
            'remarks': screen.remarks,
            'reviewed_by': screen.reviewed_by,
            'current_step': screen.current_step,
            'status': screen.status,
            'scheduled_block_date': str(screen.scheduled_block_date) if screen.scheduled_block_date else None,
            'created_at': screen.created_at.isoformat() if screen.created_at else None,
            'updated_at': screen.updated_at.isoformat() if screen.updated_at else None,
            'is_profiled': screen.is_profiled,
            'profile_status': screen.profile_status,

            # AI Profile — Location
            'profiled_latitude': float(screen.profiled_latitude) if screen.profiled_latitude else None,
            'profiled_longitude': float(screen.profiled_longitude) if screen.profiled_longitude else None,
            'profiled_city': screen.profiled_city,
            'profiled_state': screen.profiled_state,
            'profiled_country': screen.profiled_country,
            'cityTier': screen.cityTier,
            'profiled_full_address': screen.profiled_full_address,

            # AI Profile — Area Classification
            'primaryType': screen.primaryType,
            'areaContext': screen.areaContext,
            'confidence': screen.confidence,
            'classificationDetail': screen.classificationDetail,
            'dominantGroup': screen.dominantGroup,

            # AI Profile — Movement
            'movement_type': screen.movement_type,
            'movement_context': screen.movement_context,

            # AI Profile — Dwell
            'dwellCategory': screen.dwellCategory,
            'dwellConfidence': screen.dwellConfidence,
            'dwellScore': screen.dwellScore,
            'dominanceRatio': screen.dominanceRatio,

            # AI Profile — Ring Analysis
            'ring1': screen.ring1,
            'ring2': screen.ring2,
            'ring3': screen.ring3,
            'reasoning': screen.reasoning,

            # AI Profile — Metadata
            'computedAt': screen.computedAt.isoformat() if screen.computedAt else None,
            'apiCallsMade': screen.apiCallsMade,
            'processingTimeMs': screen.processingTimeMs,

            # AI Profile — LLM Enhancement
            'LLMused': screen.LLMused,
            'LLMreason': screen.LLMreason,
            'LLMmode': screen.LLMmode,

            # XIA Internal
            'synced_at': screen.synced_at.isoformat() if screen.synced_at else None,
        }

    def post(self, request):
        data = request.data
        user_id = str(data.get('user_id', '')).strip()
        campaign_id = str(data.get('campaign_id', '')).strip()
        bundle_id = data.get('bundle_id')
        bundle_name = str(data.get('bundle_name', '')).strip()
        screen_slots = data.get('screen_slots', [])

        # ── Validate required fields ────────────────────────────────
        missing = []
        if not user_id:
            missing.append('user_id')
        if not campaign_id:
            missing.append('campaign_id')
        if not screen_slots or not isinstance(screen_slots, list):
            missing.append('screen_slots')
        if missing:
            return Response({
                'error': 'Missing required fields',
                'detail': f'Missing: {", ".join(missing)}',
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Lookup session ──────────────────────────────────────────
        try:
            session = ChatSession.objects.filter(
                user_id=user_id,
                campaign_id=campaign_id,
            ).order_by('-updated_at').first()
        except Exception as e:
            logger.error(f'Creative suggestion session lookup failed: {e}')
            return Response({
                'error': 'Session lookup failed',
                'detail': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not session:
            return Response({
                'error': 'Session not found',
                'detail': f'No chat session found for user_id={user_id}, campaign_id={campaign_id}',
            }, status=status.HTTP_404_NOT_FOUND)

        # ── Build session data (ALL fields from xia_chat_session) ────
        session_data = {
            'session_id': str(session.session_id),
            'user_id': session.user_id,
            'campaign_id': session.campaign_id,

            # Gateway params
            'gateway_location': session.gateway_location,
            'gateway_start_date': session.gateway_start_date,
            'gateway_end_date': session.gateway_end_date,
            'gateway_budget_range': session.gateway_budget_range,

            # Persona
            'detected_persona': session.detected_persona,
            'persona_confidence': session.persona_confidence,

            # Campaign context
            'ad_category': session.ad_category,
            'product_category': session.product_category,
            'brand_objective': session.brand_objective,
            'target_audience': session.target_audience,

            # Discovery
            'discovery_complete': session.discovery_complete,

            # Filters
            'active_filters': dict(session.active_filters or {}),
            'previous_filters': dict(session.previous_filters or {}),

            # Pending edits & questions
            'pending_gateway_edits': dict(session.pending_gateway_edits or {}),
            'pending_questions': list(session.pending_questions or []),
            'question_attempts': dict(session.question_attempts or {}),

            # Session restore
            'last_intent': session.last_intent,
            'last_quick_replies': list(session.last_quick_replies or []),
            'last_question_to_ask': session.last_question_to_ask,

            # Debug
            'last_turn_debug': dict(session.last_turn_debug or {}),

            # Messages (full conversation history)
            'messages': list(session.messages or []),
            'message_count': len(session.messages or []),

            # Timestamps
            'created_at': session.created_at.isoformat() if session.created_at else None,
            'updated_at': session.updated_at.isoformat() if session.updated_at else None,
        }

        # ── Loop through screens, generate one brief per screen ──────
        from .services.llm_service import LLMService
        from .prompts.creative_prompt import (
            build_creative_system_prompt,
            build_creative_user_message,
        )

        llm = LLMService()
        suggestions = []

        for slot_entry in screen_slots:
            screen_id = slot_entry.get('screen_id')
            slots = slot_entry.get('slots', [])

            if not screen_id:
                suggestions.append({
                    'screen_id': None,
                    'slots': slots,
                    'screen_name': None,
                    'error': 'Missing screen_id in slot entry',
                    'brief': None,
                })
                continue

            # ── Fetch this screen ────────────────────────────────
            try:
                screen = ScreenMaster.objects.filter(screenid=int(screen_id)).first()
            except (ValueError, TypeError):
                screen = ScreenMaster.objects.filter(pk=screen_id).first()
            except Exception as e:
                logger.error(f'Screen lookup failed for screen_id={screen_id}: {e}')
                suggestions.append({
                    'screen_id': screen_id,
                    'slots': slots,
                    'screen_name': None,
                    'error': f'Screen lookup failed: {e}',
                    'brief': None,
                })
                continue

            if not screen:
                suggestions.append({
                    'screen_id': screen_id,
                    'slots': slots,
                    'screen_name': None,
                    'error': f'Screen {screen_id} not found',
                    'brief': None,
                })
                continue

            # ── Build screen data ────────────────────────────────
            screen_data = self._build_screen_data(screen)

            # ── Generate creative brief via LLM ──────────────────
            try:
                system_prompt = build_creative_system_prompt(session_data, screen_data)
                user_message = build_creative_user_message(session_data, screen_data)
                brief = llm.creative_suggest(system_prompt, user_message)
            except Exception as e:
                logger.error(f'Creative suggestion failed for screen {screen_id}: {e}')
                brief = {
                    'error': True,
                    'error_message': str(e),
                    'headline': f'Creative brief generation failed for screen {screen_id}',
                }

            suggestions.append({
                'screen_id': screen_id,
                'slots': slots,
                'screen_name': screen.screen_name,
                'brief': brief,
            })

            logger.info(f'Creative brief generated for screen {screen_id} ({screen.screen_name})')

        # ── Build response ──────────────────────────────────────────
        return Response({
            'session': session_data,
            'bundle_id': bundle_id,
            'bundle_name': bundle_name,
            'total_screens': len(screen_slots),
            'suggestions': suggestions,
        }, status=status.HTTP_200_OK)

