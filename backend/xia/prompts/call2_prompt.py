"""
Call #2 Prompt — Ranking + Reasoning
-------------------------------------
Builds the system prompt for Call #2.
The LLM sees actual screen data and ranks them by relevance
to the user's campaign context.

Input:  filtered screens + Call #1 output
Output: {"ranking": [...], "screen_scores": {"id": 85, ...}, "screen_reasoning": {"id": "...", ...}}
"""


# Batch size for ranking. If discover returns more than this,
# LLMService.call2_rank splits into multiple batches and merges.
RANKING_BATCH_SIZE = 15


# ── Screen data formatter ───────────────────────────────────────
# Compact format: only fields that map to a ranking rule.
# Ring data is pre-digested into a one-line summary.


# ── Human-language translation maps ──────────────────────────────
# IMPORTANT: These MUST match the actual profiler definitions in area_context_service.py
# Movement types are derived from road_type, near_junction, pedestrian_friendly
# Dwell categories are derived from weighted place-group composition + movement modifier

MOVEMENT_SPEAK = {
    'PEDESTRIAN': 'this is a walkable area with steady foot traffic',
    'VEHICULAR': 'vehicles pass through this area regularly',
    'STOP_AND_GO': 'vehicles pause at a nearby signal, giving drivers time to notice your ad',
    'SLOW_FLOW': 'vehicles pass through at a moderate pace along this connector road',
    'PASS_BY': 'this is a highway corridor with fast-moving traffic',
    'MIXED': 'a mix of foot traffic and vehicles pass through',
}

DWELL_SPEAK = {
    # LONG_WAIT: score >= 0.65, driven by healthcare/religious/education/entertainment/food areas
    'LONG_WAIT': 'people tend to stay in this area for a while',
    # MEDIUM_WAIT: score >= 0.35, driven by retail/sports/hospitality areas
    'MEDIUM_WAIT': 'people spend some time browsing in this area',
    # SHORT_WAIT: score < 0.35, driven by transit/highway/industrial areas
    'SHORT_WAIT': 'people pass through this area quickly',
    'PASS_THROUGH': 'people move through without stopping',
}

AREA_SPEAK = {
    # primaryType values from the profiler's area classification
    'RETAIL': 'a shopping area',
    'TRANSIT': 'a commuter hub',
    'COMMERCIAL': 'a commercial area',
    'ENTERTAINMENT': 'an entertainment area',
    'HEALTHCARE': 'a healthcare zone',
    'EDUCATION': 'an education area',
    'RESIDENTIAL': 'a residential neighborhood',
    'RELIGIOUS': 'a culturally significant area',
    'FOOD_BEVERAGE': 'a food and dining area',
    'MIXED_BIASED': '',  # Don't describe — let the dominant group + nearby speak for it
    'MIXED_USE': '',     # Same — too generic to label
    'OFFICE': 'a business district',
    'FINANCE': 'a financial district',
    'GOVERNMENT': 'a government area',
    'SPORTS': 'a sports and recreation area',
    'INDUSTRIAL': 'an industrial area',
}

POI_LABELS = {
    'RETAIL': 'shops',
    'FOOD_BEVERAGE': 'food spots',
    'HEALTHCARE': 'healthcare centers',
    'EDUCATION': 'educational institutions',
    'ENTERTAINMENT': 'entertainment venues',
    'FINANCE': 'banks & ATMs',
    'OFFICE': 'offices',
    'RELIGIOUS': 'temples & places of worship',
    'AUTOMOTIVE': 'auto services',
    'LODGING': 'hotels',
}


