"""
Google Maps helpers for Area Context Intelligence (Beta)
Fixes vs previous version
- Reverse geocode full response is cached once and reused for geo+road hints
- Places Nearby supports pagination (up to 3 pages = 60 results) with max_results guard
- Every method returns meta so caller can count real network calls
"""
from __future__ import annotations
import os
import time
from typing import Any, Dict, List, Optional, Tuple
import googlemaps
from django.core.cache import cache

class GoogleMapsAreaContextService:

    def __init__(self):
        self._client: Optional[googlemaps.Client] = None
        self._api_key: str = ""
        self._init_client()

    def _init_client(self) -> None:
        self._api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
        if not self._api_key:
            self._client = None
            return
        try:
            self._client = googlemaps.Client(key=self._api_key)
        except Exception:
            self._client = None

    @property
    def client(self) -> Optional[googlemaps.Client]:
        current_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
        if current_key != self._api_key:
            self._init_client()
        return self._client

    def reverse_geocode_full(self, latitude: float, longitude: float) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        client = self.client
        if not client:
            return (
                {
                    "city": "Unknown",
                    "state": "Unknown",
                    "country": "Unknown",
                    "cityTier": "TIER_3",
                    "formattedAddress": "",
                    "addressComponents": [],
                },
                {"cached": True, "network_calls": 0},
            )
        lat_key = round(float(latitude), 5)
        lng_key = round(float(longitude), 5)
        cache_key = f"geocode_full_{lat_key}_{lng_key}"
        cached = cache.get(cache_key)
        if cached:
            return cached, {"cached": True, "network_calls": 0}
        result = client.reverse_geocode((latitude, longitude)) or []
        if not result:
            geo_full = {
                "city": "Unknown",
                "state": "Unknown",
                "country": "Unknown",
                "cityTier": "TIER_3",
                "formattedAddress": "",
                "addressComponents": [],
            }
            cache.set(cache_key, geo_full, 2592000)
            return geo_full, {"cached": False, "network_calls": 1}
        address_components = result[0].get("address_components", []) or []
        formatted_address = result[0].get("formatted_address", "") or ""
        city = "Unknown"
        state = "Unknown"
        country = "Unknown"
        for component in address_components:
            types = component.get("types", []) or []
            if "locality" in types or "administrative_area_level_2" in types:
                city = component.get("long_name", city)
            if "administrative_area_level_1" in types:
                state = component.get("long_name", state)
            if "country" in types:
                country = component.get("long_name", country)
        from .area_context_service import CITY_TIER_MAPPING
        city_tier = CITY_TIER_MAPPING.get(city, "TIER_3")
        geo_full = {
            "city": city,
            "state": state,
            "country": country,
            "cityTier": city_tier,
            "formattedAddress": formatted_address,
            "addressComponents": address_components,
        }
        cache.set(cache_key, geo_full, 2592000)
        return geo_full, {"cached": False, "network_calls": 1}

    def places_nearby_all(self, latitude: float, longitude: float, radius: int, max_results: int = 60) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        client = self.client
        if not client:
            return [], {"cached": True, "network_calls": 0}
        lat_key = round(float(latitude), 5)
        lng_key = round(float(longitude), 5)
        max_results = max(1, min(int(max_results), 60))
        cache_key = f"places_{lat_key}_{lng_key}_{radius}_{max_results}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached, {"cached": True, "network_calls": 0}
        location = (float(latitude), float(longitude))
        places: List[Dict[str, Any]] = []
        token: Optional[str] = None
        network_calls = 0
        pages_needed = (max_results + 19) // 20
        pages_needed = min(pages_needed, 3)
        for _ in range(pages_needed):
            if token:
                time.sleep(2)
                resp = client.places_nearby(location=location, radius=radius, page_token=token)
            else:
                resp = client.places_nearby(location=location, radius=radius)
            network_calls += 1
            batch = resp.get("results", []) or []
            places.extend(batch)
            if len(places) >= max_results:
                places = places[:max_results]
                break
            token = resp.get("next_page_token")
            if not token:
                break
        cache.set(cache_key, places, 604800)
        return places, {"cached": False, "network_calls": network_calls}

    def movement_context(self, latitude: float, longitude: float, geo_full: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        network_calls = 0
        cached_all = True
        if geo_full is None:
            geo_full, meta_geo = self.reverse_geocode_full(latitude, longitude)
            network_calls += meta_geo["network_calls"]
            cached_all = cached_all and meta_geo["cached"]
        formatted = (geo_full.get("formattedAddress") or "").lower()
        road_type = "local"
        if any(k in formatted for k in ["expressway", "national highway", "nh", "highway"]):
            road_type = "highway"
        elif any(k in formatted for k in ["main road", "ring road", "bypass", "arterial", "boulevard", "avenue"]):
            road_type = "arterial"
        places_200, meta_p = self.places_nearby_all(latitude, longitude, radius=200, max_results=20)
        network_calls += meta_p["network_calls"]
        cached_all = cached_all and meta_p["cached"]
        near_junction = any(k in formatted for k in ["junction", "intersection", "signal", "cross", "circle", "roundabout"])
        if not near_junction:
            for p in places_200:
                types = p.get("types", []) or []
                if "traffic_signal" in types:
                    near_junction = True
                    break
        pedestrian_types = {
            "park", "shopping_mall", "tourist_attraction",
            "school", "university",
            "transit_station", "bus_station", "train_station", "subway_station",
            "movie_theater",
        }
        pedestrian_friendly = False
        for p in places_200:
            types = set(p.get("types", []) or [])
            if types.intersection(pedestrian_types):
                pedestrian_friendly = True
                break
        return {
            "roadType": road_type,
            "nearJunction": near_junction,
            "pedestrianFriendly": pedestrian_friendly,
        }, {"cached": cached_all, "network_calls": network_calls}

_google_maps_service: Optional[GoogleMapsAreaContextService] = None

def get_google_maps_service() -> GoogleMapsAreaContextService:
    global _google_maps_service
    if _google_maps_service is None:
        _google_maps_service = GoogleMapsAreaContextService()
    return _google_maps_service
