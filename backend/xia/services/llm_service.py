"""
LLM Service
------------
Groq-powered LLM service for XIA's 3-call pipeline.
Handles Call #1 (Understanding), Call #2 (Ranking), Call #3 (Response).
"""

import os
import json
import time
import logging

from groq import Groq

logger = logging.getLogger('xia.llm')


class LLMService:
    """
    Unified Groq LLM client for all XIA calls.

    Usage:
        service = LLMService()
        result = service.call1_extract(message, history, active_filters, gateway, filter_menu)
    """

    # Default model — fast, smart, cheap
    DEFAULT_MODEL = 'llama-3.3-70b-versatile'

    def __init__(self, model=None):
        api_key = os.getenv('GROQ_API_KEY')
        if not api_key:
            # Fallback: check Django settings (monorepo loads key there)
            try:
                from django.conf import settings
                api_key = getattr(settings, 'GROQ_API_KEY', '')
            except Exception:
                pass
        if not api_key:
            raise ValueError('GROQ_API_KEY not set in environment.')

        self.client = Groq(api_key=api_key)
        self.model = model or self.DEFAULT_MODEL

    # ─── Call #1: Understanding + Extraction ─────────────────────

    def call1_extract(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: list,
        temperature: float = 0.1,
    ) -> dict:
        """
        Run Call #1: Understand user intent and extract filters.

        Args:
            system_prompt: Full system prompt (includes filter menu, rules, etc.)
            user_message: Current user message
            conversation_history: List of {role, content} dicts
            temperature: LLM temperature (low = deterministic)

        Returns:
            Parsed JSON dict with intent, filters, exclude, text_search,
            gateway_edits, remove_filters, question_to_ask, etc.
        """
        # Build messages array for Groq
        messages = [
            {'role': 'system', 'content': system_prompt},
        ]

        # Add conversation history (keep last 20 messages to avoid token overflow)
        recent_history = conversation_history[-20:]
        for msg in recent_history:
            messages.append({
                'role': msg['role'],
                'content': msg['content'],
            })

        # Add current user message
        messages.append({
            'role': 'user',
            'content': user_message,
        })

        # Call Groq
        start_time = time.time()
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=1024,
                response_format={'type': 'json_object'},
            )

            raw_output = response.choices[0].message.content
            processing_ms = int((time.time() - start_time) * 1000)

            logger.info(
                f'Call #1 completed in {processing_ms}ms | '
                f'Tokens: {response.usage.prompt_tokens}in / '
                f'{response.usage.completion_tokens}out'
            )

            # Parse JSON response
            parsed = json.loads(raw_output)

            # Attach metadata
            parsed['_meta'] = {
                'processing_ms': processing_ms,
                'model': self.model,
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
                'system_prompt': system_prompt,
                'messages_sent': messages,
                'raw_response': raw_output,
            }

            return parsed

        except json.JSONDecodeError as e:
            logger.error(f'Call #1 returned invalid JSON: {e}\nRaw: {raw_output}')
            return self._fallback_response(f'JSON parse error: {e}')

        except Exception as e:
            processing_ms = int((time.time() - start_time) * 1000)
            logger.error(f'Call #1 failed after {processing_ms}ms: {e}')
            return self._fallback_response(str(e))

    # ─── Call #2: Ranking + Reasoning ────────────────────────────

    def call2_rank(
        self,
        screens: list,
        ad_category: str = '',
        product_category: str = '',
        brand_objective: str = '',
        target_audience: str = '',
        persona: str = '',
        user_message: str = '',
        temperature: float = 0.2,
    ) -> dict:
        """
        Run Call #2: Rank screens by relevance to campaign context.

        If screens exceed RANKING_BATCH_SIZE, splits into batches,
        ranks each independently, then merges results by score.

        Returns:
            Dict with 'ranking' (ordered screen IDs), 'screen_scores',
            'screen_reasoning', and '_meta' (timing/tokens).
        """
        # Skip conditions: nothing to rank
        if not screens:
            logger.info('Call #2 skipped: no screens to rank')
            return self._call2_fallback([], 'No screens to rank')

        if len(screens) == 1:
            screen_id = screens[0].get('id')
            logger.info('Call #2 skipped: only 1 screen, no ranking needed')
            return {
                'ranking': [screen_id],
                'screen_reasoning': {
                    str(screen_id): 'Only screen available for your criteria.'
                },
                '_meta': {'skipped': True, 'reason': 'single_screen'},
            }

        from xia.prompts.call2_prompt import (
            format_screens_for_prompt,
            build_call2_system_prompt,
            RANKING_BATCH_SIZE,
        )

        # ── Batch splitting ──────────────────────────────────────
        batches = []
        for i in range(0, len(screens), RANKING_BATCH_SIZE):
            batches.append(screens[i:i + RANKING_BATCH_SIZE])

        logger.info(
            f'Call #2: {len(screens)} screens → '
            f'{len(batches)} batch(es) of ≤{RANKING_BATCH_SIZE}'
        )

        # ── Run each batch ───────────────────────────────────────
        all_scores = {}       # {str(screen_id): int}
        all_reasoning = {}    # {str(screen_id): str}
        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_ms = 0
        batch_metas = []
        last_system_prompt = ''
        last_messages = []
        last_raw_response = ''

        for batch_idx, batch in enumerate(batches):
            batch_label = f'batch {batch_idx + 1}/{len(batches)}'
            screens_json = format_screens_for_prompt(batch)
            system_prompt = build_call2_system_prompt(
                screens_data=screens_json,
                ad_category=ad_category,
                product_category=product_category,
                brand_objective=brand_objective,
                target_audience=target_audience,
                persona=persona,
                user_message=user_message,
            )

            messages = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': 'Rank these screens for my campaign.'},
            ]

            start_time = time.time()
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=2048,
                    response_format={'type': 'json_object'},
                )

                raw_output = response.choices[0].message.content
                processing_ms = int((time.time() - start_time) * 1000)
                total_ms += processing_ms
                total_prompt_tokens += response.usage.prompt_tokens
                total_completion_tokens += response.usage.completion_tokens

                logger.info(
                    f'Call #2 {batch_label} completed in {processing_ms}ms | '
                    f'Tokens: {response.usage.prompt_tokens}in / '
                    f'{response.usage.completion_tokens}out'
                )

                parsed = json.loads(raw_output)
                # New rubric format: scores.{screen_id}.{total, area_match, ...}
                rubric_scores = parsed.get('scores', {})

                # Extract total scores and full rubric into collectors
                for sid_str, rubric in rubric_scores.items():
                    if isinstance(rubric, dict):
                        all_scores[sid_str] = rubric.get('total', 0)
                        all_reasoning[sid_str] = rubric  # Full rubric object
                    else:
                        # Fallback: old flat format
                        all_scores[sid_str] = rubric if isinstance(rubric, (int, float)) else 0
                        all_reasoning[sid_str] = str(rubric)

                # Ensure all batch screens have a score
                for s in batch:
                    sid_str = str(s.get('id'))
                    if sid_str not in all_scores:
                        all_scores[sid_str] = 0
                        all_reasoning[sid_str] = 'Not scored by LLM.'
                        logger.warning(
                            f'Call #2 {batch_label}: screen {sid_str} '
                            f'missing from scores, defaulting to 0'
                        )

                batch_metas.append({
                    'batch': batch_idx + 1,
                    'screens': len(batch),
                    'processing_ms': processing_ms,
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens,
                })
                last_system_prompt = system_prompt
                last_messages = messages
                last_raw_response = raw_output

            except json.JSONDecodeError as e:
                logger.error(
                    f'Call #2 {batch_label} returned invalid JSON: {e}\n'
                    f'Raw: {raw_output}'
                )
                # Give batch screens default scores so they still appear
                for s in batch:
                    sid_str = str(s.get('id'))
                    all_scores[sid_str] = 0
                    all_reasoning[sid_str] = 'Ranking failed for this batch.'

            except Exception as e:
                processing_ms = int((time.time() - start_time) * 1000)
                total_ms += processing_ms
                logger.error(
                    f'Call #2 {batch_label} failed after {processing_ms}ms: {e}'
                )
                for s in batch:
                    sid_str = str(s.get('id'))
                    all_scores[sid_str] = 0
                    all_reasoning[sid_str] = 'Ranking failed for this batch.'

        # ── Merge: sort all screens by score descending ──────────
        ranking = sorted(
            all_scores.keys(),
            key=lambda sid: all_scores.get(sid, 0),
            reverse=True,
        )
        # Convert string IDs back to int where possible
        ranking = [int(sid) if sid.isdigit() else sid for sid in ranking]

        result = {
            'ranking': ranking,
            'screen_scores': all_scores,
            'screen_rubrics': all_reasoning,
            '_meta': {
                'processing_ms': total_ms,
                'model': self.model,
                'prompt_tokens': total_prompt_tokens,
                'completion_tokens': total_completion_tokens,
                'batches': len(batches),
                'batch_details': batch_metas,
                'system_prompt': last_system_prompt,
                'messages_sent': last_messages,
                'raw_response': last_raw_response,
            },
        }

        logger.info(
            f'Call #2 final: {len(batches)} batch(es), '
            f'{total_ms}ms total, ranking={ranking}'
        )
        return result

    # ─── Call #3: Response Generation ────────────────────────────

    def call3_respond(
        self,
        intent: str,
        persona: str,
        screens: list,
        user_message: str,
        conversation_history: list,
        ad_category: str = '',
        product_category: str = '',
        brand_objective: str = '',
        target_audience: str = '',
        gateway_edit_pending: bool = False,
        gateway_edits: dict = None,
        question_to_ask: str = '',
        total_screens: int = 0,
        available_screens: int = 0,
        location: list = None,
        start_date: str = '',
        end_date: str = '',
        budget_range: str = '',
        active_filters: dict = None,
        suppress_screens: bool = False,
        unavailability_breakdown: dict = None,
        discovery_complete: bool = False,
        temperature: float = 0.6,
    ) -> dict:
        """
        Run Call #3: Generate user-facing reply + quick_replies.

        Returns:
            Dict with 'reply' (string), 'quick_replies' (list of 3 strings),
            and '_meta' (timing/tokens).
        """
        from xia.prompts.call3_prompt import build_call3_system_prompt

        system_prompt = build_call3_system_prompt(
            intent=intent,
            persona=persona,
            screens=screens,
            ad_category=ad_category,
            product_category=product_category,
            brand_objective=brand_objective,
            target_audience=target_audience,
            user_message=user_message,
            gateway_edit_pending=gateway_edit_pending,
            gateway_edits=gateway_edits,
            question_to_ask=question_to_ask,
            total_screens=total_screens,
            available_screens=available_screens,
            location=location,
            start_date=start_date,
            end_date=end_date,
            budget_range=budget_range,
            active_filters=active_filters,
            suppress_screens=suppress_screens,
            unavailability_breakdown=unavailability_breakdown or {},
            discovery_complete=discovery_complete,
        )

        # Build messages — include recent history for conversational context
        messages = [
            {'role': 'system', 'content': system_prompt},
        ]
        recent_history = conversation_history[-10:]
        for msg in recent_history:
            messages.append({
                'role': msg['role'],
                'content': msg['content'],
            })
        messages.append({
            'role': 'user',
            'content': user_message,
        })

        start_time = time.time()
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=512,
                response_format={'type': 'json_object'},
            )

            raw_output = response.choices[0].message.content
            processing_ms = int((time.time() - start_time) * 1000)

            logger.info(
                f'Call #3 completed in {processing_ms}ms | '
                f'Tokens: {response.usage.prompt_tokens}in / '
                f'{response.usage.completion_tokens}out'
            )

            parsed = json.loads(raw_output)

            # Ensure required fields
            if 'reply' not in parsed:
                parsed['reply'] = 'I can help you find the right screens. Tell me about your campaign!'
            if 'quick_replies' not in parsed or not isinstance(parsed['quick_replies'], list):
                parsed['quick_replies'] = []

            # Cap quick_replies to 3
            parsed['quick_replies'] = parsed['quick_replies'][:3]

            parsed['_meta'] = {
                'processing_ms': processing_ms,
                'model': self.model,
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
                'system_prompt': system_prompt,
                'messages_sent': messages,
                'raw_response': raw_output,
            }

            return parsed

        except json.JSONDecodeError as e:
            logger.error(f'Call #3 returned invalid JSON: {e}\nRaw: {raw_output}')
            return self._call3_fallback(intent, question_to_ask, f'JSON parse error: {e}')

        except Exception as e:
            processing_ms = int((time.time() - start_time) * 1000)
            logger.error(f'Call #3 failed after {processing_ms}ms: {e}')
            return self._call3_fallback(intent, question_to_ask, str(e))

    # ─── Gateway Collection ───────────────────────────────────────

    def gateway_collect(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: list = None,
        temperature: float = 0.3,
    ) -> dict:
        """
        Gateway collection call: extract gateway fields + generate reply.

        Args:
            system_prompt: Full system prompt with collected/missing fields
            user_message: Current user message
            conversation_history: Previous messages in this session
            temperature: Low for reliable extraction

        Returns:
            Parsed JSON dict with 'extracted', 'reply', 'quick_replies', '_meta'
        """
        messages = [
            {'role': 'system', 'content': system_prompt},
        ]

        # Add conversation history (last 10 messages)
        if conversation_history:
            recent = conversation_history[-10:]
            for msg in recent:
                messages.append({
                    'role': msg['role'],
                    'content': msg['content'],
                })

        messages.append({
            'role': 'user',
            'content': user_message,
        })

        start_time = time.time()
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=1024,
                response_format={'type': 'json_object'},
            )

            raw_output = response.choices[0].message.content
            processing_ms = int((time.time() - start_time) * 1000)

            logger.info(
                f'Gateway Collection completed in {processing_ms}ms | '
                f'Tokens: {response.usage.prompt_tokens}in / '
                f'{response.usage.completion_tokens}out'
            )

            parsed = json.loads(raw_output)

            parsed['_meta'] = {
                'processing_ms': processing_ms,
                'model': self.model,
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            }

            return parsed

        except json.JSONDecodeError as e:
            logger.error(f'Gateway Collection returned invalid JSON: {e}\nRaw: {raw_output}')
            return self._gateway_fallback(f'JSON parse error: {e}')

        except Exception as e:
            processing_ms = int((time.time() - start_time) * 1000)
            logger.error(f'Gateway Collection failed after {processing_ms}ms: {e}')
            return self._gateway_fallback(str(e))

    def _gateway_fallback(self, error_msg: str) -> dict:
        """
        Return a safe fallback when gateway collection LLM call fails.
        """
        return {
            'extracted': {
                'location': None,
                'start_date': None,
                'end_date': None,
                'budget_range': None,
            },
            'reply': "I'm having a small hiccup — could you tell me which city you'd like to run your campaign in?",
            'quick_replies': ['Chennai', 'Mumbai', 'Bengaluru'],
            '_meta': {
                'error': error_msg,
                'fallback': True,
            },
        }

    # ─── Context Help (Live Mode) ─────────────────────────────────

    def context_help(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: list = None,
        temperature: float = 0.5,
    ) -> dict:
        """
        Live Mode context-aware help call.

        Args:
            system_prompt: Full system prompt with page context injected
            user_message: Current user message (or [LIVE_MODE_INIT])
            conversation_history: Previous messages in this live session
            temperature: Moderate for helpful but focused responses

        Returns:
            Parsed JSON dict with 'reply', 'quick_replies', 'redirect', '_meta'
        """
        messages = [
            {'role': 'system', 'content': system_prompt},
        ]

        # Add conversation history (last 10 messages)
        if conversation_history:
            recent = conversation_history[-10:]
            for msg in recent:
                messages.append({
                    'role': msg['role'],
                    'content': msg['content'],
                })

        messages.append({
            'role': 'user',
            'content': user_message,
        })

        start_time = time.time()
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=1024,
                response_format={'type': 'json_object'},
            )

            raw_output = response.choices[0].message.content
            processing_ms = int((time.time() - start_time) * 1000)

            logger.info(
                f'Context Help completed in {processing_ms}ms | '
                f'Tokens: {response.usage.prompt_tokens}in / '
                f'{response.usage.completion_tokens}out'
            )

            parsed = json.loads(raw_output)

            parsed['_meta'] = {
                'processing_ms': processing_ms,
                'model': self.model,
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            }

            return parsed

        except json.JSONDecodeError as e:
            logger.error(f'Context Help returned invalid JSON: {e}\nRaw: {raw_output}')
            return self._context_fallback(f'JSON parse error: {e}')

        except Exception as e:
            processing_ms = int((time.time() - start_time) * 1000)
            logger.error(f'Context Help failed after {processing_ms}ms: {e}')
            return self._context_fallback(str(e))

    def _context_fallback(self, error_msg: str) -> dict:
        """
        Return a safe fallback when context help LLM call fails.
        """
        return {
            'reply': "I'm having a small hiccup. What would you like help with on this page?",
            'quick_replies': ['Explain this page', 'Guide me', 'Take me somewhere'],
            'redirect': None,
            '_meta': {
                'error': error_msg,
                'fallback': True,
            },
        }

    # ─── Creative Suggestion (Brief Generator) ────────────────────

    def creative_suggest(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.7,
    ) -> dict:
        """
        Generate a creative brief/suggestion for ad design.

        Args:
            system_prompt: Full system prompt with campaign + screen context
            user_message: Short trigger message
            temperature: Higher for more creative output

        Returns:
            Parsed JSON dict with creative brief sections + _meta
        """
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ]

        start_time = time.time()
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=4096,
                response_format={'type': 'json_object'},
            )

            raw_output = response.choices[0].message.content
            processing_ms = int((time.time() - start_time) * 1000)

            logger.info(
                f'Creative Suggestion completed in {processing_ms}ms | '
                f'Tokens: {response.usage.prompt_tokens}in / '
                f'{response.usage.completion_tokens}out'
            )

            parsed = json.loads(raw_output)

            parsed['_meta'] = {
                'processing_ms': processing_ms,
                'model': self.model,
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            }

            return parsed

        except json.JSONDecodeError as e:
            logger.error(f'Creative Suggestion returned invalid JSON: {e}\nRaw: {raw_output}')
            return self._creative_fallback(f'JSON parse error: {e}')

        except Exception as e:
            processing_ms = int((time.time() - start_time) * 1000)
            logger.error(f'Creative Suggestion failed after {processing_ms}ms: {e}')
            return self._creative_fallback(str(e))

    def _creative_fallback(self, error_msg: str) -> dict:
        """
        Return a structured fallback when creative suggestion LLM call fails.
        """
        return {
            'error': True,
            'error_message': error_msg,
            'headline': 'Creative brief generation failed — use manual guidelines',
            'format_recommendation': {},
            'visual_guidelines': {},
            'content_strategy': {},
            'audience_context': {},
            'restrictions': {},
            'production_checklist': [],
            'creative_idea': {},
            '_meta': {
                'error': error_msg,
                'fallback': True,
            },
        }

    # ─── Fallback (safe defaults) ────────────────────────────────

    def _fallback_response(self, error_msg: str) -> dict:
        """
        Return a safe fallback when LLM call fails.
        This ensures the pipeline doesn't crash — views.py can still respond.
        """
        return {
            'intent': 'greeting',
            'detected_persona': 'business_owner',
            'filters': {},
            'exclude': {},
            'text_search': '',
            'gateway_edits': {},
            'gateway_edit_pending': False,
            'remove_filters': [],
            'question_to_ask': '',
            'pending_questions': [],
            'ad_category': '',
            'product_category': '',
            'brand_objective': '',
            '_meta': {
                'error': error_msg,
                'fallback': True,
            },
        }

    def _call2_fallback(self, screens: list, error_msg: str) -> dict:
        """
        Return screens in original order when Call #2 fails.
        Pipeline continues — screens just won't be ranked.
        """
        ranking = [s.get('id') for s in screens]
        rubrics = {
            str(sid): {
                'total': 0,
                'area_match': 0,
                'audience_fit': 0,
                'screen_quality': 0,
                'context_bonus': 0,
                'eligibility': 0,
                'summary': 'Ranking unavailable.',
            } for sid in ranking
        }
        return {
            'ranking': ranking,
            'screen_rubrics': rubrics,
            '_meta': {
                'error': error_msg,
                'fallback': True,
            },
        }

    def _call3_fallback(self, intent: str, question_to_ask: str, error_msg: str) -> dict:
        """
        Return a basic reply when Call #3 fails.
        These are the same placeholder replies that views.py used before Call #3.
        """
        fallback_replies = {
            'greeting': "Hi! I'm XIA, your screen planning assistant. Tell me about your campaign!",
            'needs_more_info': question_to_ask or "Could you tell me more about what you're advertising?",
            'gateway_edit_pending': "I have a suggested change for your campaign settings. Would you like to review it?",
            'clarification': "I can help with that! Let me know your campaign details.",
        }
        reply = fallback_replies.get(intent, "I found some screens for you. Take a look at the results!")
        return {
            'reply': reply,
            'quick_replies': [],
            '_meta': {
                'error': error_msg,
                'fallback': True,
            },
        }
