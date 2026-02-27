"""
XIGI Area Context Intelligence - LLM Profiler (DSPy-based)

This module provides LLM-enhanced area classification using DSPy framework.
Two modes are supported:
1. Hybrid Mode (default): Rule-based with selective LLM for edge cases
2. Full LLM Mode: 100% LLM classification for A/B testing

Uses Google Gemini 2.0 Flash for optimal latency/cost balance.

Author: XIGI AI Backend
Version: 1.0.0
"""

from __future__ import annotations

import os
import json
import time
import hashlib
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

try:
    import dspy
    DSPY_AVAILABLE = True
except ImportError:
    DSPY_AVAILABLE = False

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


# =============================================================================
# CONFIGURATION
# =============================================================================

class LLMMode(Enum):
    """LLM profiling modes"""
    HYBRID = "hybrid"          # Rules + selective LLM
    FULL_LLM = "full_llm"      # 100% LLM classification


@dataclass
class LLMConfig:
    """Configuration for LLM profiler"""
    model_name: str = "gemini-3-flash-preview"  # Gemini 3 preview model
    preview_model: str = "gemini-3-flash-preview"  # Preview model for testing
    fallback_model: str = "gemini-2.0-flash-001"  # Fallback to stable
    max_retries: int = 3
    timeout_seconds: int = 30
    temperature: float = 0.0  # Low temperature for consistent classification

    # Hybrid mode thresholds
    confidence_threshold: float = 0.70  # Below this triggers LLM
    dominance_gap_threshold: float = 0.15  # Close ratios trigger LLM
    min_places_for_rules: int = 10  # Below this triggers LLM

    # Cost tracking
    max_input_tokens: int = 2000
    max_output_tokens: int = 2000  # Increased for Gemini 3 thinking tokens


# =============================================================================
# DSPY SIGNATURES AND MODULES
# =============================================================================

if DSPY_AVAILABLE:

    class AreaClassificationSignature(dspy.Signature):
        """Classify area type from nearby places context."""

        places_summary: str = dspy.InputField(
            desc="Summary of nearby places with counts by category"
        )
        location_context: str = dspy.InputField(
            desc="Location context including city, address, coordinates"
        )
        authority_candidates: str = dspy.InputField(
            desc="Potential authority anchors detected in Ring 1 (75m)"
        )

        primary_type: str = dspy.OutputField(
            desc="Primary area type: HEALTHCARE, RETAIL, TRANSIT, EDUCATION, RELIGIOUS, GOVERNMENT, ENTERTAINMENT, SPORTS, HOSPITALITY, OFFICE, FOOD_BEVERAGE, INDUSTRIAL, RESIDENTIAL, TOURISM, MIXED, MIXED_BIASED"
        )
        area_context: str = dspy.OutputField(
            desc="Human-readable area description (e.g., 'Hospital Entrance Zone', 'High Street Retail Area')"
        )
        confidence: str = dspy.OutputField(
            desc="Confidence level: high, medium, or low"
        )
        classification_detail: str = dspy.OutputField(
            desc="Classification detail like DOMINANT, STRONG_BIAS_TOWARD_X, MODERATE_BIAS_TOWARD_X, DIVERSE"
        )
        reasoning: str = dspy.OutputField(
            desc="Brief reasoning for the classification decision"
        )


    class AmbiguityResolutionSignature(dspy.Signature):
        """Resolve ambiguous area classification when rules are uncertain."""

        rule_result: str = dspy.InputField(
            desc="Result from rule-based classification (type and confidence)"
        )
        places_context: str = dspy.InputField(
            desc="Detailed places context with names and types"
        )
        dominance_metrics: str = dspy.InputField(
            desc="Dominance ratios for top groups"
        )

        should_override: bool = dspy.OutputField(
            desc="Whether to override the rule-based result"
        )
        final_type: str = dspy.OutputField(
            desc="Final primary type (same as rule result if not overriding)"
        )
        final_context: str = dspy.OutputField(
            desc="Final area context description"
        )
        rationale: str = dspy.OutputField(
            desc="Explanation for the decision"
        )


    class AuthorityValidationSignature(dspy.Signature):
        """Validate if a detected authority anchor is significant."""

        place_name: str = dspy.InputField(desc="Name of the potential authority place")
        place_types: str = dspy.InputField(desc="Google Places types")
        user_ratings: int = dspy.InputField(desc="Number of user ratings")
        nearby_places: str = dspy.InputField(desc="Other places in Ring 1")

        is_valid_authority: bool = dspy.OutputField(
            desc="Whether this is a valid authority anchor"
        )
        authority_type: str = dspy.OutputField(
            desc="Authority type if valid (HEALTHCARE, TRANSIT, etc.)"
        )
        authority_context: str = dspy.OutputField(
            desc="Context description if valid (e.g., 'Hospital Entrance Zone')"
        )
        validation_reason: str = dspy.OutputField(
            desc="Reason for validation decision"
        )


    class AreaClassifier(dspy.Module):
        """DSPy module for full LLM area classification."""

        def __init__(self):
            super().__init__()
            self.classify = dspy.ChainOfThought(AreaClassificationSignature)

        def forward(
            self,
            places_summary: str,
            location_context: str,
            authority_candidates: str
        ) -> dspy.Prediction:
            return self.classify(
                places_summary=places_summary,
                location_context=location_context,
                authority_candidates=authority_candidates
            )


    class AmbiguityResolver(dspy.Module):
        """DSPy module for resolving ambiguous classifications."""

        def __init__(self):
            super().__init__()
            self.resolve = dspy.ChainOfThought(AmbiguityResolutionSignature)

        def forward(
            self,
            rule_result: str,
            places_context: str,
            dominance_metrics: str
        ) -> dspy.Prediction:
            return self.resolve(
                rule_result=rule_result,
                places_context=places_context,
                dominance_metrics=dominance_metrics
            )


    class AuthorityValidator(dspy.Module):
        """DSPy module for authority anchor validation."""

        def __init__(self):
            super().__init__()
            self.validate = dspy.Predict(AuthorityValidationSignature)

        def forward(
            self,
            place_name: str,
            place_types: str,
            user_ratings: int,
            nearby_places: str
        ) -> dspy.Prediction:
            return self.validate(
                place_name=place_name,
                place_types=place_types,
                user_ratings=user_ratings,
                nearby_places=nearby_places
            )


