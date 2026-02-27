"""
XIGI Area Context Intelligence - LangGraph Research Agent

This module implements an Open Deep Research-inspired agent for area classification
using LangGraph for multi-step research workflows.

Architecture (inspired by langchain-ai/open_deep_research):
1. PLAN - Analyze location and determine research strategy
2. RESEARCH - Gather information using grounded search + Places API
3. SYNTHESIZE - Combine findings into classification
4. VERIFY - Cross-check classification with evidence

Uses Google Gemini with grounding for web search capabilities.

Author: XIGI AI Backend
Version: 1.0.0
"""

from __future__ import annotations

import os
import json
import time
import hashlib
from typing import Dict, List, Optional, Any, TypedDict, Annotated
from dataclasses import dataclass, field
from enum import Enum
import operator

try:
    from langgraph.graph import StateGraph, END, START
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    StateGraph = None
    END = None
    START = None

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


# =============================================================================
# STATE DEFINITION
# =============================================================================

def merge_dicts(left: Dict[str, int], right: Dict[str, int]) -> Dict[str, int]:
    """Merge two dictionaries, combining values."""
    result = left.copy()
    result.update(right)
    return result


class ResearchState(TypedDict, total=False):
    """State for the research agent workflow."""

    # Input (required)
    latitude: float
    longitude: float
    places_data: Dict[str, Any]
    location_context: Dict[str, Any]

    # Planning phase output
    research_plan: str
    research_questions: List[str]

    # Research phase output
    grounded_findings: List[Dict[str, Any]]
    places_analysis: Dict[str, Any]
    authority_analysis: Dict[str, Any]

    # Classification phase output
    primary_type: str
    area_context: str
    confidence: str
    classification_detail: str
    reasoning: str

    # Verification phase output
    verification_result: Dict[str, Any]
    final_classification: Dict[str, Any]

    # Metadata - use Annotated with reducers for accumulating values
    messages: Annotated[List[Dict[str, Any]], operator.add]
    errors: Annotated[List[str], operator.add]
    step_timings: Annotated[Dict[str, int], merge_dicts]


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class ResearchAgentConfig:
    """Configuration for the research agent."""
    model_name: str = "gemini-3-flash-preview"
    fallback_model: str = "gemini-2.0-flash-001"
    max_retries: int = 3
    timeout_seconds: int = 30
    temperature: float = 0.0
    max_output_tokens: int = 2000

    # Research settings
    max_research_questions: int = 3
    enable_grounding: bool = True
    enable_verification: bool = True


# =============================================================================
# AREA TYPE TAXONOMY
# =============================================================================

AREA_TYPES = [
    "HEALTHCARE", "RETAIL", "TRANSIT", "EDUCATION", "RELIGIOUS",
    "GOVERNMENT", "ENTERTAINMENT", "SPORTS", "HOSPITALITY", "OFFICE",
    "FOOD_BEVERAGE", "INDUSTRIAL", "RESIDENTIAL", "TOURISM", "MIXED", "MIXED_BIASED"
]

INDIAN_LANDMARKS = {
    "HEALTHCARE": ["AIIMS", "Fortis", "Apollo", "Max", "Medanta", "Narayana Health", "Manipal"],
    "TRANSIT": ["Junction", "Central", "Terminus", "Railway Station", "Metro", "Airport"],
    "EDUCATION": ["IIT", "IIM", "NIT", "BITS", "University", "Institute of Technology"],
    "RETAIL": ["Mall", "Phoenix", "DLF", "Inorbit", "Infinity"],
    "RELIGIOUS": ["Temple", "Mandir", "Mosque", "Masjid", "Church", "Gurudwara"],
}


# =============================================================================
# GEMINI API CLIENT
# =============================================================================