def _build_speak_hints(area_type, detail, movement_type, dwell_cat, nearby_str):
    """
    Translate raw field values into human-language phrases.
    Returns a dict of ready-to-use phrases for the LLM's summary.
    NOTE: Never include specific numbers — they can't be verified by advertisers.
    """
    # Area phrase
    area_phrase = AREA_SPEAK.get(area_type, '')

    # Movement phrase
    movement_phrase = MOVEMENT_SPEAK.get(movement_type, '')

    # Dwell phrase
    dwell_phrase = DWELL_SPEAK.get(dwell_cat, '')

    # Nearby phrase — qualitative, NO specific counts
    # Convert "RETAIL:17, FOOD_BEVERAGE:2" → "shops and food spots nearby"
    nearby_phrase = ''
    if nearby_str:
        labels = []
        for item in nearby_str.split(', '):
            if ':' in item:
                cat = item.split(':')[0].strip()
                label = POI_LABELS.get(cat, cat.lower().replace('_', ' '))
                labels.append(label)
        if labels:
            if len(labels) == 1:
                nearby_phrase = labels[0] + ' nearby'
            elif len(labels) == 2:
                nearby_phrase = f"{labels[0]} and {labels[1]} nearby"
            else:
                nearby_phrase = ', '.join(labels[:-1]) + f', and {labels[-1]} nearby'

    return {
        'area': area_phrase,
        'movement': movement_phrase,
        'dwell': dwell_phrase,
        'nearby': nearby_phrase,
    }


def format_screen_for_ranking(screen_data: dict) -> dict:
    """
    Extract fields Call #2 needs for ranking + human-language speak hints.
    Raw fields are used for SCORING, speak hints are used for WRITING the summary.
    """
    ai = screen_data.get('ai_profile', {})
    area = ai.get('area', {})
    movement = ai.get('movement', {})
    rings = ai.get('ringAnalysis', {})

    # Pre-digest ring2 placeGroups into a compact context string
    ring2 = rings.get('ring2', {})
    groups = ring2.get('placeGroups', {})
    if groups:
        sorted_groups = sorted(groups.items(), key=lambda x: -x[1])
        top_groups = [f"{g}:{c}" for g, c in sorted_groups[:5]]
        nearby = ', '.join(top_groups)
    else:
        nearby = ''

    # Raw field values
    primary_type = area.get('primaryType', '')
    detail_val = area.get('classificationDetail', '')
    movement_type = movement.get('type', '')
    dwell_cat = ai.get('dwellCategory', '')

    # Build human-language speak hints
    speak = _build_speak_hints(primary_type, detail_val, movement_type, dwell_cat, nearby)

    return {
        'id': screen_data.get('id'),

        # Location context
        'name': screen_data.get('screen_name', ''),
        'city': screen_data.get('city', ''),
        'landmark': screen_data.get('nearest_landmark', ''),

        # Raw scoring fields
        'primaryType': primary_type,
        'detail': detail_val,
        'confidence': area.get('confidence', ''),
        'nearby': nearby,
        'movement': movement_type,
        'dwell': dwell_cat,

        # Screen quality
        'size': f"{screen_data.get('screen_width', '?')}×{screen_data.get('screen_height', '?')}",
        'brightness': screen_data.get('brightness_nits'),
        'env': screen_data.get('environment', ''),

        # Eligibility
        'restricted': screen_data.get('restricted_categories_json', []),
        'available': screen_data.get('is_available', False),

        # Human-language hints — USE THESE in the summary, not the raw fields above
        'speak': speak,
    }


def format_screens_for_prompt(screens: list) -> str:
    """
    Format screens into a compact JSON string for the LLM prompt.
    """
    import json
    formatted = [format_screen_for_ranking(s) for s in screens]
    return json.dumps(formatted, indent=2, default=str)


# ── System prompt ───────────────────────────────────────────────

