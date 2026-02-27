# Inventory Capacity Check API — Backend Implementation Plan

## Goal

Build a new API endpoint that checks whether a user's selected screen slots are still available at the time of proposal lock. This prevents race conditions where another buyer books the same slots while the current user was deciding.

---

## Context

The platform already has a **Screen Discovery API** at:
```
POST http://192.168.31.226:8000/api/console/screens/discover/
```

This returns all available screens for a city, date range, and budget. Each screen in the response includes:
- `id` — screen database ID
- `screen_name` — display name
- `available_slots` — how many slots are currently free for the given date range
- `total_slots_per_loop` — total loop slots on the screen
- `base_price_per_slot_inr` — price per slot per day

The capacity check API is a **separate, new endpoint** on the **same server (port 8000)**. It reuses the same screen/slot availability data but performs a targeted check on only the user's selected screens.

---

## Business Logic

### What This API Checks

For each screen the user selected:
```
current_available_slots >= user_requested_slots  →  PASS
current_available_slots <  user_requested_slots  →  FAIL
```

The user does NOT own specific slot IDs. They only need "enough capacity" on that screen.

### Example

| Screen | Available When User Saw | Available Now | User Wants | Result |
|--------|------------------------|---------------|------------|--------|
| Screen A | 14 slots | 10 slots | 3 | ✅ Pass (10 ≥ 3) |
| Screen B | 8 slots | 2 slots | 3 | ❌ Fail (2 < 3) |
| Screen C | 5 slots | 5 slots | 1 | ✅ Pass (5 ≥ 1) |

Overall result: **FAIL** (because Screen B failed)

---

## API Specification

### Endpoint
```
POST http://192.168.31.226:8000/api/console/screens/capacity-check/
```

### Request Payload
```json
{
  "location": ["chennai"],
  "start_date": "2026-02-17",
  "end_date": "2026-03-28",
  "budget_range": "30000000000000",
  "booked_screens": [
    {
      "screen_id": 42,
      "slots_booked": 3
    },
    {
      "screen_id": 15,
      "slots_booked": 1
    }
  ]
}
```

### Fields Explanation

| Field | Type | Description |
|-------|------|-------------|
| `location` | array of strings | City names (same as discover API) |
| `start_date` | string (YYYY-MM-DD) | Campaign start date |
| `end_date` | string (YYYY-MM-DD) | Campaign end date |
| `budget_range` | string | Budget (same as discover API) |
| `booked_screens` | array of objects | Screens the user selected |
| `booked_screens[].screen_id` | integer | Screen database ID (the `id` field from discover response) |
| `booked_screens[].slots_booked` | integer | How many slots the user wants on this screen |

---

### Response — All Checks Pass
```json
{
  "status": "success",
  "capacity_ready": true,
  "screens": [
    {
      "screen_id": 42,
      "screen_name": "Tambaram Sanatorium",
      "available_slots": 14,
      "requested_slots": 3,
      "passed": true
    },
    {
      "screen_id": 15,
      "screen_name": "Anna Nagar Signal",
      "available_slots": 8,
      "requested_slots": 1,
      "passed": true
    }
  ]
}
```

### Response — Some Screens Fail
```json
{
  "status": "success",
  "capacity_ready": false,
  "screens": [
    {
      "screen_id": 42,
      "screen_name": "Tambaram Sanatorium",
      "available_slots": 2,
      "requested_slots": 3,
      "passed": false
    },
    {
      "screen_id": 15,
      "screen_name": "Anna Nagar Signal",
      "available_slots": 8,
      "requested_slots": 1,
      "passed": true
    }
  ]
}
```



### Response — Validation Error
```json
{
  "status": "error",
  "message": "Missing required fields: start_date, booked_screens"
}
```

---

## Implementation Steps

### Step 1: Add URL Route

Add a new URL pattern to the same app that has the discover endpoint.

```python
# In urls.py (same file as screens/discover/)
path('api/console/screens/capacity-check/', CapacityCheckView.as_view(), name='capacity-check'),
```

### Step 2: Create the View

```python
# In views.py

class CapacityCheckView(APIView):
    """
    Inventory Capacity Check for Proposal Lock (Page C7).
    
    Checks if user's selected screen slots are still available.
    """
    
    def post(self, request):
        # 1. Extract and validate request data
        location = request.data.get('location', [])
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        budget_range = request.data.get('budget_range')
        booked_screens = request.data.get('booked_screens', [])
        
        # 2. Validate required fields
        if not start_date or not end_date or not booked_screens:
            return Response({
                'status': 'error',
                'message': 'Missing required fields: start_date, end_date, booked_screens'
            }, status=400)
        
        # 3. For each booked screen, query current availability
        #    Use the SAME availability calculation logic as the discover API
        #    Only query the screens in booked_screens, not all screens
        
        # 4. Compare: current_available_slots >= slots_booked
        
        # 5. Build response with per-screen results
        
        # 6. Set capacity_ready = True only if ALL screens pass
```

### Step 3: Reuse Availability Logic

The key is to reuse the **same availability calculation** that the discover endpoint uses. Do NOT write separate availability logic — it must produce the same numbers.

**Approach:**
- Extract the availability calculation from the discover view into a shared utility function
- Call this utility for only the specific screen IDs the user booked
- Compare the returned `available_slots` against `slots_booked`

### Step 4: Add CORS Headers

The frontend is at `localhost:5174`. Ensure this new endpoint has the same CORS configuration as the discover endpoint.

---

## Important Rules

1. **Reuse the same availability calculation as discover** — Do not create a different way to count available slots. The numbers must match exactly.

2. **Only query the user's screens** — Don't re-run the full discovery. Just check the specific screens in `booked_screens[]`.

3. **The check is: `available_slots >= slots_booked`** — The user doesn't own specific slot IDs. They just need enough capacity.

4. **No state changes** — This endpoint only READS data. It does NOT create holds, snapshots, or lock anything. It's purely a check.

6. **Same date range context** — Use `start_date` and `end_date` to calculate availability for the correct period.

---

## Testing Checklist

- [ ] Returns `capacity_ready: true` when all screens have enough slots
- [ ] Returns `capacity_ready: false` when any screen has insufficient slots
- [ ] Returns correct `available_slots` for each screen (matches discover API numbers)
- [ ] Handles missing fields with 400 error
- [ ] Handles non-existent screen_id gracefully
- [ ] Handles empty `booked_screens` array
- [ ] CORS allows requests from `localhost:5174`
- [ ] Response time is fast (only queries specific screens, not full inventory)
