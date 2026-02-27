"""
XIGI Area Context Intelligence (Beta v2.0)

What this module does
- Derives GEO context (city/state/country + cityTier)
- Runs ring analysis:
  Ring 1 (75m): Authority detection (hard override with significance validation)
  Ring 2 (adaptive): Area classification (place-group counts -> dominance ratio)
  Ring 3 (200m): Movement context (road type, junction, pedestrian hint)
- Produces a stable contract for downstream "Profiling Agent" and XIA

Key improvements in v2.0:
- Expanded authority anchors (university, college, shopping_mall, courthouse, city_hall, amusement_park)
- Place deduplication before counting (by place_id + name similarity)
- Density-adaptive radii for Ring 2 (expands in sparse areas)
- Anchor significance validation using user_ratings_total
- Refined dominance thresholds (DOMINANT/STRONG_BIAS/MODERATE_BIAS/WEAK_BIAS)
- Weighted dwell calculation from Ring 2 group composition
- Enhanced name pattern validation for anchors
"""
from __future__ import annotations

import os
import re
import time
from typing import Dict, List, Optional, Tuple, Any
from difflib import SequenceMatcher

from django.utils import timezone

from .google_maps_utils import get_google_maps_service

# =============================================================================
# PLACE GROUP TAXONOMY
# =============================================================================

PLACE_GROUPS: Dict[str, List[str]] = {
    "TRANSIT": [
        "airport", "train_station", "railway_station", "transit_station",
        "bus_station", "bus_terminal", "subway_station", "metro_station",
        "taxi_stand", "parking", "gas_station", "light_rail_station"
    ],
    "HEALTHCARE": [
        "hospital", "doctor", "dentist", "pharmacy", "physiotherapist",
        "health", "clinic", "medical_college", "veterinary_care"
    ],
    "RELIGIOUS": [
        "hindu_temple", "temple", "mosque", "church", "synagogue",
        "place_of_worship", "gurudwara"
    ],
    "EDUCATION": [
        "school", "university", "college", "primary_school", "secondary_school",
        "library", "preschool"
    ],
    "GOVERNMENT": [
        "police", "local_government_office", "courthouse", "city_hall",
        "post_office", "embassy", "fire_station", "government_office"
    ],
    "FINANCE": ["bank", "atm", "accounting", "insurance_agency"],
    "OFFICE": ["corporate_office", "office", "lawyer", "real_estate_agency"],
    "RETAIL": [
        "shopping_mall", "department_store", "supermarket", "store",
        "clothing_store", "electronics_store", "furniture_store", "book_store",
        "convenience_store", "shoe_store", "jewelry_store", "hardware_store"
    ],
    "FOOD_BEVERAGE": [
        "restaurant", "cafe", "bar", "food", "bakery", "meal_takeaway",
        "meal_delivery", "coffee_shop"
    ],
    "ENTERTAINMENT": [
        "movie_theater", "night_club", "amusement_park", "casino",
        "bowling_alley", "theme_park"
    ],
    "SPORTS": ["stadium", "gym", "sports_complex", "arena"],
    "HOSPITALITY": ["lodging", "hotel", "motel", "resort"],
    "TOURISM": ["tourist_attraction", "museum", "zoo", "aquarium", "art_gallery"],
    "INDUSTRIAL": ["industrial_area", "storage", "warehouse", "factory"],
    "RESIDENTIAL": ["neighborhood", "premise", "subdivision", "residential_area"],
}

# =============================================================================
# AUTHORITY ANCHORS (expanded in v2.0)
# =============================================================================

AUTHORITY_TYPES: Dict[str, Dict[str, str]] = {
    # Healthcare
    "hospital": {"type": "HEALTHCARE", "context": "Hospital Zone"},
    "clinic": {"type": "HEALTHCARE", "context": "Clinic Zone"},
    "medical_college": {"type": "HEALTHCARE", "context": "Medical College Periphery"},

    # Religious
    "temple": {"type": "RELIGIOUS", "context": "Temple Surroundings"},
    "hindu_temple": {"type": "RELIGIOUS", "context": "Temple Surroundings"},
    "mosque": {"type": "RELIGIOUS", "context": "Mosque Area"},
    "church": {"type": "RELIGIOUS", "context": "Church Vicinity"},
    "gurudwara": {"type": "RELIGIOUS", "context": "Gurudwara Surroundings"},
    "synagogue": {"type": "RELIGIOUS", "context": "Synagogue Area"},

    # Transit
    "airport": {"type": "TRANSIT", "context": "Airport Zone"},
    "railway_station": {"type": "TRANSIT", "context": "Railway Station Periphery"},
    "train_station": {"type": "TRANSIT", "context": "Railway Station Periphery"},
    "metro_station": {"type": "TRANSIT", "context": "Metro Entry / Exit Zone"},
    "subway_station": {"type": "TRANSIT", "context": "Metro Entry / Exit Zone"},
    "bus_terminal": {"type": "TRANSIT", "context": "Bus Terminal Zone"},
    "bus_station": {"type": "TRANSIT", "context": "Bus Terminal Zone"},

    # Sports
    "stadium": {"type": "SPORTS", "context": "Stadium Catchment"},
    "arena": {"type": "SPORTS", "context": "Arena Zone"},

    # NEW: Education (v2.0)
    "university": {"type": "EDUCATION", "context": "University Campus Zone"},
    "college": {"type": "EDUCATION", "context": "College Campus Zone"},

    # NEW: Retail (v2.0) - major anchors only
    "shopping_mall": {"type": "RETAIL", "context": "Shopping Mall Zone"},

    # NEW: Government (v2.0)
    "courthouse": {"type": "GOVERNMENT", "context": "Courthouse / Judicial Zone"},
    "city_hall": {"type": "GOVERNMENT", "context": "City Hall / Municipal Zone"},

    # NEW: Entertainment (v2.0)
    "amusement_park": {"type": "ENTERTAINMENT", "context": "Amusement Park Zone"},
    "theme_park": {"type": "ENTERTAINMENT", "context": "Theme Park Zone"},
}

# =============================================================================
# ANCHOR SIGNIFICANCE THRESHOLDS (v2.0)
# Minimum user_ratings_total required to be considered a significant anchor
# =============================================================================

AUTHORITY_SIGNIFICANCE: Dict[str, int] = {
    "hospital": 100,
    "clinic": 30,
    "medical_college": 50,
    "university": 150,
    "college": 75,
    "shopping_mall": 300,
    "airport": 200,              # Lowered from 500 - airports are always major
    "railway_station": 50,       # Lowered from 150 - Indian railway stations often have fewer reviews
    "train_station": 50,         # Lowered from 150
    "metro_station": 50,         # Lowered from 100
    "subway_station": 50,        # Lowered from 100
    "bus_terminal": 40,          # Lowered from 75
    "bus_station": 30,           # Lowered from 50
    "stadium": 200,
    "arena": 200,
    "amusement_park": 200,
    "theme_park": 200,
    "courthouse": 30,
    "city_hall": 30,
    "temple": 50,
    "hindu_temple": 50,
    "mosque": 50,
    "church": 30,
    "gurudwara": 50,
    "synagogue": 30,
    "default": 25,
}

# =============================================================================
# ANCHOR NAME PATTERNS (v2.0)
# Keywords that help validate anchor type classification
# =============================================================================

ANCHOR_NAME_PATTERNS: Dict[str, List[str]] = {
    "hospital": ["hospital", "medical center", "medical centre", "general hospital", "city hospital"],
    "clinic": ["clinic", "healthcare", "health center", "health centre", "dispensary"],
    "university": ["university", "institute of technology", "iit", "nit", "iiit", "bits"],
    "college": ["college", "polytechnic", "institute"],
    "shopping_mall": ["mall", "plaza", "galleria", "centre", "center", "city center", "emporium"],
    "airport": ["airport", "aerodrome", "international airport", "domestic airport"],
    "railway_station": ["railway", "station", "junction", "terminus", "rail"],
    "train_station": ["railway", "station", "junction", "terminus", "rail"],
    "metro_station": ["metro", "underground", "subway", "tube"],
    "bus_terminal": ["bus", "terminal", "depot", "stand"],
    "bus_station": ["bus", "terminal", "depot", "stand"],
    "stadium": ["stadium", "sports complex", "arena", "ground"],
    "courthouse": ["court", "judiciary", "high court", "district court"],
    "city_hall": ["city hall", "municipal", "corporation", "nagar palika", "nigam"],
    "temple": ["temple", "mandir", "kovil", "devasthanam"],
    "mosque": ["mosque", "masjid", "jama masjid", "dargah"],
    "church": ["church", "cathedral", "chapel", "basilica"],
}

# =============================================================================
# CITY TIER MAPPING
# =============================================================================

CITY_TIER_MAPPING: Dict[str, str] = {
    # Tier 1 - Metros (including common Google Maps variants)
    "Mumbai": "TIER_1", "Delhi": "TIER_1", "Bangalore": "TIER_1",
    "Bengaluru": "TIER_1", "Bangalore Division": "TIER_1",
    "Chennai": "TIER_1", "Chennai District": "TIER_1",
    "Kolkata": "TIER_1", "Calcutta": "TIER_1",
    "Hyderabad": "TIER_1", "Hyderabad District": "TIER_1",
    "Pune": "TIER_1", "Pune District": "TIER_1",
    "Ahmedabad": "TIER_1", "Ahmedabad District": "TIER_1",
    "New Delhi": "TIER_1", "Central Delhi": "TIER_1",
    # Tier 2 - Large cities
    "Jaipur": "TIER_2", "Surat": "TIER_2", "Lucknow": "TIER_2",
    "Kanpur": "TIER_2", "Nagpur": "TIER_2", "Indore": "TIER_2",
    "Thane": "TIER_2", "Bhopal": "TIER_2", "Visakhapatnam": "TIER_2",
    "Patna": "TIER_2", "Vadodara": "TIER_2", "Ghaziabad": "TIER_2",
    "Coimbatore": "TIER_2", "Kochi": "TIER_2", "Chandigarh": "TIER_2",
    "Nashik": "TIER_2", "Agra": "TIER_2", "Varanasi": "TIER_2",
    "Mysore": "TIER_2", "Mysuru": "TIER_2",
}