# =============================================================================
# GEMINI LLM ADAPTER (Non-DSPy fallback)
# =============================================================================

class GeminiAdapter:
    """Direct Gemini API adapter for when DSPy is not available."""

    def __init__(self, config: LLMConfig):
        self.config = config
        self.model = None
        self._initialize()

    def _initialize(self):
        """Initialize Gemini API."""
        if not GEMINI_AVAILABLE:
            raise ImportError("google-generativeai package not installed")

        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY not configured")

        genai.configure(api_key=api_key)

        # Try primary model, fall back to alternative
        try:
            self.model = genai.GenerativeModel(self.config.model_name)
        except Exception:
            self.model = genai.GenerativeModel(self.config.fallback_model)

    def classify_area(
        self,
        places_summary: str,
        location_context: str,
        authority_candidates: str,
        enriched_places_context: str = "",
        use_grounding: bool = True
    ) -> Dict[str, Any]:
        """Classify area using direct Gemini API call with enhanced context.

        Args:
            places_summary: Summary of places by category
            location_context: Geographic context (city, state, coordinates)
            authority_candidates: Potential authority anchors in Ring 1
            enriched_places_context: Editorial summaries and detailed place info
            use_grounding: Enable Google Search grounding for additional context

        Returns:
            Classification result with optional grounding metadata
        """

        prompt = self._build_classification_prompt(
            places_summary, location_context, authority_candidates, enriched_places_context
        )

        response_text, grounding_metadata = self._call_gemini(prompt, use_grounding=use_grounding)
        result = self._parse_classification_response(response_text)
        if grounding_metadata:
            result["_grounding_metadata"] = grounding_metadata
        return result

    def resolve_ambiguity(
        self,
        rule_result: str,
        places_context: str,
        dominance_metrics: str
    ) -> Dict[str, Any]:
        """Resolve ambiguous classification."""

        prompt = self._build_ambiguity_prompt(
            rule_result, places_context, dominance_metrics
        )

        response_text, _ = self._call_gemini(prompt)
        return self._parse_ambiguity_response(response_text)

    def validate_authority(
        self,
        place_name: str,
        place_types: str,
        user_ratings: int,
        nearby_places: str
    ) -> Dict[str, Any]:
        """Validate authority anchor."""

        prompt = self._build_authority_prompt(
            place_name, place_types, user_ratings, nearby_places
        )

        response_text, _ = self._call_gemini(prompt)
        return self._parse_authority_response(response_text)

    def _build_classification_prompt(
        self,
        places_summary: str,
        location_context: str,
        authority_candidates: str,
        enriched_places_context: str = ""
    ) -> str:
        """Build prompt for area classification with enhanced context."""

        # Build enriched context section if available
        enriched_section = ""
        if enriched_places_context:
            enriched_section = f"""

ENRICHED PLACE DESCRIPTIONS (from Google editorial summaries):
{enriched_places_context}

USE THESE DESCRIPTIONS to understand the TRUE nature of places:
- A "Medical College" with description mentioning "hospital", "patient care", "emergency" → HEALTHCARE
- A "Station" with description about "trains", "platforms", "passengers" → TRANSIT
- Read the descriptions carefully - they reveal the actual function of places!
"""

        return f"""You are an expert DOOH (Digital Out-of-Home) advertising location analyst for India.
Your task is to classify the PRIMARY AREA TYPE to help advertisers target the right audience.

CRITICAL RULES (in order of priority):

1. AUTHORITY ANCHOR RULE (HIGHEST PRIORITY):
   If a major landmark is within 75m, it OVERRIDES percentage-based classification:
   - HEALTHCARE: AIIMS, Fortis, Apollo, Max, Medanta, Narayana Health, or any "Hospital" with 300+ ratings
   - TRANSIT: Any "Junction", "Central", "Terminus", Railway Station, Metro Station, Airport, Bus Terminal
   - EDUCATION: University, IIT, IIM, NIT, BITS, "Institute of Technology", major colleges
   - RETAIL: Large malls with 500+ ratings

2. NAME PATTERN RULE:
   - "AIIMS" = All India Institute of Medical Sciences → HEALTHCARE (NOT EDUCATION)
   - "Medical College/Institute" with hospital facilities → HEALTHCARE (teaching hospitals)
   - "[City] Junction", "[City] Central" → TRANSIT (railway stations)
   - "Coaching", "Classes", "Academy" → NOT authority anchors

3. EDITORIAL DESCRIPTION RULE (NEW - HIGH VALUE):
   - If editorial_summary mentions "hospital", "medical", "patient", "treatment" → HEALTHCARE
   - If editorial_summary mentions "train", "railway", "platform", "departure" → TRANSIT
   - If editorial_summary mentions "campus", "students", "academic" → EDUCATION
   - Trust descriptions over type labels when they conflict!

4. SIZE/VIEWPORT RULE:
   - LARGE size (>0.1 km²) confirms major landmarks: airports, hospitals, universities, malls
   - MEDIUM size confirms significant venues
   - Small clinics, shops won't have LARGE viewport

5. PERCENTAGE RULE (only if no authority anchor):
   - DOMINANT: One category >55%
   - STRONG_BIAS: One category 40-55%
   - MODERATE_BIAS: One category 28-40%
   - MIXED: No clear dominant category

LOCATION CONTEXT:
{location_context}

NEARBY PLACES SUMMARY:
{places_summary}

POTENTIAL AUTHORITY ANCHORS (within 75m):
{authority_candidates}
{enriched_section}
EXAMPLES:
- AIIMS Delhi with pharmacies nearby → HEALTHCARE (AUTHORITY_OVERRIDE)
- Bangalore City Junction with hotels → TRANSIT (AUTHORITY_OVERRIDE)
- Fortis Hospital with cafeterias → HEALTHCARE (AUTHORITY_OVERRIDE)
- Place with editorial saying "premier hospital with 500 beds" → HEALTHCARE
- Area with 60% retail, no major landmark → RETAIL (DOMINANT)

Respond with ONLY valid JSON:
{{
  "primary_type": "HEALTHCARE|RETAIL|TRANSIT|EDUCATION|RELIGIOUS|GOVERNMENT|ENTERTAINMENT|SPORTS|HOSPITALITY|OFFICE|FOOD_BEVERAGE|INDUSTRIAL|RESIDENTIAL|TOURISM|MIXED|MIXED_BIASED",
  "area_context": "Human-readable description (e.g., 'AIIMS Hospital Zone', 'Railway Station Area')",
  "confidence": "high|medium|low",
  "classification_detail": "AUTHORITY_OVERRIDE|DOMINANT|STRONG_BIAS_TOWARD_X|MODERATE_BIAS_TOWARD_X|DIVERSE",
  "reasoning": "Brief reasoning citing which rule was applied"
}}"""

    def _build_ambiguity_prompt(
        self,
        rule_result: str,
        places_context: str,
        dominance_metrics: str
    ) -> str:
        """Build prompt for ambiguity resolution."""
        return f"""You are VALIDATING an area classification. The rule-based system has provided a result.

RULE-BASED RESULT:
{rule_result}

PLACES CONTEXT (analyze place NAMES carefully):
{places_context}

DOMINANCE METRICS:
{dominance_metrics}

OVERRIDE ONLY IF you find a CLEAR ERROR. Common corrections:
- "AIIMS" classified as EDUCATION → Override to HEALTHCARE (it's a hospital)
- "Medical Institute/College" with hospital → Override to HEALTHCARE
- "[City] Junction/Central" classified as HOSPITALITY → Override to TRANSIT (railway station)
- "Fortis/Apollo/Max" classified as MIXED → Override to HEALTHCARE (hospital chain)

DO NOT OVERRIDE if:
- The rule-based type matches the dominant category
- Dominance ratio > 0.28 (rule-based is confident enough)
- No authority anchor misclassification detected

IMPORTANT: Do NOT default to MIXED. Only use MIXED if truly diverse with no pattern.

Respond with ONLY valid JSON:
{{
  "should_override": true|false,
  "final_type": "HEALTHCARE|RETAIL|TRANSIT|EDUCATION|RELIGIOUS|GOVERNMENT|ENTERTAINMENT|SPORTS|HOSPITALITY|OFFICE|FOOD_BEVERAGE|INDUSTRIAL|RESIDENTIAL|TOURISM|MIXED|MIXED_BIASED",
  "final_context": "Human-readable area description",
  "rationale": "Cite which correction rule applied, or why no override needed"
}}"""

    def _build_authority_prompt(
        self,
        place_name: str,
        place_types: str,
        user_ratings: int,
        nearby_places: str
    ) -> str:
        """Build prompt for authority validation."""
        return f"""Validate if this place is a significant "authority anchor" that defines the area.

PLACE:
- Name: {place_name}
- Types: {place_types}
- User Ratings: {user_ratings}

NEARBY PLACES (within 75m):
{nearby_places}

Authority anchors are major landmarks that define an area's character:
- Hospitals (not small clinics)
- Airports, major railway/metro stations
- Universities, major colleges
- Large shopping malls
- Major religious sites
- Government buildings (courthouse, city hall)

Respond with ONLY valid JSON:
{{
  "is_valid_authority": true|false,
  "authority_type": "HEALTHCARE|TRANSIT|EDUCATION|RETAIL|RELIGIOUS|GOVERNMENT|ENTERTAINMENT|SPORTS|null",
  "authority_context": "Zone description if valid, else null",
  "validation_reason": "Brief reason"
}}"""

    def _call_gemini(
        self,
        prompt: str,
        use_grounding: bool = False
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        Make Gemini API call with retry logic.

        Args:
            prompt: The prompt text
            use_grounding: Enable Google Search grounding for location context

        Returns:
            Tuple of (response_text, grounding_metadata)
        """
        # Try REST API first (more reliable, bypasses SSL issues)
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')

        for attempt in range(self.config.max_retries):
            try:
                # Use REST API directly with optional grounding
                return self._call_gemini_rest(prompt, api_key, use_grounding=use_grounding)
            except Exception as e:
                if attempt == self.config.max_retries - 1:
                    # Final fallback: try SDK (without grounding)
                    try:
                        response = self.model.generate_content(
                            prompt,
                            generation_config=genai.GenerationConfig(
                                temperature=self.config.temperature,
                                max_output_tokens=self.config.max_output_tokens,
                            )
                        )
                        return response.text.strip(), None
                    except Exception:
                        raise e
                # Exponential backoff
                time.sleep((attempt + 1) * 2)
        return "", None

    def _call_gemini_rest(
        self,
        prompt: str,
        api_key: str,
        use_grounding: bool = False,
        grounding_context: Optional[str] = None
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        Call Gemini via REST API (more reliable, with optional grounding).

        Args:
            prompt: The prompt text
            api_key: Gemini API key
            use_grounding: Enable Google Search grounding
            grounding_context: Optional context for grounded search

        Returns:
            Tuple of (response_text, grounding_metadata)
        """
        import requests
        import urllib3

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.config.model_name}:generateContent?key={api_key}"

        payload: Dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": self.config.max_output_tokens
            }
        }

        # Add Google Search grounding if enabled
        # This allows Gemini to search for additional context about locations
        if use_grounding:
            payload["tools"] = [{
                "googleSearch": {}
            }]

        # Disable SSL warnings for testing (system SSL certs not configured properly)
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        # Use verify=False to bypass SSL certificate issues on macOS
        # This is acceptable for testing; in production, fix SSL certs properly
        response = requests.post(
            url, json=payload,
            timeout=self.config.timeout_seconds,
            verify=False
        )

        response.raise_for_status()

        data = response.json()
        grounding_metadata = None

        if "candidates" in data and len(data["candidates"]) > 0:
            candidate = data["candidates"][0]

            # Extract grounding metadata if present
            if "groundingMetadata" in candidate:
                grounding_metadata = candidate["groundingMetadata"]

            if "content" in candidate and "parts" in candidate["content"]:
                text = candidate["content"]["parts"][0].get("text", "").strip()
                return text, grounding_metadata

        return "", grounding_metadata

    def _parse_classification_response(self, response: str) -> Dict[str, Any]:
        """Parse classification response."""
        try:
            # Remove markdown if present
            text = response.replace('```json', '').replace('```', '').strip()
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "primary_type": "MIXED",
                "area_context": "Classification Error",
                "confidence": "low",
                "classification_detail": "PARSE_ERROR",
                "reasoning": "Failed to parse LLM response"
            }

    def _parse_ambiguity_response(self, response: str) -> Dict[str, Any]:
        """Parse ambiguity resolution response."""
        try:
            text = response.replace('```json', '').replace('```', '').strip()
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "should_override": False,
                "final_type": "MIXED",
                "final_context": "Resolution Error",
                "rationale": "Failed to parse LLM response"
            }

    def _parse_authority_response(self, response: str) -> Dict[str, Any]:
        """Parse authority validation response."""
        try:
            text = response.replace('```json', '').replace('```', '').strip()
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "is_valid_authority": False,
                "authority_type": None,
                "authority_context": None,
                "validation_reason": "Failed to parse LLM response"
            }