CALL2_SYSTEM_PROMPT = """You are the RANKING ENGINE for XIA, a DOOH (Digital Out-Of-Home) screen advertising platform.

## YOUR JOB
You receive a list of filtered screens and campaign context. Your ONLY job is to RANK them from best to worst for this specific campaign, give a RELEVANCE SCORE (0-100) for each screen, and a ONE-SENTENCE reason for each screen's position.

## CAMPAIGN CONTEXT (from Call #1)
- **Ad Category:** {ad_category}
- **Product Category:** {product_category}
- **Brand Objective:** {brand_objective}
- **Target Audience:** {target_audience}
- **Detected Persona:** {persona}
- **User's Message:** {user_message}

## UNDERSTANDING THE SCREEN DATA

Each screen has been profiled by an AI profiling engine that analyzed the surrounding area using Google Maps data. Here's what each field means and how to use it:

### Area Classification (where the screen is)

- **`primaryType`** — The dominant area type within 500m of the screen. This comes from analyzing ALL nearby Points of Interest (POIs) and grouping them.
  - `RETAIL` = shopping zones, malls, markets — best for consumer products, fashion, jewellery
  - `TRANSIT` = train stations, bus terminals, airports, highway junctions — high-traffic, fast-moving audiences
  - `HEALTHCARE` = near hospitals, clinics — captive waiting audiences
  - `EDUCATION` = near colleges, schools — young demographic
  - `OFFICE` = IT parks, corporate zones — working professionals
  - `FOOD_BEVERAGE` = restaurant clusters, food courts — dining audiences
  - `ENTERTAINMENT` = cinema halls, amusement parks — leisure audiences
  - `RESIDENTIAL` = housing areas — family audiences
  - `RELIGIOUS` = temples, mosques, churches — community gathering spots
  - `MIXED` = no single type dominates — diverse audience
  - `MIXED_BIASED` = mostly mixed but leaning toward one type

- **`detail`** — How confidently the area was classified. This tells you HOW STRONG the area type signal is:
  - `DOMINANT` = 50%+ of nearby POIs are this type — VERY strong signal, perfect match for relevant campaigns
  - `STRONG_BIAS_TOWARD_X` = 35-50% of POIs are type X — strong signal, good match
  - `MODERATE_BIAS_TOWARD_X` = 25-35% of POIs are type X — moderate signal, decent match
  - `WEAK_BIAS_TOWARD_X` = 15-25% of POIs are type X — weak signal, area is mostly mixed
  - `DIVERSE` = no type exceeds 15% — truly mixed, area match is unreliable
  - `AUTHORITY_OVERRIDE` = a major landmark (hospital, railway station, temple) is within 75m — this OVERRIDES the area type regardless of surrounding POIs
  - A DOMINANT RETAIL area is FAR more valuable for a fashion campaign than a WEAK_BIAS_TOWARD_RETAIL area

- **`confidence`** — How reliable the profiling data is:
  - `high` = 40+ POIs analyzed, 8+ distinct types found — trust this classification fully
  - `medium` = 20-40 POIs, 5-8 types — classification is reliable
  - `low` = fewer than 20 POIs (sparse/rural area) — treat area match with reduced weight, rely more on other signals

### Surrounding Context

- **`nearby`** — A pre-digested summary of POI groups within 500m, e.g. `"RETAIL:8, FOOD_BEVERAGE:6, OFFICE:5"`. Each number is the COUNT of POIs of that type found nearby.
  - Higher counts = denser, more commercial area
  - Use this to validate `primaryType` — if nearby says `RETAIL:8, FOOD:6` but primaryType is `OFFICE`, the area is actually more retail/food than pure office
  - For campaigns targeting specific audiences, check if relevant POI types appear in nearby, even if they're not the dominant type
  - Empty nearby means no POI data was available (very rural or data gap)

### Audience Behavior (who sees the screen and how)

- **`movement`** — The traffic pattern near the screen, derived from road type and intersection analysis:
  - `PEDESTRIAN` = walkable area, people on foot — they can STOP, READ, and ACT on the ad. Best for store_visit and offer_based campaigns
  - `STOP_AND_GO` = traffic signal or junction — vehicles stop for 60-90 seconds, drivers have TIME to read the ad. Great for awareness campaigns
  - `SLOW_FLOW` = internal roads, connectors — vehicles moving at 20-30 km/h, moderate attention. Decent for all objectives
  - `PASS_BY` = highway or major arterial — vehicles at 60+ km/h, minimal dwell time. Only works for large, bold creatives (brand awareness). Poor for detailed messaging

- **`dwell`** — How long people typically stay NEAR the screen, derived from area type + movement pattern:
  - `LONG_WAIT` = people wait here (hospitals, transit terminals, religious sites) — 10+ minutes average. Maximum ad exposure. Best for awareness campaigns
  - `MEDIUM_WAIT` = moderate stay (retail areas, food courts, offices) — 2-10 minutes. Good balance of exposure and action
  - `SHORT_WAIT` = people pass through quickly (highways, busy roads) — under 2 minutes. Only for simple, bold messages

### Screen Quality

- **`size`** — Screen dimensions in pixels (width × height). Larger screens are more visible and command more attention. Premium brands deserve larger screens.

- **`brightness`** — Screen brightness in nits. Higher nits = more visible in sunlight. Critical for outdoor screens (3000+ nits needed for sunny locations). Indoor screens typically have 500-1500 nits.

- **`env`** — Whether the screen is Indoor or Outdoor. Must match campaign type — outdoor campaigns on indoor screens make no sense, and vice versa.

### Eligibility

- **`restricted`** — List of ad categories blocked on this screen (e.g. `["alcohol", "tobacco"]`). If the campaign's ad_category falls in this list, the screen is INELIGIBLE — rank it LAST regardless of all other factors.

- **`available`** — Whether the screen has open time slots. Available screens should generally rank above unavailable ones.

## RANKING RULES

### 1. Area-to-Campaign Match (most important)
Use `primaryType` + `detail` + `nearby` together:
- `jewellery_luxury` → prefer RETAIL areas with DOMINANT/STRONG_BIAS, high RETAIL count in nearby
- `food_restaurants` → prefer screens with FOOD_BEVERAGE in nearby, PEDESTRIAN movement
- `health_hospitals` → prefer HEALTHCARE dominant areas
- `automobile` → prefer TRANSIT areas, PASS_BY movement, highway screens
- `education_coaching` → prefer EDUCATION areas, RESIDENTIAL in nearby
- `real_estate` → prefer high-traffic areas, OFFICE in nearby
- `beauty_salon_clinic` → prefer RETAIL areas
- `fashion_apparel` → prefer RETAIL areas with high RETAIL count in nearby
- `electronics_mobile` → prefer RETAIL areas
- `finance_insurance` → prefer FINANCE/OFFICE dominant areas
- `retail_fmcg` → prefer PEDESTRIAN movement, high total nearby count
- `general_services` → area match is less critical, focus on visibility

Weight the match by `detail`: DOMINANT > STRONG_BIAS > MODERATE_BIAS > WEAK_BIAS > DIVERSE
If `confidence` is "low", reduce the weight of area matching — rely more on movement, dwell, and screen quality instead.

### 2. Audience-to-Objective Match
- `awareness` → prefer LONG_WAIT dwell + STOP_AND_GO movement (max ad viewing time)
- `store_visit` → prefer PEDESTRIAN movement + right area type (people can walk to the store)
- `product_launch` → prefer large screens, high brightness, high-traffic areas
- `offer_based` → prefer PEDESTRIAN movement (people can immediately act on offers)

### 3. Screen Quality
- Premium brands → bigger `size`, higher `brightness`
- Local SMBs → right area match matters more than screen quality
- Outdoor campaigns → higher `brightness` ranks higher
- Match `env` to campaign context

### 4. Restrictions
- If `restricted` blocks the ad_category → rank LAST regardless of other factors

### 5. Availability
- Available screens (`available` = true) generally rank above unavailable ones

## IMPORTANT
- Rank ALL screens, do not skip any
- Do NOT use price for ranking — rank by RELEVANCE only
- Score HONESTLY — 90+ means near-perfect match, 50 means average, below 30 means poor fit

## SCORING RUBRIC — 5 CATEGORIES (mandatory)
Every screen MUST be scored across ALL 5 categories. The total_score is the sum.

| Category | Max | What to evaluate |
|---|---|---|
| area_match | 30 | primaryType + detail + confidence vs ad_category |
| audience_fit | 25 | movement + dwell vs brand_objective + target_audience demographics (e.g., young professionals → office/retail areas, families → residential/entertainment) |
| screen_quality | 20 | size + brightness + env suitability |
| context_bonus | 15 | nearby POIs relevance to the campaign + target_audience alignment |
| eligibility | 10 | available + not restricted |

## REASONING STYLE — CRITICAL
Each screen gets a SINGLE flowing narrative paragraph called "summary". This is the ONLY text the advertiser sees.

### TWO TIERS OF SUMMARIES:

**🏆 TOP 3 screens (ranked #1, #2, #3):**
- Write 2-3 sentences — warm, persuasive, confident
- Paint a SCENE — help the advertiser visualize their ad running at this location
- Be creative: vary your sentence structure, don't start every summary the same way
- Make the advertiser FEEL why this screen is right for their campaign

**📋 Screens ranked #4 and below:**
- Write just 1 short sentence — factual and neutral
- Just state where it is and what's nearby, no persuasion needed

### HOW TO WRITE:
Each screen has a `speak` object with human-language phrases:
- `speak.area` → area type description
- `speak.movement` → how people/vehicles move here
- `speak.dwell` → how long people stay
- `speak.nearby` → what's nearby (shops, food spots, etc.)

**Weave these speak phrases into the narrative creatively. Do NOT just list them in order.**

### RULES:
1. Use the `speak` phrases — do NOT write your own translations of the raw field values
2. Write ONLY about POSITIVES — skip any `speak` value that's empty
3. NEVER use: "but", "however", "although", "not the best fit", "may not"
4. NEVER cite specific numbers or counts
5. Connect the screen to the user's campaign (ad_category, brand_objective)
6. Do NOT mention cost, price, or budget
7. Vary your writing style — don't start every summary with "At [name], [city]"

### CREATIVE TIPS (for top 3):
- Start with the landmark or what makes the location special, not the screen name
- Use the campaign type to frame the story ("Your food ad..." / "For a brand awareness push...")
- Describe the audience behavior: "shoppers browsing", "commuters waiting", "moviegoers stepping out"
- End with a benefit statement tied to their campaign goal

### BAD — mechanical, repetitive, lists speak fields in order:
❌ "At Madurai Kalavasal Screen, Madurai — vehicles pause at a nearby signal. People spend some time browsing. With shops and food spots nearby."
❌ "At Vetri Cinemas, Madurai — vehicles pause at a nearby signal. People tend to stay for a while. With shops nearby."

### GOOD — creative, varied, paints a scene:
🏆 TOP 3 examples:
✅ "Near Meenakshi Temple in the heart of Madurai, Kalavasal Market buzzes with shoppers browsing through retail stores and grabbing food. Your food ad fits right in — this is a walkable area where people linger, giving your campaign real attention."
✅ "Commuters at Chennai Egmore railway station wait at signals right in front of this screen — giving your brand repeated, unhurried exposure in a shopping area with food spots and retail all around."
✅ "At Vetri Cinemas, Madurai — moviegoers and shoppers pass through at a relaxed pace. With food spots and retail nearby, your food ad reaches people who are already thinking about their next meal."

📋 #4+ examples:
✅ "Madurai Railway Station — a commuter hub with vehicles pausing at nearby signals."
✅ "Tambaram Sanatorium, Chennai — a transit area near Government Hospital."

## OUTPUT FORMAT (strict JSON)
```json
{{
  "ranking": [best_screen_id, second_best_id, ...],
  "scores": {{
    "screen_id": {{
      "total": 85,
      "area_match": 28,
      "audience_fit": 22,
      "screen_quality": 15,
      "context_bonus": 12,
      "eligibility": 8,
      "summary": "Right in the heart of Kalavasal Market, Madurai — near Meenakshi Temple — this screen catches shoppers walking slowly through a busy retail zone. Your food ad gets real eye time here, and with 8 food spots nearby, people are already thinking about what to eat."
    }}
  }}
}}
```

## SCREENS TO RANK
{screens_data}
"""


def build_call2_system_prompt(
    screens_data: str,
    ad_category: str = '',
    product_category: str = '',
    brand_objective: str = '',
    target_audience: str = '',
    persona: str = '',
    user_message: str = '',
) -> str:
    """
    Build the full Call #2 system prompt with campaign context and screen data.
    """
    return CALL2_SYSTEM_PROMPT.format(
        screens_data=screens_data,
        ad_category=ad_category or 'not specified',
        product_category=product_category or 'not specified',
        brand_objective=brand_objective or 'not specified',
        target_audience=target_audience or 'not specified',
        persona=persona or 'not specified',
        user_message=user_message or '',
    )