class GeminiResearchClient:
    """Client for Gemini API with grounding support."""

    def __init__(self, config: ResearchAgentConfig):
        self.config = config
        self.api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')

    def call(
        self,
        prompt: str,
        use_grounding: bool = False,
        system_instruction: str = None
    ) -> Dict[str, Any]:
        """Make Gemini API call with optional grounding."""
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.config.model_name}:generateContent?key={self.api_key}"

        # Build content
        contents = []
        if system_instruction:
            contents.append({"role": "user", "parts": [{"text": system_instruction}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will follow these instructions."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": self.config.max_output_tokens
            }
        }

        # Add grounding for web search capability
        if use_grounding and self.config.enable_grounding:
            payload["tools"] = [{"googleSearch": {}}]

        try:
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

            response = requests.post(
                url, json=payload,
                timeout=self.config.timeout_seconds,
                verify=False
            )
            response.raise_for_status()
            data = response.json()

            result = {
                "text": "",
                "grounding_metadata": None,
                "usage": data.get("usageMetadata", {})
            }

            if "candidates" in data and len(data["candidates"]) > 0:
                candidate = data["candidates"][0]

                if "groundingMetadata" in candidate:
                    result["grounding_metadata"] = candidate["groundingMetadata"]

                if "content" in candidate and "parts" in candidate["content"]:
                    result["text"] = candidate["content"]["parts"][0].get("text", "").strip()

            return result

        except Exception as e:
            return {"text": "", "error": str(e), "grounding_metadata": None}


# =============================================================================
# NODE FUNCTIONS
# =============================================================================

def create_planning_node(client: GeminiResearchClient):
    """Create the planning node that analyzes the location and creates a research plan."""

    def planning_node(state: ResearchState) -> Dict[str, Any]:
        start_time = time.time()

        lat = state["latitude"]
        lng = state["longitude"]
        places_data = state.get("places_data", {})
        location_context = state.get("location_context", {})

        # Build planning prompt
        prompt = f"""You are a location research planner for DOOH (Digital Out-of-Home) advertising in India.

TASK: Create a research plan to classify this location's area type.

LOCATION:
- Coordinates: {lat}, {lng}
- City: {location_context.get('city', 'Unknown')}
- State: {location_context.get('state', 'Unknown')}
- Address: {location_context.get('formattedAddress', 'Unknown')}

PLACES SUMMARY:
{json.dumps(places_data.get('group_counts', {}), indent=2)}

Total unique places: {places_data.get('unique_count', 0)}
Dominant group: {places_data.get('dominant_type', 'Unknown')} ({places_data.get('dominance_ratio', 0):.1%})

AUTHORITY CANDIDATES (within 75m):
{places_data.get('authority_candidates', 'None detected')}

Based on this information:
1. What is the most likely area type?
2. What specific questions should we research to confirm?
3. What landmarks or institutions should we verify?

Respond in JSON format:
{{
  "initial_hypothesis": "AREA_TYPE",
  "confidence": "high|medium|low",
  "research_questions": [
    "Question 1 about the location...",
    "Question 2 about nearby landmarks...",
    "Question 3 about the area character..."
  ],
  "key_landmarks_to_verify": ["landmark1", "landmark2"],
  "reasoning": "Brief explanation of hypothesis"
}}"""

        response = client.call(prompt, use_grounding=False)

        try:
            text = response.get("text", "")
            text = text.replace('```json', '').replace('```', '').strip()
            plan = json.loads(text)
        except json.JSONDecodeError:
            plan = {
                "initial_hypothesis": "MIXED",
                "confidence": "low",
                "research_questions": [
                    f"What is the main character of the area near {location_context.get('formattedAddress', 'this location')}?",
                    f"What major landmarks are near coordinates {lat}, {lng}?",
                    "What type of audience frequents this area?"
                ],
                "key_landmarks_to_verify": [],
                "reasoning": "Could not parse LLM response, using default questions"
            }

        latency = int((time.time() - start_time) * 1000)

        return {
            "research_plan": json.dumps(plan),
            "research_questions": plan.get("research_questions", [])[:3],
            "messages": [{
                "step": "planning",
                "hypothesis": plan.get("initial_hypothesis"),
                "questions": plan.get("research_questions", [])[:3]
            }],
            "step_timings": {"planning": latency}
        }

    return planning_node


def create_research_node(client: GeminiResearchClient):
    """Create the research node that gathers information using grounding."""

    def research_node(state: ResearchState) -> Dict[str, Any]:
        start_time = time.time()

        research_questions = state.get("research_questions", [])
        location_context = state.get("location_context", {})
        lat = state["latitude"]
        lng = state["longitude"]

        grounded_findings = []

        # Research each question with grounding
        for question in research_questions[:3]:
            # Build grounded search prompt
            search_prompt = f"""Research this question about a location in India:

QUESTION: {question}

LOCATION CONTEXT:
- City: {location_context.get('city', 'Unknown')}
- State: {location_context.get('state', 'Unknown')}
- Coordinates: {lat}, {lng}

Search for relevant information and provide:
1. Key findings about this location
2. Notable landmarks or institutions nearby
3. The typical character/audience of this area

Focus on DOOH advertising relevance - what type of people visit this area?

Respond in JSON:
{{
  "question": "{question}",
  "findings": ["finding1", "finding2", "finding3"],
  "landmarks_found": ["landmark1", "landmark2"],
  "area_character": "Brief description",
  "confidence": "high|medium|low"
}}"""

            response = client.call(search_prompt, use_grounding=True)

            try:
                text = response.get("text", "")
                text = text.replace('```json', '').replace('```', '').strip()
                finding = json.loads(text)
                finding["grounding_metadata"] = response.get("grounding_metadata")
            except json.JSONDecodeError:
                finding = {
                    "question": question,
                    "findings": ["Could not parse response"],
                    "landmarks_found": [],
                    "area_character": "Unknown",
                    "confidence": "low",
                    "error": "JSON parse error"
                }

            grounded_findings.append(finding)

        # Analyze places data for authority detection
        places_data = state.get("places_data", {})
        authority_analysis = _analyze_authority_patterns(places_data)

        latency = int((time.time() - start_time) * 1000)

        return {
            "grounded_findings": grounded_findings,
            "authority_analysis": authority_analysis,
            "messages": [{
                "step": "research",
                "findings_count": len(grounded_findings),
                "authority_detected": authority_analysis.get("detected", False)
            }],
            "step_timings": {"research": latency}
        }

    return research_node


def _analyze_authority_patterns(places_data: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze places data for authority anchor patterns."""
    authority_candidates = places_data.get("ring1_places", [])
    group_counts = places_data.get("group_counts", {})

    detected_authority = None
    authority_confidence = "low"

    # Check for authority anchors in Ring 1
    for place in authority_candidates:
        name = (place.get("name", "") or "").lower()
        types = set(place.get("types", []))
        ratings = place.get("user_ratings_total", 0) or 0

        # Healthcare authorities
        if "hospital" in types and ratings >= 100:
            detected_authority = {"type": "HEALTHCARE", "name": place.get("name"), "ratings": ratings}
            authority_confidence = "high" if ratings >= 300 else "medium"
            break

        # Check for AIIMS, Fortis, Apollo, etc.
        for kw in ["aiims", "fortis", "apollo", "max hospital", "medanta"]:
            if kw in name and ratings >= 50:
                detected_authority = {"type": "HEALTHCARE", "name": place.get("name"), "ratings": ratings}
                authority_confidence = "high"
                break

        # Transit authorities
        transit_types = {"train_station", "transit_station", "bus_station", "airport"}
        if types.intersection(transit_types) and ratings >= 50:
            detected_authority = {"type": "TRANSIT", "name": place.get("name"), "ratings": ratings}
            authority_confidence = "high" if ratings >= 200 else "medium"
            break

        # Check for Junction, Central, Terminus in name
        for kw in ["junction", "central", "terminus", "railway"]:
            if kw in name and ratings >= 30:
                detected_authority = {"type": "TRANSIT", "name": place.get("name"), "ratings": ratings}
                authority_confidence = "medium"
                break

    return {
        "detected": detected_authority is not None,
        "authority": detected_authority,
        "confidence": authority_confidence,
        "group_distribution": group_counts
    }


def create_classification_node(client: GeminiResearchClient):
    """Create the classification node that synthesizes findings."""

    def classification_node(state: ResearchState) -> Dict[str, Any]:
        start_time = time.time()

        research_plan = state.get("research_plan", "{}")
        grounded_findings = state.get("grounded_findings", [])
        authority_analysis = state.get("authority_analysis", {})
        places_data = state.get("places_data", {})
        location_context = state.get("location_context", {})

        # Build synthesis prompt
        prompt = f"""You are an expert DOOH location classifier for India. Synthesize all research to classify this location.

RESEARCH PLAN:
{research_plan}

GROUNDED RESEARCH FINDINGS:
{json.dumps(grounded_findings, indent=2)}

AUTHORITY ANALYSIS:
{json.dumps(authority_analysis, indent=2)}

PLACES DATA:
- Group distribution: {json.dumps(places_data.get('group_counts', {}), indent=2)}
- Dominant type: {places_data.get('dominant_type', 'Unknown')} ({places_data.get('dominance_ratio', 0):.1%})
- Unique places: {places_data.get('unique_count', 0)}

LOCATION:
- City: {location_context.get('city', 'Unknown')}
- State: {location_context.get('state', 'Unknown')}
- Address: {location_context.get('formattedAddress', 'Unknown')}

CLASSIFICATION RULES (in priority order):
1. AUTHORITY OVERRIDE: If a major landmark (hospital, station, airport, university) is detected → use its type
2. DOMINANCE: If one type > 55% → that type (DOMINANT)
3. STRONG BIAS: If one type 40-55% → MIXED_BIASED with STRONG_BIAS_TOWARD_X
4. MODERATE BIAS: If one type 28-40% → MIXED_BIASED with MODERATE_BIAS_TOWARD_X
5. MIXED: Otherwise → MIXED with appropriate detail

Valid types: HEALTHCARE, RETAIL, TRANSIT, EDUCATION, RELIGIOUS, GOVERNMENT, ENTERTAINMENT, SPORTS, HOSPITALITY, OFFICE, FOOD_BEVERAGE, INDUSTRIAL, RESIDENTIAL, TOURISM, MIXED, MIXED_BIASED

Synthesize all evidence and provide final classification:
{{
  "primary_type": "TYPE",
  "area_context": "Human-readable description (e.g., 'Hospital Zone - AIIMS', 'Railway Station Area')",
  "confidence": "high|medium|low",
  "classification_detail": "AUTHORITY_OVERRIDE|DOMINANT|STRONG_BIAS_TOWARD_X|MODERATE_BIAS_TOWARD_X|DIVERSE",
  "reasoning": "Cite specific evidence from research that supports this classification",
  "key_evidence": ["evidence1", "evidence2", "evidence3"]
}}"""

        response = client.call(prompt, use_grounding=False)

        try:
            text = response.get("text", "")
            text = text.replace('```json', '').replace('```', '').strip()
            classification = json.loads(text)
        except json.JSONDecodeError:
            # Fallback to authority analysis or dominance
            if authority_analysis.get("detected"):
                auth = authority_analysis.get("authority", {})
                classification = {
                    "primary_type": auth.get("type", "MIXED"),
                    "area_context": f"{auth.get('type', 'Mixed')} Zone - {auth.get('name', 'Unknown')}",
                    "confidence": authority_analysis.get("confidence", "low"),
                    "classification_detail": "AUTHORITY_OVERRIDE",
                    "reasoning": f"Authority anchor detected: {auth.get('name')}",
                    "key_evidence": [f"Authority: {auth.get('name')} with {auth.get('ratings', 0)} ratings"]
                }
            else:
                dom_type = places_data.get("dominant_type", "MIXED")
                dom_ratio = places_data.get("dominance_ratio", 0)
                classification = {
                    "primary_type": dom_type if dom_ratio >= 0.55 else "MIXED",
                    "area_context": f"{dom_type} Zone" if dom_ratio >= 0.55 else "Mixed Use Area",
                    "confidence": "medium" if dom_ratio >= 0.40 else "low",
                    "classification_detail": "DOMINANT" if dom_ratio >= 0.55 else "DIVERSE",
                    "reasoning": f"Based on dominance ratio: {dom_ratio:.1%}",
                    "key_evidence": [f"Dominant type {dom_type} at {dom_ratio:.1%}"]
                }

        latency = int((time.time() - start_time) * 1000)

        return {
            "primary_type": classification.get("primary_type", "MIXED"),
            "area_context": classification.get("area_context", "Unknown Area"),
            "confidence": classification.get("confidence", "low"),
            "classification_detail": classification.get("classification_detail", "UNKNOWN"),
            "reasoning": classification.get("reasoning", ""),
            "messages": [{
                "step": "classification",
                "type": classification.get("primary_type"),
                "confidence": classification.get("confidence")
            }],
            "step_timings": {"classification": latency}
        }

    return classification_node


def create_verification_node(client: GeminiResearchClient):
    """Create the verification node that cross-checks the classification."""

    def verification_node(state: ResearchState) -> Dict[str, Any]:
        start_time = time.time()

        primary_type = state.get("primary_type", "MIXED")
        area_context = state.get("area_context", "Unknown")
        reasoning = state.get("reasoning", "")
        grounded_findings = state.get("grounded_findings", [])
        places_data = state.get("places_data", {})
        location_context = state.get("location_context", {})

        # Build verification prompt with grounding
        prompt = f"""Verify this area classification using web search:

PROPOSED CLASSIFICATION:
- Type: {primary_type}
- Context: {area_context}
- Reasoning: {reasoning}

LOCATION:
- City: {location_context.get('city', 'Unknown')}
- State: {location_context.get('state', 'Unknown')}
- Address: {location_context.get('formattedAddress', 'Unknown')}
- Coordinates: {state.get('latitude')}, {state.get('longitude')}

RESEARCH FINDINGS:
{json.dumps(grounded_findings, indent=2)}

Search for information about this location and verify:
1. Is the classification accurate?
2. Are there any major landmarks we missed?
3. What is the real character of this area?

Respond in JSON:
{{
  "verification_status": "CONFIRMED|ADJUSTED|UNCERTAIN",
  "adjusted_type": "{primary_type}",
  "adjusted_context": "{area_context}",
  "adjustment_reason": "Why adjustment was needed (if any)",
  "additional_evidence": ["new evidence from search"],
  "confidence_adjustment": "increased|maintained|decreased"
}}"""

        response = client.call(prompt, use_grounding=True)

        try:
            text = response.get("text", "")
            text = text.replace('```json', '').replace('```', '').strip()
            verification = json.loads(text)
        except json.JSONDecodeError:
            verification = {
                "verification_status": "UNCERTAIN",
                "adjusted_type": primary_type,
                "adjusted_context": area_context,
                "adjustment_reason": "Could not parse verification response",
                "additional_evidence": [],
                "confidence_adjustment": "maintained"
            }

        # Build final classification
        final_type = verification.get("adjusted_type", primary_type)
        final_context = verification.get("adjusted_context", area_context)
        final_confidence = state.get("confidence", "low")

        if verification.get("confidence_adjustment") == "increased":
            if final_confidence == "low":
                final_confidence = "medium"
            elif final_confidence == "medium":
                final_confidence = "high"
        elif verification.get("confidence_adjustment") == "decreased":
            if final_confidence == "high":
                final_confidence = "medium"
            elif final_confidence == "medium":
                final_confidence = "low"

        latency = int((time.time() - start_time) * 1000)

        return {
            "verification_result": verification,
            "final_classification": {
                "primary_type": final_type,
                "area_context": final_context,
                "confidence": final_confidence,
                "classification_detail": state.get("classification_detail", "UNKNOWN"),
                "reasoning": reasoning,
                "verification_status": verification.get("verification_status", "UNCERTAIN"),
                "additional_evidence": verification.get("additional_evidence", [])
            },
            "primary_type": final_type,
            "area_context": final_context,
            "confidence": final_confidence,
            "messages": [{
                "step": "verification",
                "status": verification.get("verification_status"),
                "adjusted": verification.get("adjusted_type") != primary_type
            }],
            "step_timings": {"verification": latency}
        }

    return verification_node


# =============================================================================
# GRAPH CONSTRUCTION
# =============================================================================

def build_research_graph(config: ResearchAgentConfig = None) -> Optional[StateGraph]:
    """Build the LangGraph research agent."""
    if not LANGGRAPH_AVAILABLE:
        return None

    config = config or ResearchAgentConfig()
    client = GeminiResearchClient(config)

    # Create graph
    graph = StateGraph(ResearchState)

    # Add nodes
    graph.add_node("plan", create_planning_node(client))
    graph.add_node("research", create_research_node(client))
    graph.add_node("classify", create_classification_node(client))

    if config.enable_verification:
        graph.add_node("verify", create_verification_node(client))

    # Define edges using START (LangGraph 1.x API)
    graph.add_edge(START, "plan")
    graph.add_edge("plan", "research")
    graph.add_edge("research", "classify")

    if config.enable_verification:
        graph.add_edge("classify", "verify")
        graph.add_edge("verify", END)
    else:
        graph.add_edge("classify", END)

    return graph.compile()


# =============================================================================
# RESEARCH AGENT SERVICE
# =============================================================================

@dataclass
class ResearchAgentResult:
    """Result from research agent classification."""
    primary_type: str
    area_context: str
    confidence: str
    classification_detail: str
    reasoning: str
    verification_status: str = "UNVERIFIED"
    additional_evidence: List[str] = field(default_factory=list)
    research_findings: List[Dict[str, Any]] = field(default_factory=list)
    step_timings: Dict[str, int] = field(default_factory=dict)
    total_latency_ms: int = 0
    error: Optional[str] = None


class ResearchAgentService:
    """
    LangGraph-based research agent for area classification.

    Inspired by Open Deep Research architecture:
    1. PLAN - Analyze location and determine research strategy
    2. RESEARCH - Gather information using grounded search
    3. CLASSIFY - Synthesize findings into classification
    4. VERIFY - Cross-check with additional grounded search
    """

    def __init__(self, config: ResearchAgentConfig = None):
        self.config = config or ResearchAgentConfig()
        self._graph = None
        self._cache: Dict[str, ResearchAgentResult] = {}

        if LANGGRAPH_AVAILABLE:
            self._graph = build_research_graph(self.config)

    def _cache_key(self, lat: float, lng: float) -> str:
        """Generate cache key."""
        key = f"research_agent:{round(lat, 5)}:{round(lng, 5)}"
        return hashlib.md5(key.encode()).hexdigest()

    def classify(
        self,
        latitude: float,
        longitude: float,
        places_data: Dict[str, Any],
        location_context: Dict[str, Any]
    ) -> ResearchAgentResult:
        """
        Run the research agent to classify a location.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            places_data: Data from places API including:
                - group_counts: Dict of place type counts
                - dominant_type: Most common type
                - dominance_ratio: Ratio of dominant type
                - unique_count: Number of unique places
                - ring1_places: List of places in Ring 1 (75m)
                - authority_candidates: Formatted string of candidates
            location_context: Geographic context including:
                - city: City name
                - state: State name
                - country: Country name
                - formattedAddress: Full address

        Returns:
            ResearchAgentResult with classification
        """
        start_time = time.time()
        cache_key = self._cache_key(latitude, longitude)

        # Check cache
        if cache_key in self._cache:
            result = self._cache[cache_key]
            return result

        # Fallback if LangGraph not available
        if not LANGGRAPH_AVAILABLE or not self._graph:
            return self._fallback_classify(
                latitude, longitude, places_data, location_context, start_time
            )

        try:
            # Build initial state
            initial_state: ResearchState = {
                "latitude": latitude,
                "longitude": longitude,
                "places_data": places_data,
                "location_context": location_context,
                "research_plan": "",
                "research_questions": [],
                "grounded_findings": [],
                "places_analysis": {},
                "authority_analysis": {},
                "primary_type": "",
                "area_context": "",
                "confidence": "",
                "classification_detail": "",
                "reasoning": "",
                "verification_result": {},
                "final_classification": {},
                "messages": [],
                "errors": [],
                "step_timings": {}
            }

            # Run graph
            final_state = self._graph.invoke(initial_state)

            # Build result
            total_latency = int((time.time() - start_time) * 1000)

            result = ResearchAgentResult(
                primary_type=final_state.get("primary_type", "MIXED"),
                area_context=final_state.get("area_context", "Unknown"),
                confidence=final_state.get("confidence", "low"),
                classification_detail=final_state.get("classification_detail", "UNKNOWN"),
                reasoning=final_state.get("reasoning", ""),
                verification_status=final_state.get("verification_result", {}).get(
                    "verification_status", "UNVERIFIED"
                ),
                additional_evidence=final_state.get("final_classification", {}).get(
                    "additional_evidence", []
                ),
                research_findings=final_state.get("grounded_findings", []),
                step_timings=final_state.get("step_timings", {}),
                total_latency_ms=total_latency
            )

            # Cache result
            self._cache[cache_key] = result
            return result

        except Exception as e:
            return ResearchAgentResult(
                primary_type="MIXED",
                area_context="Research Agent Error",
                confidence="low",
                classification_detail="AGENT_ERROR",
                reasoning=str(e),
                error=str(e),
                total_latency_ms=int((time.time() - start_time) * 1000)
            )

    def _fallback_classify(
        self,
        latitude: float,
        longitude: float,
        places_data: Dict[str, Any],
        location_context: Dict[str, Any],
        start_time: float
    ) -> ResearchAgentResult:
        """Fallback classification when LangGraph is not available."""
        # Use direct Gemini call for classification
        client = GeminiResearchClient(self.config)

        prompt = f"""Classify this location for DOOH advertising:

LOCATION:
- Coordinates: {latitude}, {longitude}
- City: {location_context.get('city', 'Unknown')}
- State: {location_context.get('state', 'Unknown')}
- Address: {location_context.get('formattedAddress', 'Unknown')}

PLACES DATA:
- Group distribution: {json.dumps(places_data.get('group_counts', {}), indent=2)}
- Dominant type: {places_data.get('dominant_type', 'Unknown')} ({places_data.get('dominance_ratio', 0):.1%})
- Unique places: {places_data.get('unique_count', 0)}

AUTHORITY CANDIDATES:
{places_data.get('authority_candidates', 'None')}

Classify this location. Respond in JSON:
{{
  "primary_type": "HEALTHCARE|RETAIL|TRANSIT|EDUCATION|RELIGIOUS|GOVERNMENT|ENTERTAINMENT|SPORTS|HOSPITALITY|OFFICE|FOOD_BEVERAGE|INDUSTRIAL|RESIDENTIAL|TOURISM|MIXED|MIXED_BIASED",
  "area_context": "Human-readable description",
  "confidence": "high|medium|low",
  "classification_detail": "AUTHORITY_OVERRIDE|DOMINANT|STRONG_BIAS_TOWARD_X|MODERATE_BIAS_TOWARD_X|DIVERSE",
  "reasoning": "Brief explanation"
}}"""

        response = client.call(prompt, use_grounding=True)

        try:
            text = response.get("text", "")
            text = text.replace('```json', '').replace('```', '').strip()
            result_data = json.loads(text)
        except json.JSONDecodeError:
            # Ultimate fallback
            dom_type = places_data.get("dominant_type", "MIXED")
            dom_ratio = places_data.get("dominance_ratio", 0)
            result_data = {
                "primary_type": dom_type if dom_ratio >= 0.55 else "MIXED",
                "area_context": f"{dom_type} Zone" if dom_ratio >= 0.55 else "Mixed Use Area",
                "confidence": "low",
                "classification_detail": "FALLBACK",
                "reasoning": "LangGraph unavailable, using direct LLM fallback"
            }

        return ResearchAgentResult(
            primary_type=result_data.get("primary_type", "MIXED"),
            area_context=result_data.get("area_context", "Unknown"),
            confidence=result_data.get("confidence", "low"),
            classification_detail=result_data.get("classification_detail", "UNKNOWN"),
            reasoning=result_data.get("reasoning", ""),
            verification_status="FALLBACK",
            total_latency_ms=int((time.time() - start_time) * 1000)
        )

    def clear_cache(self):
        """Clear the results cache."""
        self._cache.clear()

    @property
    def is_available(self) -> bool:
        """Check if the research agent is available."""
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        return api_key is not None


# =============================================================================
# SERVICE SINGLETON
# =============================================================================

_research_agent_service: Optional[ResearchAgentService] = None


def get_research_agent_service(config: ResearchAgentConfig = None) -> ResearchAgentService:
    """Get singleton instance of ResearchAgentService."""
    global _research_agent_service
    if _research_agent_service is None:
        _research_agent_service = ResearchAgentService(config)
    return _research_agent_service


def reset_research_agent_service():
    """Reset the singleton (for testing)."""
    global _research_agent_service
    _research_agent_service = None