# =============================================================================
# DSPy LM CONFIGURATION
# =============================================================================

class DSPyGeminiLM:
    """DSPy-compatible Gemini LM wrapper."""

    def __init__(self, config: LLMConfig):
        self.config = config
        self.adapter = GeminiAdapter(config)

    def __call__(self, prompt: str, **kwargs) -> str:
        """Make LLM call."""
        response_text, _ = self.adapter._call_gemini(prompt)
        return response_text


def configure_dspy_gemini(config: LLMConfig = None):
    """Configure DSPy to use Gemini."""
    if not DSPY_AVAILABLE:
        return None

    config = config or LLMConfig()

    # Check for API key
    api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not api_key:
        return None

    try:
        # DSPy 2.5+ supports Google Gemini - use correct model path
        # Format: gemini/<model-name> for Google AI Studio API
        lm = dspy.LM(
            model=f"gemini/{config.model_name}",
            api_key=api_key,
            temperature=config.temperature,
            max_tokens=config.max_output_tokens
        )
        dspy.configure(lm=lm)
        return lm
    except Exception as e:
        # Fallback: use adapter
        print(f"DSPy Gemini config failed: {e}")
        return None


# =============================================================================
# LLM PROFILER SERVICE
# =============================================================================

@dataclass
class LLMProfileResult:
    """Result from LLM profiling."""
    primary_type: str
    area_context: str
    confidence: str
    classification_detail: str
    reasoning: str
    llm_used: bool = True
    llm_mode: str = "full_llm"
    latency_ms: int = 0
    cached: bool = False
    error: Optional[str] = None