# =============================================================================
# CONFIGURATION CONSTANTS
# =============================================================================

GENERIC_TYPES = {"establishment", "point_of_interest", "place", "premise"}

GROUP_PRIORITY: List[str] = [
    "TRANSIT", "HEALTHCARE", "RELIGIOUS", "EDUCATION", "GOVERNMENT", "FINANCE",
    "OFFICE", "RETAIL", "FOOD_BEVERAGE", "ENTERTAINMENT", "SPORTS", "HOSPITALITY",
    "TOURISM", "INDUSTRIAL", "RESIDENTIAL",
]

# Dominance thresholds for classification (v2.0)
DOMINANCE_THRESHOLDS = {
    "DOMINANT": 0.55,           # Clear single-type area (lowered from 0.60)
    "STRONG_BIAS": 0.40,        # Strong bias toward one type
    "MODERATE_BIAS": 0.28,      # Noticeable lean
    "WEAK_BIAS": 0.18,          # Slight tendency
}

# Ring 2 adaptive radius configuration (v2.0)
RING2_CONFIG = {
    "base_radius": 500,
    "min_radius": 300,
    "max_radius": 1500,
    "min_places_threshold": 15,
    "expansion_step": 300,
    "max_expansions": 3,
}

# Ring 1.5 extended authority search for DOOH screens (v2.2)
# DOOH screens are placed at junctions/intersections, often 200-800m from landmarks
# Fixed: Added bus_station/transit_station for major bus terminals like Kempegowda
RING1_5_CONFIG = {
    "radius": 750,  # Extended radius for major anchor detection
    "search_radii": [200, 400, 750],  # Tiered search - transit more visible at smaller radii
    "enabled": True,
    # Only detect MAJOR anchors with high significance
    "major_thresholds": {
        "hospital": 500,      # Major hospitals only
        "airport": 100,       # Any airport (always major)
        "train_station": 200, # Railway stations (lowered - often have typos in types)
        "transit_station": 150,  # Major transit hubs (bus/rail)
        "bus_station": 200,   # Major bus terminals
        "metro_station": 150, # Metro stations
        "subway_station": 150,
        "shopping_mall": 500, # Major malls
        "stadium": 300,       # Major stadiums
        "university": 500,    # Major universities
    },
    # Generic name patterns for transit hubs (Google API often has incomplete types)
    # NOTE: Only generic patterns - no location-specific names for generalization
    "transit_name_patterns": [
        "railway", "junction", "central", "terminus", "terminal",
        "bus stand", "bus terminal", "city station", "main station"
    ],
    # Context labels for extended detection (different from authority override)
    "context_labels": {
        "hospital": "Near Major Hospital Zone",
        "airport": "Near Airport Zone",
        "train_station": "Near Railway Station Zone",
        "transit_station": "Near Major Transit Hub",
        "bus_station": "Near Bus Terminal Zone",
        "metro_station": "Near Metro Station Zone",
        "subway_station": "Near Metro Station Zone",
        "shopping_mall": "Near Shopping Mall Zone",
        "stadium": "Near Stadium Zone",
        "university": "Near University Zone",
    },
}

# Dwell time weights by place group (v2.0)
DWELL_WEIGHTS: Dict[str, float] = {
    "HEALTHCARE": 0.90,
    "RELIGIOUS": 0.85,
    "EDUCATION": 0.80,
    "ENTERTAINMENT": 0.75,
    "FOOD_BEVERAGE": 0.70,
    "TOURISM": 0.70,
    "RETAIL": 0.60,
    "SPORTS": 0.55,
    "HOSPITALITY": 0.50,
    "FINANCE": 0.40,
    "OFFICE": 0.35,
    "GOVERNMENT": 0.40,
    "TRANSIT": 0.25,
    "INDUSTRIAL": 0.20,
    "RESIDENTIAL": 0.15,
}

MOVEMENT_DWELL_MODIFIER: Dict[str, float] = {
    "PASS_BY": -0.25,
    "STOP_AND_GO": 0.0,
    "SLOW_FLOW": 0.10,
    "PEDESTRIAN": 0.20,
}


# =============================================================================
# PLACE TYPE NORMALIZER
# =============================================================================

class PlaceTypeNormalizer:
    """Normalizes place types into groups with deduplication support."""

    def __init__(self):
        self._type_to_group: Dict[str, str] = {}
        for group, types_list in PLACE_GROUPS.items():
            for t in types_list:
                self._type_to_group[t] = group

    def _group_for_place(self, place_types: List[str]) -> Optional[str]:
        """Get the highest-priority group for a place based on its types."""
        # Filter out generic types and find recognized groups
        groups = set()
        for t in place_types:
            if t in GENERIC_TYPES:
                continue
            g = self._type_to_group.get(t)
            if g:
                groups.add(g)

        if not groups:
            return None

        # Pick highest priority group
        for g in GROUP_PRIORITY:
            if g in groups:
                return g
        return None

    @staticmethod
    def _normalize_name(name: str) -> str:
        """Normalize place name for deduplication comparison."""
        if not name:
            return ""
        normalized = name.lower().strip()
        normalized = re.sub(r'[^\w\s]', '', normalized)
        # Remove common suffixes
        for suffix in [' pvt ltd', ' private limited', ' limited', ' ltd', ' inc', ' llc']:
            if normalized.endswith(suffix):
                normalized = normalized[:-len(suffix)]
        return normalized.strip()

    @staticmethod
    def _coords_key(lat: float, lng: float, precision: int = 5) -> str:
        """Create coordinate key with configurable precision."""
        return f"{round(lat, precision)}_{round(lng, precision)}"

    def dedupe_places(self, places: List[Dict[str, Any]],
                      coord_precision: int = 5,
                      name_similarity_threshold: float = 0.85) -> List[Dict[str, Any]]:
        """
        Remove duplicate places based on place_id, normalized name + coordinates.

        Strategy:
        1. Primary: Dedupe by place_id (Google's unique identifier)
        2. Secondary: Dedupe by coordinates + normalized name similarity
        """
        seen_ids: set = set()
        seen_coords: Dict[str, set] = {}  # coord_key -> set of normalized names
        deduped: List[Dict[str, Any]] = []

        for place in places:
            # Primary: Check place_id
            place_id = place.get("place_id")
            if place_id:
                if place_id in seen_ids:
                    continue
                seen_ids.add(place_id)

            # Secondary: Check coordinates + name
            geometry = place.get("geometry", {})
            location = geometry.get("location", {})
            lat = location.get("lat", 0)
            lng = location.get("lng", 0)

            coord_key = self._coords_key(lat, lng, coord_precision)
            name = self._normalize_name(place.get("name", ""))

            # Skip if no meaningful identifier
            if not name and (lat == 0 and lng == 0) and not place_id:
                continue

            if coord_key not in seen_coords:
                seen_coords[coord_key] = set()

            # Check for similar name at same location
            is_duplicate = False
            for existing_name in seen_coords[coord_key]:
                if name and existing_name:
                    similarity = SequenceMatcher(None, name, existing_name).ratio()
                    if similarity >= name_similarity_threshold:
                        is_duplicate = True
                        break

            if is_duplicate:
                continue

            if name:
                seen_coords[coord_key].add(name)
            deduped.append(place)

        return deduped

    def count_by_group(self, places: List[Dict[str, Any]],
                       dedupe: bool = True) -> Tuple[Dict[str, int], int]:
        """
        Count places by group, optionally deduplicating first.

        Returns:
            tuple: (group_counts, unique_places_count)
        """
        if dedupe:
            places = self.dedupe_places(places)

        counts: Dict[str, int] = {}
        for place in places:
            types = place.get("types", []) or []
            g = self._group_for_place(types)
            if not g:
                continue
            counts[g] = counts.get(g, 0) + 1

        return counts, len(places)


# =============================================================================
# AUTHORITY DETECTOR (v2.0 with significance validation)
# =============================================================================