class LLMProfilerService:
    """
    LLM-based area profiler using DSPy framework.

    Supports two modes:
    - Hybrid: Rule-based with LLM for edge cases
    - Full LLM: 100% LLM classification
    """

    def __init__(self, config: LLMConfig = None):
        self.config = config or LLMConfig()
        self._cache: Dict[str, LLMProfileResult] = {}
        self._dspy_configured = False

        # Initialize components
        self._setup_dspy()
        self._setup_adapter()

    def _setup_dspy(self):
        """Setup DSPy components if available."""
        # Skip DSPy for now due to SSL issues with litellm
        # Use direct REST adapter instead which is more reliable
        self._dspy_configured = False

    def _setup_adapter(self):
        """Setup direct Gemini adapter as fallback."""
        try:
            # Ensure GEMINI_API_KEY is in environment (critical for both Adapter and DSPy)
            if not os.getenv('GEMINI_API_KEY'):
                try:
                    from django.conf import settings
                    # Try GEMINI_API_KEY first, then GOOGLE_API_KEY
                    key = getattr(settings, 'GEMINI_API_KEY', '') or getattr(settings, 'GOOGLE_API_KEY', '')
                    if key:
                        os.environ['GEMINI_API_KEY'] = key
                        print(f"DEBUG: Loaded GEMINI_API_KEY from settings (len={len(key)})")
                    else:
                        print("DEBUG: GEMINI_API_KEY not found in settings")
                except Exception as e:
                    print(f"DEBUG: Failed to load settings: {e}")

            self.adapter = GeminiAdapter(self.config)
            print("DEBUG: GeminiAdapter initialized successfully")
        except Exception as e:
            print(f"ERROR: Failed to initialize GeminiAdapter: {e}")
            import traceback
            traceback.print_exc()
            self.adapter = None

    @property
    def is_available(self) -> bool:
        """Check if LLM service is available (adapter initialized with API key)."""
        if self.adapter is None:
            # Try to setup again just in case env vars were loaded late
            self._setup_adapter()
        return self.adapter is not None

    def should_use_llm(
        self,
        confidence: str,
        dominance_ratio: float,
        second_ratio: float = 0.0,
        places_count: int = 0
    ) -> Tuple[bool, str]:
        """
        Decide whether LLM should be invoked in hybrid mode.

        Returns:
            Tuple of (should_use: bool, reason: str)
        """
        # Low confidence always triggers LLM
        if confidence == "low":
            return True, "LOW_CONFIDENCE"

        # Close dominance gap triggers LLM
        gap = abs(dominance_ratio - second_ratio)
        if gap < self.config.dominance_gap_threshold and dominance_ratio < 0.55:
            return True, "CLOSE_DOMINANCE_GAP"

        # Insufficient places data triggers LLM
        if places_count < self.config.min_places_for_rules:
            return True, "INSUFFICIENT_PLACES"

        # High confidence rule-based result - skip LLM
        if confidence == "high":
            return False, "RULES_CONFIDENT"

        # Medium confidence with good dominance - skip LLM
        if dominance_ratio >= self.config.confidence_threshold:
            return False, "STRONG_DOMINANCE"

        return False, "RULES_SUFFICIENT"

    def _cache_key(self, lat: float, lng: float, mode: str) -> str:
        """Generate cache key."""
        key = f"{round(lat, 5)}:{round(lng, 5)}:{mode}"
        return hashlib.md5(key.encode()).hexdigest()

    def classify_full_llm(
        self,
        places_summary: str,
        location_context: str,
        authority_candidates: str,
        latitude: float = 0,
        longitude: float = 0,
        enriched_places_context: str = ""
    ) -> LLMProfileResult:
        """
        Full LLM classification mode with enhanced context.

        Args:
            places_summary: Summary of places by category
            location_context: Geographic context
            authority_candidates: Potential authority anchors
            latitude: For caching
            longitude: For caching
            enriched_places_context: Editorial summaries and detailed place info

        Returns:
            LLMProfileResult with classification
        """
        start_time = time.time()
        cache_key = self._cache_key(latitude, longitude, "full_llm")

        # Check cache
        if cache_key in self._cache:
            result = self._cache[cache_key]
            result.cached = True
            return result

        try:
            if self._dspy_configured:
                # Use DSPy module
                prediction = self.classifier(
                    places_summary=places_summary,
                    location_context=location_context,
                    authority_candidates=authority_candidates
                )
                result = LLMProfileResult(
                    primary_type=prediction.primary_type,
                    area_context=prediction.area_context,
                    confidence=prediction.confidence,
                    classification_detail=prediction.classification_detail,
                    reasoning=prediction.reasoning,
                    llm_used=True,
                    llm_mode="full_llm",
                    latency_ms=int((time.time() - start_time) * 1000)
                )
            elif self.adapter:
                # Use direct adapter with enriched context
                response = self.adapter.classify_area(
                    places_summary=places_summary,
                    location_context=location_context,
                    authority_candidates=authority_candidates,
                    enriched_places_context=enriched_places_context
                )
                result = LLMProfileResult(
                    primary_type=response.get("primary_type", "MIXED"),
                    area_context=response.get("area_context", "Unknown"),
                    confidence=response.get("confidence", "low"),
                    classification_detail=response.get("classification_detail", "UNKNOWN"),
                    reasoning=response.get("reasoning", ""),
                    llm_used=True,
                    llm_mode="full_llm",
                    latency_ms=int((time.time() - start_time) * 1000)
                )
            else:
                raise ValueError("No LLM backend available")

            # Cache result
            self._cache[cache_key] = result
            return result

        except Exception as e:
            return LLMProfileResult(
                primary_type="MIXED",
                area_context="LLM Error",
                confidence="low",
                classification_detail="LLM_ERROR",
                reasoning=str(e),
                llm_used=False,
                llm_mode="full_llm",
                latency_ms=int((time.time() - start_time) * 1000),
                error=str(e)
            )

    def resolve_ambiguity(
        self,
        rule_result: Dict[str, Any],
        places_context: str,
        dominance_metrics: str
    ) -> Dict[str, Any]:
        """
        Resolve ambiguous rule-based classification.

        Used in hybrid mode when:
        - Confidence is low
        - Dominance ratios are close
        - Insufficient places data

        Args:
            rule_result: Result from rule-based system
            places_context: Detailed places information
            dominance_metrics: Dominance ratios

        Returns:
            Resolution with override decision
        """
        start_time = time.time()

        rule_str = json.dumps(rule_result)

        try:
            if self._dspy_configured:
                prediction = self.resolver(
                    rule_result=rule_str,
                    places_context=places_context,
                    dominance_metrics=dominance_metrics
                )
                return {
                    "should_override": prediction.should_override,
                    "final_type": prediction.final_type,
                    "final_context": prediction.final_context,
                    "rationale": prediction.rationale,
                    "latency_ms": int((time.time() - start_time) * 1000)
                }
            elif self.adapter:
                response = self.adapter.resolve_ambiguity(
                    rule_result=rule_str,
                    places_context=places_context,
                    dominance_metrics=dominance_metrics
                )
                response["latency_ms"] = int((time.time() - start_time) * 1000)
                return response
            else:
                return {
                    "should_override": False,
                    "final_type": rule_result.get("primary_type", "MIXED"),
                    "final_context": rule_result.get("context", "Unknown"),
                    "rationale": "No LLM backend available",
                    "latency_ms": 0
                }
        except Exception as e:
            return {
                "should_override": False,
                "final_type": rule_result.get("primary_type", "MIXED"),
                "final_context": rule_result.get("context", "Unknown"),
                "rationale": f"LLM error: {str(e)}",
                "latency_ms": int((time.time() - start_time) * 1000)
            }

    def validate_authority(
        self,
        place_name: str,
        place_types: List[str],
        user_ratings: int,
        nearby_places: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate if a detected authority anchor is significant.

        Used in hybrid mode when rule-based authority detection
        returns a low-confidence result.

        Args:
            place_name: Name of potential authority
            place_types: Google Places types
            user_ratings: Number of reviews
            nearby_places: Other places in Ring 1

        Returns:
            Validation result
        """
        start_time = time.time()

        types_str = ", ".join(place_types)
        nearby_str = "\n".join([
            f"- {p.get('name', 'Unknown')} ({', '.join(p.get('types', [])[:3])})"
            for p in nearby_places[:10]
        ])

        try:
            if self._dspy_configured:
                prediction = self.authority_validator(
                    place_name=place_name,
                    place_types=types_str,
                    user_ratings=user_ratings,
                    nearby_places=nearby_str
                )
                return {
                    "is_valid": prediction.is_valid_authority,
                    "type": prediction.authority_type,
                    "context": prediction.authority_context,
                    "reason": prediction.validation_reason,
                    "latency_ms": int((time.time() - start_time) * 1000)
                }
            elif self.adapter:
                response = self.adapter.validate_authority(
                    place_name=place_name,
                    place_types=types_str,
                    user_ratings=user_ratings,
                    nearby_places=nearby_str
                )
                return {
                    "is_valid": response.get("is_valid_authority", False),
                    "type": response.get("authority_type"),
                    "context": response.get("authority_context"),
                    "reason": response.get("validation_reason", ""),
                    "latency_ms": int((time.time() - start_time) * 1000)
                }
            else:
                return {
                    "is_valid": False,
                    "type": None,
                    "context": None,
                    "reason": "No LLM backend available",
                    "latency_ms": 0
                }
        except Exception as e:
            return {
                "is_valid": False,
                "type": None,
                "context": None,
                "reason": f"LLM error: {str(e)}",
                "latency_ms": int((time.time() - start_time) * 1000)
            }

    def should_use_llm(
        self,
        confidence: str,
        dominance_ratio: float,
        second_ratio: float,
        places_count: int
    ) -> Tuple[bool, str]:
        """
        Determine if LLM should be invoked for hybrid mode.

        Args:
            confidence: Current confidence level
            dominance_ratio: Top group dominance ratio
            second_ratio: Second group ratio
            places_count: Number of unique places

        Returns:
            Tuple of (should_use_llm, reason)

        Note: Thresholds tuned to avoid triggering LLM for clear classifications.
        Only invoke LLM for genuinely ambiguous cases to prevent degradation.
        """
        # =====================================================================
        # TEST MODE - Set to True to force LLM for every request (for testing)
        # Set back to False for production!
        # =====================================================================
        TEST_MODE = False  # Production mode - LLM only for edge cases
        
        if TEST_MODE:
            return (True, "TEST_MODE_FORCED")
        # =====================================================================
        
        # Low confidence always triggers LLM
        if confidence == "low":
            return (True, "LOW_CONFIDENCE")

        # FIX: Only trigger if dominance is weak AND gap is very close
        # Changed from 0.15 to 0.08, and only when dominance < 0.28 (below MODERATE_BIAS)
        if dominance_ratio < 0.28 and abs(dominance_ratio - second_ratio) < 0.08:
            return (True, "CLOSE_DOMINANCE_RATIOS")

        # FIX: Only trigger for very sparse data AND weak dominance
        # Changed from 10 to 5, and require weak dominance
        if places_count < 5 and dominance_ratio < 0.40:
            return (True, "INSUFFICIENT_PLACES_DATA")

        # FIX: More restrictive - only for truly ambiguous cases
        # Require all: medium confidence, very weak dominance, sparse data
        if confidence == "medium" and dominance_ratio < 0.25 and places_count < 8:
            return (True, "BORDERLINE_CLASSIFICATION")

        return (False, "RULES_SUFFICIENT")


    def clear_cache(self):
        """Clear the results cache."""
        self._cache.clear()

    @property
    def is_available(self) -> bool:
        """Check if LLM backend is available."""
        return self._dspy_configured or (self.adapter is not None)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def format_places_summary(group_counts: Dict[str, int], total_places: int) -> str:
    """Format places data for LLM prompt."""
    if not group_counts:
        return "No places data available"

    sorted_groups = sorted(group_counts.items(), key=lambda x: -x[1])
    lines = [f"Total unique places: {total_places}"]
    lines.append("Places by category:")

    for group, count in sorted_groups[:10]:
        pct = (count / total_places * 100) if total_places > 0 else 0
        lines.append(f"  - {group}: {count} ({pct:.1f}%)")

    return "\n".join(lines)


def format_location_context(
    city: str,
    state: str,
    country: str,
    city_tier: str,
    address: str,
    latitude: float,
    longitude: float
) -> str:
    """Format location context for LLM prompt."""
    return f"""City: {city}
State: {state}
Country: {country}
City Tier: {city_tier}
Address: {address}
Coordinates: {latitude}, {longitude}"""


def format_authority_candidates(
    places: List[Dict[str, Any]],
    authority_types: Dict[str, Dict[str, str]]
) -> str:
    """Format authority candidates for LLM prompt with enhanced details."""
    candidates = []

    for place in places:
        types = place.get("types", [])
        for t in types:
            if t in authority_types:
                info = authority_types[t]
                name = place.get('name', 'Unknown')
                ratings = place.get('user_ratings_total', 0)
                rating = place.get('rating', 0)

                # Build candidate string with enhanced info
                candidate_parts = [
                    f"- {name}",
                    f"(type: {t}, category: {info['type']}",
                    f"ratings: {ratings}",
                ]

                # Add rating if available
                if rating:
                    candidate_parts.append(f"rating: {rating}/5")

                # Add editorial summary if available (HUGE context boost)
                editorial = place.get("editorial_summary", {})
                if editorial:
                    summary_text = editorial.get("overview", "")
                    if summary_text:
                        # Truncate to 100 chars for prompt efficiency
                        if len(summary_text) > 100:
                            summary_text = summary_text[:97] + "..."
                        candidate_parts.append(f"description: \"{summary_text}\"")

                # Add viewport area for size context
                viewport = place.get("viewport")
                if viewport:
                    from .google_maps_utils import get_google_maps_service
                    area = get_google_maps_service().calculate_viewport_area(viewport)
                    if area > 100000:  # > 0.1 km²
                        candidate_parts.append(f"size: LARGE ({area/1_000_000:.2f} km²)")
                    elif area > 10000:  # > 0.01 km²
                        candidate_parts.append(f"size: MEDIUM")

                candidates.append(" ".join(candidate_parts) + ")")
                break

    if not candidates:
        return "No authority anchors detected"

    return "\n".join(candidates)


def format_enriched_places_context(
    places: List[Dict[str, Any]],
    max_places: int = 15
) -> str:
    """
    Format enriched places with editorial summaries for LLM context.

    This provides rich semantic context that helps LLM make better decisions.
    """
    lines = ["Key places with descriptions:"]

    # Sort by user_ratings_total (most significant first)
    sorted_places = sorted(
        places,
        key=lambda x: x.get("user_ratings_total", 0) or 0,
        reverse=True
    )[:max_places]

    for place in sorted_places:
        name = place.get("name", "Unknown")
        types = place.get("types", [])[:3]  # Top 3 types
        ratings = place.get("user_ratings_total", 0)
        rating = place.get("rating", 0)

        # Start with basic info
        line_parts = [f"- {name} ({', '.join(types)})"]

        if ratings:
            line_parts.append(f"[{ratings} reviews")
            if rating:
                line_parts.append(f", {rating}★]")
            else:
                line_parts.append("]")

        # Add editorial summary - this is the key enhancement
        editorial = place.get("editorial_summary", {})
        if editorial:
            summary_text = editorial.get("overview", "")
            if summary_text:
                # Include full summary for rich context (up to 150 chars)
                if len(summary_text) > 150:
                    summary_text = summary_text[:147] + "..."
                line_parts.append(f"\n    → \"{summary_text}\"")

        # Add business status if relevant
        business_status = place.get("business_status", "")
        if business_status and business_status != "OPERATIONAL":
            line_parts.append(f"[{business_status}]")

        lines.append(" ".join(line_parts))

    return "\n".join(lines)


def format_dominance_metrics(
    dominant_type: str,
    dominance_ratio: float,
    second_type: str,
    second_ratio: float,
    group_counts: Dict[str, int]
) -> str:
    """Format dominance metrics for LLM prompt."""
    lines = [
        f"Dominant type: {dominant_type} ({dominance_ratio:.1%})",
        f"Second type: {second_type} ({second_ratio:.1%})",
        f"Gap: {abs(dominance_ratio - second_ratio):.1%}",
        "",
        "Full distribution:"
    ]

    total = sum(group_counts.values())
    for group, count in sorted(group_counts.items(), key=lambda x: -x[1]):
        pct = count / total if total > 0 else 0
        lines.append(f"  {group}: {pct:.1%}")

    return "\n".join(lines)


# =============================================================================
# SERVICE SINGLETON
# =============================================================================

_llm_profiler_service: Optional[LLMProfilerService] = None


def get_llm_profiler_service(config: LLMConfig = None) -> LLMProfilerService:
    """Get singleton instance of LLMProfilerService."""
    global _llm_profiler_service
    if _llm_profiler_service is None:
        _llm_profiler_service = LLMProfilerService(config)
    return _llm_profiler_service


def reset_llm_profiler_service():
    """Reset the singleton (for testing)."""
    global _llm_profiler_service
    _llm_profiler_service = None