class AuthorityDetector:
    """Detects authority-level places with significance validation."""

    @staticmethod
    def _validate_anchor_name(place: Dict[str, Any], authority_key: str) -> bool:
        """Validate anchor by checking name patterns."""
        name = place.get("name", "").lower()
        patterns = ANCHOR_NAME_PATTERNS.get(authority_key, [])

        if not patterns:
            return True  # No pattern validation required

        return any(pattern in name for pattern in patterns)

    @staticmethod
    def _is_medical_institute(place: Dict[str, Any]) -> bool:
        """
        Check if a place is a medical institute (university/college WITH health/hospital).

        Medical institutes like AIIMS have 'university' type but are fundamentally
        healthcare facilities and should be classified as HEALTHCARE.
        """
        types = set(place.get("types", []) or [])
        name = (place.get("name", "") or "").lower()

        education_types = {"university", "college"}
        health_types = {"health", "hospital", "doctor"}

        has_education = bool(types.intersection(education_types))
        has_health = bool(types.intersection(health_types))

        # Name patterns that indicate medical institute
        medical_name_patterns = [
            "medical", "aiims", "medicine", "hospital", "health science",
            "nursing", "dental college", "medical college"
        ]
        has_medical_name = any(p in name for p in medical_name_patterns)

        return has_education and (has_health or has_medical_name)

    @staticmethod
    def detect_authority(
        places: List[Dict[str, Any]],
        validate_significance: bool = True,
        validate_name: bool = True
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Detect authority-level places within Ring 1.

        Args:
            places: List of places from API
            validate_significance: If True, require minimum user_ratings_total
            validate_name: If True, validate place name matches expected patterns

        Returns:
            tuple: (authority_info, rejected_info) - rejected_info shows why validation failed
        """
        rejected = None

        # PRIORITY 1: Check for medical institutes first (AIIMS, medical colleges)
        # These have 'university' type but should be classified as HEALTHCARE
        for place in places or []:
            if AuthorityDetector._is_medical_institute(place):
                ratings_total = place.get("user_ratings_total", 0) or 0
                threshold = AUTHORITY_SIGNIFICANCE.get("hospital", 100)

                if ratings_total >= threshold:
                    return ({
                        "type": "HEALTHCARE",
                        "context": "Medical Institute Zone",
                        "detected_from": "medical_institute",
                        "place_name": place.get("name", "Unknown"),
                        "user_ratings_total": ratings_total,
                        "significance_validated": True,
                        "name_validated": True,
                    }, None)

        # PRIORITY 2: Check for hospitals before other authority types
        # Hospitals should take precedence over education/other types
        for place in places or []:
            types = place.get("types", []) or []
            if "hospital" in types:
                ratings_total = place.get("user_ratings_total", 0) or 0
                threshold = AUTHORITY_SIGNIFICANCE.get("hospital", 100)

                if ratings_total >= threshold:
                    return ({
                        "type": "HEALTHCARE",
                        "context": "Hospital Entrance Zone",
                        "detected_from": "hospital",
                        "place_name": place.get("name", "Unknown"),
                        "user_ratings_total": ratings_total,
                        "significance_validated": True,
                        "name_validated": True,
                    }, None)

        # PRIORITY 3: Standard authority detection
        for place in places or []:
            types = place.get("types", []) or []

            for authority_key, authority_info in AUTHORITY_TYPES.items():
                if authority_key not in types:
                    continue

                ratings_total = place.get("user_ratings_total", 0) or 0
                threshold = AUTHORITY_SIGNIFICANCE.get(
                    authority_key,
                    AUTHORITY_SIGNIFICANCE["default"]
                )

                # Significance validation
                if validate_significance and ratings_total < threshold:
                    if not rejected or ratings_total > (rejected.get("ratings", 0) or 0):
                        rejected = {
                            "type": authority_key,
                            "place_name": place.get("name", "Unknown"),
                            "ratings": ratings_total,
                            "threshold": threshold,
                            "reason": "BELOW_SIGNIFICANCE_THRESHOLD"
                        }
                    continue

                # Name pattern validation (optional, for extra confidence)
                name_valid = AuthorityDetector._validate_anchor_name(place, authority_key)

                # For low-ratings places, require name validation
                if ratings_total < threshold * 2 and validate_name and not name_valid:
                    if not rejected:
                        rejected = {
                            "type": authority_key,
                            "place_name": place.get("name", "Unknown"),
                            "ratings": ratings_total,
                            "reason": "NAME_PATTERN_MISMATCH"
                        }
                    continue

                return ({
                    "type": authority_info["type"],
                    "context": authority_info["context"],
                    "detected_from": authority_key,
                    "place_name": place.get("name", "Unknown"),
                    "user_ratings_total": ratings_total,
                    "significance_validated": validate_significance,
                    "name_validated": name_valid,
                }, None)

        return (None, rejected)

    @staticmethod
    def detect_extended_authority(
        places: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Extended authority detection for DOOH screens (Ring 1.5).

        DOOH screens are typically placed at junctions/intersections with foot traffic,
        often 200-800m away from major landmarks. This method searches for MAJOR
        authority anchors only (with higher significance thresholds).

        v2.2 Improvements:
        - Added bus_station, transit_station types for major bus terminals
        - Added name-based detection for Indian transit hubs (Kempegowda, Majestic, etc.)
        - Lowered train_station threshold (Google often misses railway type)

        Args:
            places: List of places from extended radius search (750m)

        Returns:
            Extended authority info if found, None otherwise
        """
        config = RING1_5_CONFIG
        if not config.get("enabled", False):
            return None

        major_thresholds = config["major_thresholds"]
        context_labels = config["context_labels"]
        transit_name_patterns = config.get("transit_name_patterns", [])

        # Authority type mapping
        type_to_category = {
            "hospital": "HEALTHCARE",
            "airport": "TRANSIT",
            "train_station": "TRANSIT",
            "transit_station": "TRANSIT",
            "bus_station": "TRANSIT",
            "metro_station": "TRANSIT",
            "subway_station": "TRANSIT",
            "shopping_mall": "RETAIL",
            "stadium": "SPORTS",
            "university": "EDUCATION",
        }

        best_anchor = None
        best_score = 0

        for place in places or []:
            types = set(place.get("types", []) or [])
            ratings = place.get("user_ratings_total", 0) or 0
            name = place.get("name", "Unknown")
            name_lower = name.lower()

            # Check 1: Standard type-based detection
            for anchor_type, threshold in major_thresholds.items():
                if anchor_type not in types:
                    continue

                # Must meet the major threshold
                if ratings < threshold:
                    continue

                # Score based on ratings (higher = more significant)
                score = ratings

                if score > best_score:
                    best_score = score
                    best_anchor = {
                        "type": type_to_category.get(anchor_type, "MIXED"),
                        "context": context_labels.get(anchor_type, f"Near {anchor_type.replace('_', ' ').title()} Zone"),
                        "detected_from": anchor_type,
                        "place_name": name,
                        "user_ratings_total": ratings,
                        "detection_mode": "EXTENDED_RING1_5",
                        "significance_validated": True,
                    }

            # Check 2: Name-based transit detection (for Indian stations with incomplete types)
            # Only if no better anchor found and place has transit_station or bus_station type
            if ratings >= 150 and types.intersection({"transit_station", "bus_station"}):
                # Check for transit name patterns
                if any(pattern in name_lower for pattern in transit_name_patterns):
                    score = ratings + 100  # Bonus for name match

                    if score > best_score:
                        best_score = score
                        best_anchor = {
                            "type": "TRANSIT",
                            "context": "Near Major Transit Hub",
                            "detected_from": "transit_name_pattern",
                            "place_name": name,
                            "user_ratings_total": ratings,
                            "detection_mode": "EXTENDED_RING1_5_NAME",
                            "significance_validated": True,
                        }

        return best_anchor


# =============================================================================
# DOMINANCE CALCULATOR
# =============================================================================

class DominanceCalculator:
    """Calculates dominance ratio and identifies dominant groups."""

    @staticmethod
    def calculate(group_counts: Dict[str, int]) -> Tuple[Optional[str], float, Optional[str]]:
        """
        Calculate dominance ratio.

        Returns:
            tuple: (dominant_type, dominance_ratio, second_type)
        """
        if not group_counts:
            return (None, 0.0, None)

        total = sum(group_counts.values())
        if total <= 0:
            return (None, 0.0, None)

        sorted_groups = sorted(group_counts.items(), key=lambda x: -x[1])
        dominant_type, dominant_count = sorted_groups[0]
        second_type = sorted_groups[1][0] if len(sorted_groups) > 1 else None

        return (dominant_type, dominant_count / total, second_type)


# =============================================================================
# PRIMARY TYPE RESOLVER (v2.0 with refined thresholds)
# =============================================================================

class PrimaryTypeResolver:
    """Resolves primary area type with granular classification."""

    @staticmethod
    def resolve(
        dominance_ratio: float,
        dominant_type: Optional[str],
        second_type: Optional[str] = None,
        group_counts: Optional[Dict[str, int]] = None
    ) -> Tuple[str, str]:
        """
        Resolve primary type with granular classification.

        Returns:
            tuple: (primary_type, classification_detail)
        """
        if dominance_ratio >= DOMINANCE_THRESHOLDS["DOMINANT"] and dominant_type:
            return (dominant_type, "DOMINANT")

        if dominance_ratio >= DOMINANCE_THRESHOLDS["STRONG_BIAS"] and dominant_type:
            return ("MIXED_BIASED", f"STRONG_BIAS_TOWARD_{dominant_type}")

        if dominance_ratio >= DOMINANCE_THRESHOLDS["MODERATE_BIAS"] and dominant_type:
            return ("MIXED_BIASED", f"MODERATE_BIAS_TOWARD_{dominant_type}")

        if dominance_ratio >= DOMINANCE_THRESHOLDS["WEAK_BIAS"] and dominant_type:
            return ("MIXED", f"WEAK_BIAS_TOWARD_{dominant_type}")

        # Check for co-dominance
        if group_counts and second_type:
            total = sum(group_counts.values())
            if total > 0:
                first_ratio = group_counts.get(dominant_type, 0) / total
                second_ratio = group_counts.get(second_type, 0) / total

                if abs(first_ratio - second_ratio) < 0.08:
                    return ("MIXED", f"CO_DOMINANT_{dominant_type}_{second_type}")

        return ("MIXED", "DIVERSE")


# =============================================================================
# AREA CONTEXT DERIVER
# =============================================================================

class AreaContextDeriver:
    """Derives human-readable context descriptions."""

    CONTEXT_MAP: Dict[str, str] = {
        "HEALTHCARE": "Healthcare Catchment",
        "RELIGIOUS": "Religious Catchment",
        "TRANSIT": "Transit Corridor",
        "EDUCATION": "Education Hub",
        "GOVERNMENT": "Civic / Government Zone",
        "FINANCE": "Banking / Finance Zone",
        "ENTERTAINMENT": "Entertainment Zone",
        "SPORTS": "Sports Zone",
        "HOSPITALITY": "Hotel / Hospitality Zone",
        "RETAIL": "Retail Zone",
        "OFFICE": "Office Cluster",
        "RESIDENTIAL": "Residential Zone",
        "INDUSTRIAL": "Industrial Zone",
        "FOOD_BEVERAGE": "Food & Dining Cluster",
        "TOURISM": "Tourist Zone",
        "MIXED": "High-Density Mixed Use",
        "MIXED_BIASED": "High-Density Mixed Use",
    }

    @staticmethod
    def derive(
        primary_type: str,
        authority_context: Optional[str] = None,
        classification_detail: Optional[str] = None,
        dominant_type: Optional[str] = None
    ) -> str:
        """Derive human-readable context description."""
        if authority_context:
            return authority_context

        # Handle MIXED_BIASED with bias info
        if primary_type == "MIXED_BIASED" and classification_detail:
            if "STRONG_BIAS_TOWARD_" in classification_detail:
                biased_type = classification_detail.replace("STRONG_BIAS_TOWARD_", "")
                base_context = AreaContextDeriver.CONTEXT_MAP.get(biased_type, "Mixed Use")
                return f"Mixed Use (primarily {base_context})"
            if "MODERATE_BIAS_TOWARD_" in classification_detail:
                biased_type = classification_detail.replace("MODERATE_BIAS_TOWARD_", "")
                base_context = AreaContextDeriver.CONTEXT_MAP.get(biased_type, "Mixed Use")
                return f"Mixed Use (leaning {base_context})"

        if primary_type == "MIXED" and classification_detail:
            if "WEAK_BIAS_TOWARD_" in classification_detail:
                biased_type = classification_detail.replace("WEAK_BIAS_TOWARD_", "")
                base_context = AreaContextDeriver.CONTEXT_MAP.get(biased_type, "Mixed Use")
                return f"Diverse Mixed Use (slight {base_context})"
            if "CO_DOMINANT_" in classification_detail:
                return "Diverse Commercial Hub"

        return AreaContextDeriver.CONTEXT_MAP.get(primary_type, "High-Density Mixed Use")


# =============================================================================
# MOVEMENT ANALYZER
# =============================================================================

class MovementAnalyzer:
    """Analyzes movement patterns based on road and place context."""

    @staticmethod
    def derive_movement_type(
        road_type: Optional[str],
        near_junction: bool,
        pedestrian_friendly: bool
    ) -> str:
        """Derive movement type from road context."""
        if road_type == "highway":
            return "PASS_BY"
        if near_junction:
            return "STOP_AND_GO"
        if pedestrian_friendly:
            return "PEDESTRIAN"
        return "SLOW_FLOW"

    @staticmethod
    def derive_movement_context(
        road_type: Optional[str],
        near_junction: bool,
        pedestrian_friendly: bool
    ) -> str:
        """Derive human-readable movement context."""
        if road_type == "highway":
            return "High-Speed Corridor"
        if near_junction:
            return "Junction / Signal Zone"
        if pedestrian_friendly:
            return "Walkable Area"
        return "Internal Connector Road"


# =============================================================================
# DWELL CATEGORY DERIVER (v2.0 with weighted calculation)
# =============================================================================

class DwellCategoryDeriver:
    """Derives dwell category with weighted inference from place groups."""

    @staticmethod
    def derive(
        primary_type: str,
        movement_type: str,
        group_counts: Optional[Dict[str, int]] = None,
        authority_type: Optional[str] = None
    ) -> Tuple[str, float, float]:
        """
        Derive dwell category with weighted inference.

        Returns:
            tuple: (dwell_category, confidence_score, dwell_score)
        """
        # Authority override: specific anchors have known dwell patterns
        if authority_type:
            authority_weight = DWELL_WEIGHTS.get(
                AUTHORITY_TYPES.get(authority_type, {}).get("type", ""),
                0.5
            )
            if authority_weight >= 0.75:
                return ("LONG_WAIT", 0.95, authority_weight)
            elif authority_weight >= 0.50:
                return ("MEDIUM_WAIT", 0.90, authority_weight)
            else:
                return ("SHORT_WAIT", 0.85, authority_weight)

        # Weighted calculation from Ring 2 groups
        if group_counts and sum(group_counts.values()) > 0:
            total = sum(group_counts.values())
            weighted_score = 0.0

            for group, count in group_counts.items():
                weight = DWELL_WEIGHTS.get(group, 0.5)
                weighted_score += (count / total) * weight

            # Apply movement modifier
            movement_mod = MOVEMENT_DWELL_MODIFIER.get(movement_type, 0.0)
            weighted_score = max(0.0, min(1.0, weighted_score + movement_mod))

            # Confidence based on sample size
            confidence = min(1.0, total / 25)
        else:
            # Fallback to primary type only
            weighted_score = DWELL_WEIGHTS.get(primary_type, 0.5)
            movement_mod = MOVEMENT_DWELL_MODIFIER.get(movement_type, 0.0)
            weighted_score = max(0.0, min(1.0, weighted_score + movement_mod))
            confidence = 0.5

        # Map score to category
        if weighted_score >= 0.65:
            category = "LONG_WAIT"
        elif weighted_score >= 0.35:
            category = "MEDIUM_WAIT"
        else:
            category = "SHORT_WAIT"

        return (category, round(confidence, 2), round(weighted_score, 3))

    @staticmethod
    def derive_simple(primary_type: str, movement_type: str) -> str:
        """Legacy simple derivation for backward compatibility."""
        if primary_type in {"HEALTHCARE", "RELIGIOUS", "EDUCATION"}:
            return "LONG_WAIT"
        if movement_type == "PASS_BY":
            return "SHORT_WAIT"
        return "MEDIUM_WAIT"


# =============================================================================
# AREA CONTEXT SERVICE (Main orchestrator)
# =============================================================================

class AreaContextService:
    """Main service for analyzing screen location context."""

    def __init__(self):
        self.google_maps = get_google_maps_service()
        self.normalizer = PlaceTypeNormalizer()
        self.authority_detector = AuthorityDetector()
        self.dominance = DominanceCalculator()
        self.type_resolver = PrimaryTypeResolver()
        self.context_deriver = AreaContextDeriver()
        self.movement = MovementAnalyzer()
        self.dwell = DwellCategoryDeriver()

    def _adaptive_ring2_search(
        self,
        latitude: float,
        longitude: float,
        city_tier: str,
        reasoning: List[str]
    ) -> Tuple[List[Dict[str, Any]], int, bool, int]:
        """
        Perform Ring 2 search with adaptive radius expansion for sparse areas.

        Returns:
            tuple: (places, network_calls, all_cached, final_radius)
        """
        config = RING2_CONFIG

        # Adjust base radius by city tier
        tier_multiplier = {"TIER_1": 0.9, "TIER_2": 1.0, "TIER_3": 1.3}.get(city_tier, 1.0)
        base_radius = int(config["base_radius"] * tier_multiplier)
        radius = base_radius

        total_network_calls = 0
        all_cached = True
        places: List[Dict[str, Any]] = []

        for attempt in range(config["max_expansions"] + 1):
            places, meta = self.google_maps.places_nearby_all(
                latitude, longitude,
                radius=radius,
                max_results=60
            )
            total_network_calls += meta["network_calls"]
            all_cached = all_cached and meta["cached"]

            # Deduplicate before checking threshold
            unique_places = self.normalizer.dedupe_places(places)

            if len(unique_places) >= config["min_places_threshold"]:
                reasoning.append(
                    f"Ring 2: Radius {radius}m yielded {len(places)} places "
                    f"({len(unique_places)} unique) - sufficient"
                )
                break

            if attempt < config["max_expansions"]:
                old_radius = radius
                radius = min(radius + config["expansion_step"], config["max_radius"])
                reasoning.append(
                    f"Ring 2: Radius {old_radius}m yielded only {len(unique_places)} "
                    f"unique places, expanding to {radius}m"
                )
            else:
                reasoning.append(
                    f"Ring 2: Max radius {radius}m reached with {len(unique_places)} "
                    f"unique places (sparse area)"
                )

        return places, total_network_calls, all_cached, radius

    def analyze_screen_location(
        self,
        latitude: float,
        longitude: float,
        indoor: bool = False,
        height_from_ground_ft: float = 0.0
    ) -> Dict[str, Any]:
        """
        Analyze screen location and return comprehensive profile.

        Args:
            latitude: Screen latitude
            longitude: Screen longitude
            indoor: Whether screen is indoor
            height_from_ground_ft: Screen height from ground

        Returns:
            Complete area context profile
        """
        start = time.time()
        reasoning: List[str] = []
        warnings: List[str] = []
        net_calls = 0
        all_cached = True

        api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
        if not api_key:
            raise Exception("GOOGLE_MAPS_API_KEY not configured")
        if not self.google_maps.client:
            raise Exception("Google Maps client not initialized (check key)")

        # Step 1: Geographic context
        reasoning.append("Step 1: Fetching geographic context.")
        geo_full, meta_geo = self.google_maps.reverse_geocode_full(latitude, longitude)
        net_calls += meta_geo["network_calls"]
        all_cached = all_cached and meta_geo["cached"]

        geo_context = {
            "city": geo_full.get("city", "Unknown"),
            "state": geo_full.get("state", "Unknown"),
            "country": geo_full.get("country", "Unknown"),
            "cityTier": geo_full.get("cityTier", "TIER_3"),
            "formattedAddress": geo_full.get("formattedAddress", ""),
        }
        reasoning.append(
            f"Geo context: {geo_context['city']}, {geo_context['state']} "
            f"({geo_context['cityTier']})"
        )

        # Step 2: Ring 1 - Authority detection
        reasoning.append("Step 2: Analyzing Ring 1 (75m - authority detection).")
        ring1_places, meta_r1 = self.google_maps.places_nearby_all(
            latitude, longitude, radius=75, max_results=20
        )
        net_calls += meta_r1["network_calls"]
        all_cached = all_cached and meta_r1["cached"]

        # Deduplicate Ring 1
        ring1_unique = self.normalizer.dedupe_places(ring1_places)
        reasoning.append(f"Ring 1: Found {len(ring1_places)} places ({len(ring1_unique)} unique)")
        if ring1_unique:
            top_places = [p.get('name') for p in ring1_unique[:3]]
            reasoning.append(f"Top places: {', '.join(top_places)}")

        # Detect authority with significance validation
        authority, rejected_authority = self.authority_detector.detect_authority(
            ring1_unique,
            validate_significance=True,
            validate_name=True
        )

        ring_analysis: Dict[str, Any] = {
            "ring1": {
                "radius": 75,
                "placesFound": len(ring1_places),
                "uniquePlaces": len(ring1_unique),
                "keyVenues": [authority["detected_from"]] if authority else [],
            }
        }
        
        if not authority:
             reasoning.append("Ring 1: No high-priority authority anchor detected (hospital, train station, etc.)")

        # Track rejected authority for debugging
        if rejected_authority:
            ring_analysis["ring1"]["rejectedAuthority"] = rejected_authority
            reasoning.append(
                f"Ring 1: Potential authority '{rejected_authority.get('place_name')}' "
                f"({rejected_authority.get('type')}) rejected - "
                f"{rejected_authority.get('reason')}"
            )

        # Step 2.5: Ring 1.5 - Extended authority search for DOOH screens
        # Only run if Ring 1 didn't find an authority
        # v2.2: Use tiered radii (200m, 400m, 750m) because transit is often crowded out at larger radii
        extended_authority = None
        if not authority and RING1_5_CONFIG.get("enabled", False):
            search_radii = RING1_5_CONFIG.get("search_radii", [RING1_5_CONFIG["radius"]])
            reasoning.append(f"Step 2.5: Analyzing Ring 1.5 (tiered search: {search_radii}m - extended DOOH authority search).")

            # Collect places from all radii, prioritizing smaller radii (where transit is more visible)
            all_ring1_5_places: List[Dict[str, Any]] = []
            seen_place_ids: set = set()

            for radius in search_radii:
                ring1_5_places, meta_r1_5 = self.google_maps.places_nearby_all(
                    latitude, longitude, radius=radius, max_results=60
                )
                net_calls += meta_r1_5["network_calls"]
                all_cached = all_cached and meta_r1_5["cached"]

                # Add unique places (dedupe by place_id)
                for place in ring1_5_places:
                    place_id = place.get("place_id")
                    if place_id and place_id not in seen_place_ids:
                        seen_place_ids.add(place_id)
                        all_ring1_5_places.append(place)

                # Try to detect authority at this radius
                extended_authority = self.authority_detector.detect_extended_authority(all_ring1_5_places)
                if extended_authority:
                    reasoning.append(f"Ring 1.5: Found authority at {radius}m radius")
                    break
                else:
                    reasoning.append(f"Ring 1.5: No major anchor found at {radius}m radius")

            reasoning.append(f"Ring 1.5: Searched {len(all_ring1_5_places)} unique places across tiers")

            if extended_authority:
                reasoning.append(
                    f"Ring 1.5: Major anchor detected - {extended_authority['place_name']} "
                    f"({extended_authority['detected_from']}, {extended_authority['user_ratings_total']} reviews)"
                )
                ring_analysis["ring1_5"] = {
                    "radius": RING1_5_CONFIG["radius"],
                    "placesFound": len(ring1_5_places),
                    "majorAnchor": {
                        "name": extended_authority["place_name"],
                        "type": extended_authority["detected_from"],
                        "ratings": extended_authority["user_ratings_total"],
                    }
                }

        # Initialize variables
        group_counts: Dict[str, int] = {}
        dominant_type: Optional[str] = None
        second_type: Optional[str] = None
        dominance_ratio: float = 0.0
        classification_detail: str = ""
        ring2_radius: int = 500

        if authority:
            # Authority override - skip Ring 2 classification
            reasoning.append(
                f"Authority detected: {authority['detected_from']} "
                f"({authority.get('place_name', 'Unknown')}) within 75m - "
                f"{authority.get('user_ratings_total', 0)} reviews"
            )
            reasoning.append("Ring 2 skipped due to authority override")

            primary_type = authority["type"]
            dominance_ratio = 1.0
            classification_detail = "AUTHORITY_OVERRIDE"
            area_context = self.context_deriver.derive(
                primary_type,
                authority_context=authority["context"]
            )
            area_confidence = "high"

            area_block: Dict[str, Any] = {
                "primaryType": primary_type,
                "context": area_context,
                "confidence": area_confidence,
                "classificationDetail": classification_detail,
                "dominantGroup": primary_type,
            }

            ring_analysis["ring2"] = {
                "radius": ring2_radius,
                "baseRadius": RING2_CONFIG["base_radius"],
                "expanded": False,
                "placesFound": 0,
                "uniquePlaces": 0,
                "placeGroups": {},
                "skipped": True,
                "reason": "AUTHORITY_OVERRIDE",
            }
        else:
            # Step 3: Ring 2 - Area classification with adaptive radius
            reasoning.append("Step 3: Analyzing Ring 2 (area classification).")

            ring2_places, r2_calls, r2_cached, ring2_radius = self._adaptive_ring2_search(
                latitude, longitude,
                geo_context["cityTier"],
                reasoning
            )
            net_calls += r2_calls
            all_cached = all_cached and r2_cached

            # Count by group with deduplication
            group_counts, unique_count = self.normalizer.count_by_group(ring2_places, dedupe=True)
            dominant_type, dominance_ratio, second_type = self.dominance.calculate(group_counts)
            
            # Log group details
            top_groups = sorted(group_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            groups_str = ", ".join([f"{g}: {c}" for g, c in top_groups])
            reasoning.append(f"Dominant groups: {groups_str}")
            reasoning.append(f"Dominance ratio: {round(dominance_ratio, 2)} ({dominant_type} vs {second_type})")
            primary_type, classification_detail = self.type_resolver.resolve(
                dominance_ratio,
                dominant_type,
                second_type,
                group_counts
            )

            area_context = self.context_deriver.derive(
                primary_type,
                classification_detail=classification_detail,
                dominant_type=dominant_type
            )
            area_confidence = self._confidence_from_counts(unique_count, group_counts, ring2_radius)

            reasoning.append(
                f"Ring 2: Groups - {self._format_counts(group_counts)}"
            )
            reasoning.append(
                f"Area classification: {primary_type} ({classification_detail}, "
                f"ratio: {dominance_ratio:.2f})"
            )

            ring_analysis["ring2"] = {
                "radius": ring2_radius,
                "baseRadius": RING2_CONFIG["base_radius"],
                "expanded": ring2_radius > RING2_CONFIG["base_radius"],
                "placesFound": len(ring2_places),
                "uniquePlaces": unique_count,
                "placeGroups": group_counts,
                "dominantGroup": dominant_type,
                "dominanceRatio": round(dominance_ratio, 3),
                "skipped": False,
            }

            # Apply Ring 1.5 extended authority if found
            # This overrides the primary type but combines with local context
            if extended_authority:
                # Use extended authority type as primary
                primary_type = extended_authority["type"]
                # Combine contexts: "Near Major Hospital - Local: Retail Zone"
                local_context = area_context if area_context else "Mixed Use Area"
                area_context = f"{extended_authority['context']} (Local: {local_context})"
                classification_detail = "EXTENDED_AUTHORITY"
                area_confidence = "high"
                reasoning.append(
                    f"Final type overridden by Ring 1.5 major anchor: {extended_authority['place_name']}"
                )

            area_block = {
                "primaryType": primary_type,
                "context": area_context,
                "confidence": area_confidence,
                "classificationDetail": classification_detail,
                "dominantGroup": dominant_type,
                "extendedAuthority": extended_authority["place_name"] if extended_authority else None,
            }

        # Step 4: Ring 3 - Movement context
        reasoning.append("Step 4: Analyzing Ring 3 (200m - movement context).")
        move_ctx, meta_r3 = self.google_maps.movement_context(latitude, longitude, geo_full=geo_full)
        net_calls += meta_r3["network_calls"]
        all_cached = all_cached and meta_r3["cached"]

        movement_type = self.movement.derive_movement_type(
            road_type=move_ctx.get("roadType"),
            near_junction=move_ctx.get("nearJunction", False),
            pedestrian_friendly=move_ctx.get("pedestrianFriendly", False),
        )
        movement_context = self.movement.derive_movement_context(
            road_type=move_ctx.get("roadType"),
            near_junction=move_ctx.get("nearJunction", False),
            pedestrian_friendly=move_ctx.get("pedestrianFriendly", False),
        )
        
        reasoning.append(f"Movement Type: {movement_type}")
        reasoning.append(f"Context: {movement_context}")

        # Step 5: Dwell category with weighted calculation
        dwell_category, dwell_confidence, dwell_score = self.dwell.derive(
            area_block["primaryType"],
            movement_type,
            group_counts=group_counts,
            authority_type=authority["detected_from"] if authority else None
        )

        # Add Ring 3 to ring analysis
        ring_analysis["ring3"] = {
            "radius": 200,
            "roadType": move_ctx.get("roadType"),
            "nearJunction": move_ctx.get("nearJunction", False),
            "pedestrianFriendly": move_ctx.get("pedestrianFriendly", False),
        }

        processing_time = int((time.time() - start) * 1000)

        return {
            "coordinates": {"latitude": float(latitude), "longitude": float(longitude)},
            "geoContext": geo_context,
            "area": {
                "primaryType": area_block["primaryType"],
                "context": area_block["context"],
                "confidence": area_block["confidence"],
                "classificationDetail": area_block.get("classificationDetail", ""),
                "dominantGroup": area_block.get("dominantGroup"),
            },
            "movement": {"type": movement_type, "context": movement_context},
            "dwellCategory": dwell_category,
            "dwellConfidence": dwell_confidence,
            "dwellScore": dwell_score,
            "dominanceRatio": round(dominance_ratio, 3),
            "ringAnalysis": ring_analysis,
            "reasoning": reasoning,
            "metadata": {
                "computedAt": timezone.now().isoformat(),
                "apiCallsMade": net_calls,
                "cached": all_cached,
                "processingTimeMs": processing_time,
                "apiKeyConfigured": True,
                "warnings": warnings,
                "version": "2.0.0",
            },
            # Top-level aliases for backward compatibility
            "primaryType": area_block["primaryType"],
            "areaContext": area_block["context"],
            "movementType": movement_type,
        }

    @staticmethod
    def _format_counts(group_counts: Dict[str, int]) -> str:
        """Format group counts for logging."""
        return ", ".join([
            f"{k}:{v}" for k, v in sorted(
                group_counts.items(),
                key=lambda x: (-x[1], x[0])
            )
        ])

    @staticmethod
    def _confidence_from_counts(
        places_found: int,
        group_counts: Dict[str, int],
        radius_used: int = 500
    ) -> str:
        """Calculate confidence level from place counts and radius."""
        distinct_groups = len([k for k, v in group_counts.items() if v > 0])

        # Penalize if radius was expanded (indicates sparse area)
        expansion_penalty = 0
        if radius_used > RING2_CONFIG["base_radius"]:
            expansion_penalty = (radius_used - RING2_CONFIG["base_radius"]) // 300

        adjusted_places = places_found - (expansion_penalty * 5)

        if adjusted_places >= 40 or distinct_groups >= 8:
            return "high"
        if adjusted_places >= 20 or distinct_groups >= 5:
            return "medium"
        return "low"

    # =========================================================================
    # HYBRID & FULL-LLM METHODS
    # =========================================================================

    def analyze_screen_location_hybrid(
        self,
        latitude: float,
        longitude: float,
        indoor: bool = False,
        height_from_ground_ft: float = 0.0
    ) -> Dict[str, Any]:
        """
        Analyze screen location with hybrid mode (rules + selective LLM).

        This is the DEFAULT mode that uses rule-based classification for
        most cases (~80%) and invokes LLM only for edge cases:
        - Low confidence results
        - Close dominance ratios (<15% gap)
        - Insufficient places data
        - Borderline classifications

        Args:
            latitude: Screen latitude
            longitude: Screen longitude
            indoor: Whether screen is indoor
            height_from_ground_ft: Screen height from ground

        Returns:
            Complete area context profile with LLM enhancement metadata
        """
        # First, run rule-based analysis
        profile = self.analyze_screen_location(
            latitude=latitude,
            longitude=longitude,
            indoor=indoor,
            height_from_ground_ft=height_from_ground_ft
        )

        # Check if LLM enhancement is needed
        try:
            from .llm_profiler import (
                get_llm_profiler_service,
                format_places_summary,
                format_location_context,
                format_dominance_metrics
            )

            llm_service = get_llm_profiler_service()

            if not llm_service.is_available:
                profile["llmEnhancement"] = {
                    "used": False,
                    "reason": "LLM_NOT_AVAILABLE",
                    "mode": "hybrid"
                }
                return profile

            # Get metrics for LLM decision
            confidence = profile["area"]["confidence"]
            dominance_ratio = profile.get("dominanceRatio", 0)

            # Calculate second ratio
            ring2_data = profile.get("ringAnalysis", {}).get("ring2", {})
            group_counts = ring2_data.get("placeGroups", {})
            places_count = ring2_data.get("uniquePlaces", 0)

            second_ratio = 0.0
            if group_counts and len(group_counts) > 1:
                sorted_counts = sorted(group_counts.values(), reverse=True)
                total = sum(sorted_counts)
                if total > 0 and len(sorted_counts) > 1:
                    second_ratio = sorted_counts[1] / total

            # Check if LLM should be invoked
            should_use, reason = llm_service.should_use_llm(
                confidence=confidence,
                dominance_ratio=dominance_ratio,
                second_ratio=second_ratio,
                places_count=places_count
            )

            if not should_use:
                profile["llmEnhancement"] = {
                    "used": False,
                    "reason": reason,
                    "mode": "hybrid"
                }
                return profile

            # Invoke LLM for ambiguity resolution
            profile["reasoning"].append(f"Step 6: LLM enhancement triggered ({reason})")

            # Format context for LLM
            geo = profile.get("geoContext", {})
            dominant_type = ring2_data.get("dominantGroup", "MIXED")

            # Get second type
            second_type = None
            if group_counts:
                sorted_groups = sorted(group_counts.items(), key=lambda x: -x[1])
                if len(sorted_groups) > 1:
                    second_type = sorted_groups[1][0]

            dominance_metrics = format_dominance_metrics(
                dominant_type=dominant_type,
                dominance_ratio=dominance_ratio,
                second_type=second_type or "N/A",
                second_ratio=second_ratio,
                group_counts=group_counts
            )

            places_summary = format_places_summary(group_counts, places_count)

            rule_result = {
                "primary_type": profile["area"]["primaryType"],
                "context": profile["area"]["context"],
                "confidence": confidence,
                "classification_detail": profile["area"]["classificationDetail"]
            }

            # Resolve ambiguity with LLM
            resolution = llm_service.resolve_ambiguity(
                rule_result=rule_result,
                places_context=places_summary,
                dominance_metrics=dominance_metrics
            )

            # Apply LLM resolution if override recommended
            if resolution.get("should_override", False):
                profile["area"]["primaryType"] = resolution["final_type"]
                profile["area"]["context"] = resolution["final_context"]
                profile["area"]["classificationDetail"] = "LLM_OVERRIDE"
                profile["primaryType"] = resolution["final_type"]
                profile["areaContext"] = resolution["final_context"]
                profile["reasoning"].append(
                    f"LLM override: {resolution.get('rationale', 'No rationale')}"
                )

            profile["llmEnhancement"] = {
                "used": True,
                "reason": reason,
                "mode": "hybrid",
                "override": resolution.get("should_override", False),
                "rationale": resolution.get("rationale", ""),
                "latencyMs": resolution.get("latency_ms", 0)
            }

        except ImportError:
            profile["llmEnhancement"] = {
                "used": False,
                "reason": "LLM_MODULE_NOT_INSTALLED",
                "mode": "hybrid"
            }
        except Exception as e:
            profile["llmEnhancement"] = {
                "used": False,
                "reason": f"LLM_ERROR: {str(e)}",
                "mode": "hybrid"
            }
            profile["reasoning"].append(f"LLM enhancement failed: {str(e)}")

        return profile

    def analyze_screen_location_full_llm(
        self,
        latitude: float,
        longitude: float,
        indoor: bool = False,
        height_from_ground_ft: float = 0.0
    ) -> Dict[str, Any]:
        """
        Analyze screen location with full LLM classification.

        This mode uses 100% LLM for classification, useful for:
        - A/B testing against rule-based
        - Ground truth verification
        - Edge case analysis

        Args:
            latitude: Screen latitude
            longitude: Screen longitude
            indoor: Whether screen is indoor
            height_from_ground_ft: Screen height from ground

        Returns:
            Complete area context profile with full LLM classification
        """
        start = time.time()
        reasoning: List[str] = []
        warnings: List[str] = []
        net_calls = 0
        all_cached = True

        api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
        if not api_key:
            raise Exception("GOOGLE_MAPS_API_KEY not configured")
        if not self.google_maps.client:
            raise Exception("Google Maps client not initialized (check key)")

        # Step 1: Geographic context
        reasoning.append("Step 1: Fetching geographic context.")
        geo_full, meta_geo = self.google_maps.reverse_geocode_full(latitude, longitude)
        net_calls += meta_geo["network_calls"]
        all_cached = all_cached and meta_geo["cached"]

        geo_context = {
            "city": geo_full.get("city", "Unknown"),
            "state": geo_full.get("state", "Unknown"),
            "country": geo_full.get("country", "Unknown"),
            "cityTier": geo_full.get("cityTier", "TIER_3"),
            "formattedAddress": geo_full.get("formattedAddress", ""),
        }
        reasoning.append(
            f"Geo context: {geo_context['city']}, {geo_context['state']} "
            f"({geo_context['cityTier']})"
        )

        # Step 2: Ring 1 - Authority detection (still fetch for context)
        reasoning.append("Step 2: Analyzing Ring 1 (75m - authority context).")
        ring1_places, meta_r1 = self.google_maps.places_nearby_all(
            latitude, longitude, radius=75, max_results=20
        )
        net_calls += meta_r1["network_calls"]
        all_cached = all_cached and meta_r1["cached"]

        ring1_unique = self.normalizer.dedupe_places(ring1_places)
        reasoning.append(f"Ring 1: Found {len(ring1_places)} places ({len(ring1_unique)} unique)")
        if ring1_unique:
            top_places = [p.get('name') for p in ring1_unique[:3]]
            reasoning.append(f"Top places: {', '.join(top_places)}")

        # Step 3: Ring 2 - Area classification
        reasoning.append("Step 3: Analyzing Ring 2 (area classification).")
        ring2_places, r2_calls, r2_cached, ring2_radius = self._adaptive_ring2_search(
            latitude, longitude,
            geo_context["cityTier"],
            reasoning
        )
        net_calls += r2_calls
        all_cached = all_cached and r2_cached

        group_counts, unique_count = self.normalizer.count_by_group(ring2_places, dedupe=True)
        dominant_type, dominance_ratio, second_type = self.dominance.calculate(group_counts)
        
        # Log group details
        top_groups = sorted(group_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        groups_str = ", ".join([f"{g}: {c}" for g, c in top_groups])
        reasoning.append(f"Dominant groups: {groups_str}")
        reasoning.append(f"Dominance ratio: {round(dominance_ratio, 2)} ({dominant_type} vs {second_type})")

        ring_analysis: Dict[str, Any] = {
            "ring1": {
                "radius": 75,
                "placesFound": len(ring1_places),
                "uniquePlaces": len(ring1_unique),
                "keyVenues": [],
            },
            "ring2": {
                "radius": ring2_radius,
                "baseRadius": RING2_CONFIG["base_radius"],
                "expanded": ring2_radius > RING2_CONFIG["base_radius"],
                "placesFound": len(ring2_places),
                "uniquePlaces": unique_count,
                "placeGroups": group_counts,
                "dominantGroup": dominant_type,
                "dominanceRatio": round(dominance_ratio, 3),
                "skipped": False,
            }
        }

        # Step 4: Enrich places with editorial summaries (NEW)
        reasoning.append("Step 4: Enriching places with editorial summaries.")

        # Combine Ring 1 and Ring 2 places for enrichment (prioritize Ring 1)
        all_places_for_enrichment = ring1_unique + [
            p for p in ring2_places if p not in ring1_unique
        ]

        # Enrich top places with detailed info (editorial_summary, rating, viewport)
        # Enhanced scoring (v2.1):
        # - authority_type(+1000) + satellite_pattern(+800) + density_bonus(+600)
        # - user_ratings(capped 1000) + high_rating(+100) + name_keywords(+500)
        # - coherence_bonus(+400) + false_positive_penalty(-500)
        enriched_places, enrich_meta = self.google_maps.enrich_places_with_details(
            all_places_for_enrichment,
            max_enrichments=20,  # Top 20 by priority score
            ring1_place_count=len(ring1_unique)  # Pass Ring 1 count for density scoring
        )
        net_calls += enrich_meta["network_calls"]
        all_cached = all_cached and enrich_meta["cached"]

        # Count how many places got editorial summaries
        places_with_editorial = sum(
            1 for p in enriched_places if p.get("editorial_summary")
        )
        reasoning.append(
            f"Enriched {len(enriched_places)} places, "
            f"{places_with_editorial} have editorial summaries"
        )

        # Step 5: Full LLM Classification with enriched context
        reasoning.append("Step 5: Full LLM classification with enriched context.")

        try:
            from .llm_profiler import (
                get_llm_profiler_service,
                format_places_summary,
                format_location_context,
                format_authority_candidates,
                format_enriched_places_context
            )

            llm_service = get_llm_profiler_service()

            if not llm_service.is_available:
                raise Exception("LLM service not available")

            # Format inputs for LLM
            places_summary = format_places_summary(group_counts, unique_count)
            location_context = format_location_context(
                city=geo_context["city"],
                state=geo_context["state"],
                country=geo_context["country"],
                city_tier=geo_context["cityTier"],
                address=geo_context["formattedAddress"],
                latitude=latitude,
                longitude=longitude
            )
            # Use AUTHORITY_TYPES from this module (already defined above)
            # Pass enriched Ring 1 places for authority detection (with editorial summaries)
            enriched_ring1 = [p for p in enriched_places if p in ring1_unique or any(
                ep.get("place_id") == p.get("place_id") for ep in enriched_places[:len(ring1_unique)]
            )][:len(ring1_unique)]

            authority_candidates = format_authority_candidates(enriched_ring1, AUTHORITY_TYPES)

            # Format enriched places context with editorial summaries
            enriched_places_context = format_enriched_places_context(enriched_places, max_places=15)

            # Get LLM classification with enriched context
            llm_result = llm_service.classify_full_llm(
                places_summary=places_summary,
                location_context=location_context,
                authority_candidates=authority_candidates,
                latitude=latitude,
                longitude=longitude,
                enriched_places_context=enriched_places_context
            )

            primary_type = llm_result.primary_type
            area_context = llm_result.area_context
            area_confidence = llm_result.confidence
            classification_detail = llm_result.classification_detail
            llm_reasoning = llm_result.reasoning

            reasoning.append(f"LLM classification: {primary_type} ({classification_detail})")
            if llm_reasoning:
                # Truncate long LLM reasoning for UI clarity
                short_reasoning = (llm_reasoning[:150] + '...') if len(llm_reasoning) > 150 else llm_reasoning
                reasoning.append(f"LLM reasoning: {short_reasoning}")

            llm_metadata = {
                "used": True,
                "mode": "full_llm",
                "latencyMs": llm_result.latency_ms,
                "cached": llm_result.cached,
                "error": llm_result.error,
                "enrichedPlaces": len(enriched_places),
                "placesWithEditorial": places_with_editorial
            }

        except ImportError as e:
            # Fallback to rule-based if LLM not available
            reasoning.append(f"LLM not available, falling back to rules: {str(e)}")
            primary_type, classification_detail = self.type_resolver.resolve(
                dominance_ratio, dominant_type, second_type, group_counts
            )
            area_context = self.context_deriver.derive(
                primary_type, classification_detail=classification_detail, dominant_type=dominant_type
            )
            area_confidence = self._confidence_from_counts(unique_count, group_counts, ring2_radius)
            llm_metadata = {
                "used": False,
                "mode": "full_llm",
                "reason": f"IMPORT_ERROR: {str(e)}"
            }
        except Exception as e:
            # Fallback to rule-based if LLM fails
            reasoning.append(f"LLM failed, falling back to rules: {str(e)}")
            primary_type, classification_detail = self.type_resolver.resolve(
                dominance_ratio, dominant_type, second_type, group_counts
            )
            area_context = self.context_deriver.derive(
                primary_type, classification_detail=classification_detail, dominant_type=dominant_type
            )
            area_confidence = self._confidence_from_counts(unique_count, group_counts, ring2_radius)
            llm_metadata = {
                "used": False,
                "mode": "full_llm",
                "reason": f"LLM_ERROR: {str(e)}"
            }

        # Step 6: Ring 3 - Movement context
        reasoning.append("Step 6: Analyzing Ring 3 (200m - movement context).")
        move_ctx, meta_r3 = self.google_maps.movement_context(latitude, longitude, geo_full=geo_full)
        net_calls += meta_r3["network_calls"]
        all_cached = all_cached and meta_r3["cached"]

        movement_type = self.movement.derive_movement_type(
            road_type=move_ctx.get("roadType"),
            near_junction=move_ctx.get("nearJunction", False),
            pedestrian_friendly=move_ctx.get("pedestrianFriendly", False),
        )
        movement_context = self.movement.derive_movement_context(
            road_type=move_ctx.get("roadType"),
            near_junction=move_ctx.get("nearJunction", False),
            pedestrian_friendly=move_ctx.get("pedestrianFriendly", False),
        )
        
        reasoning.append(f"Movement Type: {movement_type}")
        reasoning.append(f"Context: {movement_context}")

        # Step 7: Dwell category
        dwell_category, dwell_confidence, dwell_score = self.dwell.derive(
            primary_type, movement_type, group_counts=group_counts
        )

        ring_analysis["ring3"] = {
            "radius": 200,
            "roadType": move_ctx.get("roadType"),
            "nearJunction": move_ctx.get("nearJunction", False),
            "pedestrianFriendly": move_ctx.get("pedestrianFriendly", False),
        }

        processing_time = int((time.time() - start) * 1000)

        return {
            "coordinates": {"latitude": float(latitude), "longitude": float(longitude)},
            "geoContext": geo_context,
            "area": {
                "primaryType": primary_type,
                "context": area_context,
                "confidence": area_confidence,
                "classificationDetail": classification_detail,
                "dominantGroup": dominant_type,
            },
            "movement": {"type": movement_type, "context": movement_context},
            "dwellCategory": dwell_category,
            "dwellConfidence": dwell_confidence,
            "dwellScore": dwell_score,
            "dominanceRatio": round(dominance_ratio, 3),
            "ringAnalysis": ring_analysis,
            "reasoning": reasoning,
            "llmEnhancement": llm_metadata,
            "metadata": {
                "computedAt": timezone.now().isoformat(),
                "apiCallsMade": net_calls,
                "cached": all_cached,
                "processingTimeMs": processing_time,
                "apiKeyConfigured": True,
                "warnings": warnings,
                "version": "2.2.0-llm-enriched",
            },
            # Top-level aliases for backward compatibility
            "primaryType": primary_type,
            "areaContext": area_context,
            "movementType": movement_type,
        }


    def analyze_screen_location_research_agent(
        self,
        latitude: float,
        longitude: float,
        indoor: bool = False,
        height_from_ground_ft: float = 0.0
    ) -> Dict[str, Any]:
        """
        Analyze screen location using the LangGraph Research Agent.

        This mode uses a multi-step research workflow inspired by Open Deep Research:
        1. PLAN - Analyze location and determine research strategy
        2. RESEARCH - Gather information using grounded search + Places API
        3. CLASSIFY - Synthesize findings into classification
        4. VERIFY - Cross-check with additional grounded search

        Args:
            latitude: Screen latitude
            longitude: Screen longitude
            indoor: Whether screen is indoor
            height_from_ground_ft: Screen height from ground

        Returns:
            Complete area context profile with research agent results
        """
        start = time.time()
        reasoning: List[str] = []
        warnings: List[str] = []
        net_calls = 0
        all_cached = True

        api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
        if not api_key:
            raise Exception("GOOGLE_MAPS_API_KEY not configured")
        if not self.google_maps.client:
            raise Exception("Google Maps client not initialized (check key)")

        # Step 1: Geographic context
        reasoning.append("Step 1: Fetching geographic context.")
        geo_full, meta_geo = self.google_maps.reverse_geocode_full(latitude, longitude)
        net_calls += meta_geo["network_calls"]
        all_cached = all_cached and meta_geo["cached"]

        geo_context = {
            "city": geo_full.get("city", "Unknown"),
            "state": geo_full.get("state", "Unknown"),
            "country": geo_full.get("country", "Unknown"),
            "cityTier": geo_full.get("cityTier", "TIER_3"),
            "formattedAddress": geo_full.get("formattedAddress", ""),
        }
        reasoning.append(
            f"Geo context: {geo_context['city']}, {geo_context['state']} "
            f"({geo_context['cityTier']})"
        )

        # Step 2: Ring 1 - Authority detection
        reasoning.append("Step 2: Analyzing Ring 1 (75m - authority context).")
        ring1_places, meta_r1 = self.google_maps.places_nearby_all(
            latitude, longitude, radius=75, max_results=20
        )
        net_calls += meta_r1["network_calls"]
        all_cached = all_cached and meta_r1["cached"]

        ring1_unique = self.normalizer.dedupe_places(ring1_places)
        reasoning.append(f"Ring 1: Found {len(ring1_places)} places ({len(ring1_unique)} unique)")

        # Step 3: Ring 2 - Area classification data
        reasoning.append("Step 3: Analyzing Ring 2 (area classification).")
        ring2_places, r2_calls, r2_cached, ring2_radius = self._adaptive_ring2_search(
            latitude, longitude,
            geo_context["cityTier"],
            reasoning
        )
        net_calls += r2_calls
        all_cached = all_cached and r2_cached

        group_counts, unique_count = self.normalizer.count_by_group(ring2_places, dedupe=True)
        dominant_type, dominance_ratio, second_type = self.dominance.calculate(group_counts)

        # Format authority candidates for research agent
        authority_candidates_str = self._format_authority_candidates_for_agent(ring1_unique)

        ring_analysis: Dict[str, Any] = {
            "ring1": {
                "radius": 75,
                "placesFound": len(ring1_places),
                "uniquePlaces": len(ring1_unique),
            },
            "ring2": {
                "radius": ring2_radius,
                "baseRadius": RING2_CONFIG["base_radius"],
                "expanded": ring2_radius > RING2_CONFIG["base_radius"],
                "placesFound": len(ring2_places),
                "uniquePlaces": unique_count,
                "placeGroups": group_counts,
                "dominantGroup": dominant_type,
                "dominanceRatio": round(dominance_ratio, 3),
            }
        }

        # Step 4: Research Agent Classification
        reasoning.append("Step 4: Running LangGraph Research Agent (PLAN → RESEARCH → CLASSIFY → VERIFY).")

        try:
            from .llm_research_agent import get_research_agent_service

            research_service = get_research_agent_service()

            if not research_service.is_available:
                raise Exception("Research agent not available (check GEMINI_API_KEY)")

            # Build places data for research agent
            places_data = {
                "group_counts": group_counts,
                "dominant_type": dominant_type,
                "dominance_ratio": dominance_ratio,
                "unique_count": unique_count,
                "ring1_places": ring1_unique,
                "authority_candidates": authority_candidates_str
            }

            # Run research agent
            agent_result = research_service.classify(
                latitude=latitude,
                longitude=longitude,
                places_data=places_data,
                location_context=geo_context
            )

            primary_type = agent_result.primary_type
            area_context = agent_result.area_context
            area_confidence = agent_result.confidence
            classification_detail = agent_result.classification_detail

            reasoning.append(f"Research Agent: {primary_type} ({classification_detail})")
            reasoning.append(f"Verification: {agent_result.verification_status}")
            reasoning.append(f"Agent reasoning: {agent_result.reasoning}")

            # Add step timings to reasoning
            for step, timing in agent_result.step_timings.items():
                reasoning.append(f"  - {step}: {timing}ms")

            research_metadata = {
                "used": True,
                "mode": "research_agent",
                "verification_status": agent_result.verification_status,
                "research_findings_count": len(agent_result.research_findings),
                "additional_evidence": agent_result.additional_evidence,
                "step_timings": agent_result.step_timings,
                "total_latency_ms": agent_result.total_latency_ms,
                "error": agent_result.error
            }

        except ImportError as e:
            reasoning.append(f"Research agent not available: {str(e)}")
            # Fallback to rule-based
            primary_type, classification_detail = self.type_resolver.resolve(
                dominance_ratio, dominant_type, second_type, group_counts
            )
            area_context = self.context_deriver.derive(
                primary_type, classification_detail=classification_detail, dominant_type=dominant_type
            )
            area_confidence = self._confidence_from_counts(unique_count, group_counts, ring2_radius)
            research_metadata = {
                "used": False,
                "mode": "research_agent",
                "reason": f"IMPORT_ERROR: {str(e)}"
            }
        except Exception as e:
            reasoning.append(f"Research agent error: {str(e)}")
            # Fallback to rule-based
            primary_type, classification_detail = self.type_resolver.resolve(
                dominance_ratio, dominant_type, second_type, group_counts
            )
            area_context = self.context_deriver.derive(
                primary_type, classification_detail=classification_detail, dominant_type=dominant_type
            )
            area_confidence = self._confidence_from_counts(unique_count, group_counts, ring2_radius)
            research_metadata = {
                "used": False,
                "mode": "research_agent",
                "reason": f"AGENT_ERROR: {str(e)}"
            }

        # Step 5: Ring 3 - Movement context
        reasoning.append("Step 5: Analyzing Ring 3 (200m - movement context).")
        move_ctx, meta_r3 = self.google_maps.movement_context(latitude, longitude, geo_full=geo_full)
        net_calls += meta_r3["network_calls"]
        all_cached = all_cached and meta_r3["cached"]

        movement_type = self.movement.derive_movement_type(
            road_type=move_ctx.get("roadType"),
            near_junction=move_ctx.get("nearJunction", False),
            pedestrian_friendly=move_ctx.get("pedestrianFriendly", False),
        )
        movement_context = self.movement.derive_movement_context(
            road_type=move_ctx.get("roadType"),
            near_junction=move_ctx.get("nearJunction", False),
            pedestrian_friendly=move_ctx.get("pedestrianFriendly", False),
        )

        # Step 6: Dwell category
        dwell_category, dwell_confidence, dwell_score = self.dwell.derive(
            primary_type, movement_type, group_counts=group_counts
        )

        ring_analysis["ring3"] = {
            "radius": 200,
            "roadType": move_ctx.get("roadType"),
            "nearJunction": move_ctx.get("nearJunction", False),
            "pedestrianFriendly": move_ctx.get("pedestrianFriendly", False),
        }

        processing_time = int((time.time() - start) * 1000)

        return {
            "coordinates": {"latitude": float(latitude), "longitude": float(longitude)},
            "geoContext": geo_context,
            "area": {
                "primaryType": primary_type,
                "context": area_context,
                "confidence": area_confidence,
                "classificationDetail": classification_detail,
                "dominantGroup": dominant_type,
            },
            "movement": {"type": movement_type, "context": movement_context},
            "dwellCategory": dwell_category,
            "dwellConfidence": dwell_confidence,
            "dwellScore": dwell_score,
            "dominanceRatio": round(dominance_ratio, 3),
            "ringAnalysis": ring_analysis,
            "reasoning": reasoning,
            "researchAgent": research_metadata,
            "metadata": {
                "computedAt": timezone.now().isoformat(),
                "apiCallsMade": net_calls,
                "cached": all_cached,
                "processingTimeMs": processing_time,
                "apiKeyConfigured": True,
                "warnings": warnings,
                "version": "2.3.0-research-agent",
            },
            # Top-level aliases for backward compatibility
            "primaryType": primary_type,
            "areaContext": area_context,
            "movementType": movement_type,
        }

    def _format_authority_candidates_for_agent(
        self,
        ring1_places: List[Dict[str, Any]]
    ) -> str:
        """Format Ring 1 places as authority candidates string for research agent."""
        candidates = []

        for place in ring1_places:
            types = set(place.get("types", []) or [])
            name = place.get("name", "Unknown")
            ratings = place.get("user_ratings_total", 0) or 0

            # Check if this is an authority type
            authority_types = {"hospital", "train_station", "transit_station", "bus_station",
                            "airport", "university", "college", "shopping_mall", "stadium",
                            "temple", "mosque", "church", "gurudwara", "courthouse", "city_hall"}

            if types.intersection(authority_types):
                type_str = ", ".join(list(types.intersection(authority_types))[:3])
                candidates.append(f"- {name} ({type_str}, {ratings} ratings)")

        if not candidates:
            return "No authority anchors detected in Ring 1"

        return "\n".join(candidates)


# =============================================================================
# SERVICE SINGLETON
# =============================================================================

_area_context_service: Optional[AreaContextService] = None


def get_area_context_service() -> AreaContextService:
    """Get singleton instance of AreaContextService."""
    global _area_context_service
    if _area_context_service is None:
        _area_context_service = AreaContextService()
    return _area_context_service
