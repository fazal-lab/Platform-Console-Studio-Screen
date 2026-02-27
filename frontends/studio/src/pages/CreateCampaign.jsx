import { useState, useEffect, useRef, useCallback } from 'react'
import { loadGoogleMaps } from '../utils/googleMapsLoader'
import { Container, Row, Col } from 'react-bootstrap'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import { useLocation, useNavigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Header from '../components/Header'
import ScreenDetailsModal from '../components/ScreenDetailsModal'
import CompareScreensModal from '../components/CompareScreensModal'
import axios from 'axios'
import { API_BASE_URL } from '../config'
import AlertModal from '../components/Common/AlertModal'
import '../styles/dashboard.css'
import '../styles/createCampaign.css'

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function CreateCampaign() {
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('map')
  const [guidedMode, setGuidedMode] = useState('manual')
  const [selectedObjective, setSelectedObjective] = useState('')
  const [chatMessage, setChatMessage] = useState('')
  const [gatewayId, setGatewayId] = useState(null)
  const [campaignId, setCampaignId] = useState(null)
  const [isGatewaySubmitted, setIsGatewaySubmitted] = useState(false)
  const [isEditingGate, setIsEditingGate] = useState(false)
  // Draft state for inline gate editing (prevents premature API calls)
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')
  const [draftCity, setDraftCity] = useState([])
  const [draftBudget, setDraftBudget] = useState('')
  // Tag dropdown state for location
  const [locationInput, setLocationInput] = useState('')
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false)
  const [placeSuggestions, setPlaceSuggestions] = useState([])
  const autocompleteServiceRef = useRef(null)
  const [cityMarkers, setCityMarkers] = useState([])
  const [mapSearchInput, setMapSearchInput] = useState('')
  const [mapSearchSuggestions, setMapSearchSuggestions] = useState([])
  const [mapSearchTarget, setMapSearchTarget] = useState(null)
  const locationDropdownRef = useRef(null)
  const [chatHistory, setChatHistory] = useState([])

  // XIA Agent API state
  const [xiaSessionId, setXiaSessionId] = useState(null)
  const [xiaLoading, setXiaLoading] = useState(false)
  const [xiaQuickReplies, setXiaQuickReplies] = useState([])
  const [xiaPersona, setXiaPersona] = useState('')
  const [xiaIntent, setXiaIntent] = useState('')
  const [xiaFilters, setXiaFilters] = useState({})
  const [xiaScreenCounts, setXiaScreenCounts] = useState(null)
  const [xiaStatus, setXiaStatus] = useState({ status: 'online', warnings: [] }) // 'online' | 'degraded'
  const chatEndRef = useRef(null)

  // Map and location states
  const [locations, setLocations] = useState([])
  const [selectedLocations, setSelectedLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [recommendedScreens, setRecommendedScreens] = useState([])
  const [budgetEstimate, setBudgetEstimate] = useState(0)
  const [locationsError, setLocationsError] = useState('')
  const mapCanvasRef = useRef(null)
  const [isScreenModalOpen, setIsScreenModalOpen] = useState(false)
  const [screenModalMode, setScreenModalMode] = useState('view') // 'view' | 'compare'
  const [activeScreen, setActiveScreen] = useState(null)
  const [showXiaInModal, setShowXiaInModal] = useState(false)
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [isCreateBundleOpen, setIsCreateBundleOpen] = useState(false)
  const [bundleCampaignName, setBundleCampaignName] = useState('')
  const [bundleError, setBundleError] = useState('')

  // Manual mode states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [insightOption, setInsightOption] = useState('without')
  const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error' })
  const [datesConfirmed, setDatesConfirmed] = useState(false)
  const [campaignDays, setCampaignDays] = useState(0)
  const [dateRangeText, setDateRangeText] = useState('')
  const [showDateInputs, setShowDateInputs] = useState(true)
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]) // India center
  const [mapZoom, setMapZoom] = useState(5)

  // Filter states for manual mode
  const [locationData, setLocationData] = useState([]) // Full nested structure from API
  const [selectedState, setSelectedState] = useState([])
  const [selectedDistrict, setSelectedDistrict] = useState([])
  const [selectedCity, setSelectedCity] = useState([])

  const [selectedLocality, setSelectedLocality] = useState([])
  const [filteredLocations, setFilteredLocations] = useState([]) // Filtered locations for display

  // Campaign creation states
  const [campaignName, setCampaignName] = useState('')
  const [campaignObjective, setCampaignObjective] = useState('Awareness')
  const [campaignBudget, setCampaignBudget] = useState('')
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [campaignCreated, setCampaignCreated] = useState(false)
  const [manualLocation, setManualLocation] = useState('') // For manual location input

  // Slot Management State
  const [slotCount, setSlotCount] = useState({});
  const [slotAvailability, setSlotAvailability] = useState({});
  const [userBookedSlots, setUserBookedSlots] = useState({});

  // Computed Values
  const selectedLocationObjects = selectedLocations
    .map(id => (filteredLocations.find(l => l.id === id) || locations.find(l => l.id === id)))
    .filter(Boolean)
  const totalSelectedSlots = selectedLocationObjects.reduce((sum, s) => sum + (slotCount?.[s.id] || 0), 0)
  const recommendedCount = Math.min(5, (filteredLocations || []).length || 0)

  // Close location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
        setIsLocationDropdownOpen(false)
        setPlaceSuggestions([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initialize Google Maps Autocomplete service
  useEffect(() => {
    loadGoogleMaps()
      .then((maps) => {
        autocompleteServiceRef.current = new maps.places.AutocompleteService()
      })
      .catch((err) => console.warn('Google Maps Places unavailable:', err.message))
  }, [])

  // Fetch place predictions when locationInput changes
  useEffect(() => {
    if (!locationInput.trim() || !autocompleteServiceRef.current) {
      setPlaceSuggestions([])
      return
    }
    const debounce = setTimeout(() => {
      autocompleteServiceRef.current.getPlacePredictions(
        { input: locationInput },
        (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setPlaceSuggestions(predictions.map(p => ({
              description: p.description,
              mainText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text || ''
            })))
          } else {
            setPlaceSuggestions([])
          }
        }
      )
    }, 300)
    return () => clearTimeout(debounce)
  }, [locationInput])

  // Geocode selected cities and update markers on the start-screen map
  useEffect(() => {
    if (!window.google?.maps?.Geocoder) return;
    const geocoder = new window.google.maps.Geocoder();
    const geocodeCity = (cityName) =>
      new Promise((resolve) => {
        geocoder.geocode({ address: cityName }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location;
            resolve({ name: cityName, lat: loc.lat(), lng: loc.lng() });
          } else {
            resolve(null);
          }
        });
      });

    (async () => {
      const markers = [];
      for (const city of selectedCity) {
        const existing = cityMarkers.find(m => m.name === city);
        if (existing) { markers.push(existing); continue; }
        const result = await geocodeCity(city);
        if (result) markers.push(result);
      }
      setCityMarkers(markers);
    })();
  }, [selectedCity])


  // --- Persistence Logic ---
  // This section ensures your progress is saved if you refresh the page.



  const STORAGE_KEY = 'xigi_campaign_draft';

  // --- Shortlist sync helper ---
  const syncShortlistToBackend = async (screenId, screenObj, slots) => {
    try {
      const token = localStorage.getItem('token')
      if (!token || !campaignId) return
      await axios.post(`/api/studio/campaign/${campaignId}/shortlist/`, {
        screen_id: String(screenId),
        screen_data: {
          name: screenObj?.name || '',
          city_name: screenObj?.city_name || '',
          district_name: screenObj?.district_name || '',
          price_per_day: screenObj?.price_per_day || 0,
          display_size: screenObj?.display_size || '',
        },
        slots: slots || 1,
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    } catch (err) {
      console.error('Shortlist sync error:', err)
    }
  }

  // State to track if restoration is complete
  const [isRestored, setIsRestored] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.gatewayId) setGatewayId(data.gatewayId);
        if (data.campaignId) setCampaignId(data.campaignId);
        if (data.isGatewaySubmitted) setIsGatewaySubmitted(data.isGatewaySubmitted);
        if (data.startDate) setStartDate(data.startDate);
        if (data.endDate) setEndDate(data.endDate);
        if (data.datesConfirmed) setDatesConfirmed(data.datesConfirmed);
        if (data.selectedCity) setSelectedCity(data.selectedCity);
        if (data.campaignBudget) setCampaignBudget(data.campaignBudget);
        if (data.selectedObjective) setSelectedObjective(data.selectedObjective);
        if (data.bundleCampaignName) setBundleCampaignName(data.bundleCampaignName);
        if (data.guidedMode) setGuidedMode(data.guidedMode);
        if (data.selectedLocations) setSelectedLocations(data.selectedLocations);
        if (data.slotCount) setSlotCount(data.slotCount);
        if (data.selectedState) setSelectedState(data.selectedState);
        if (data.selectedDistrict) setSelectedDistrict(data.selectedDistrict);
        if (data.selectedLocality) setSelectedLocality(data.selectedLocality);
        if (data.xiaSessionId) setXiaSessionId(data.xiaSessionId);
        if (data.selectedLocations && data.selectedLocations.length > 0) setViewMode('list');
      } catch (e) {
        console.error("Failed to restore campaign state", e);
      }
    }
    setIsRestored(true);
  }, []);

  useEffect(() => {
    if (!isRestored) return;

    const stateToSave = {
      gatewayId, campaignId, isGatewaySubmitted, startDate, endDate, datesConfirmed,
      selectedCity, campaignBudget, selectedObjective, bundleCampaignName,
      guidedMode, selectedLocations, slotCount,
      selectedState, selectedDistrict, selectedLocality,
      xiaSessionId
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [
    gatewayId, campaignId, isGatewaySubmitted, startDate, endDate, datesConfirmed,
    selectedCity, campaignBudget, selectedObjective, bundleCampaignName,
    guidedMode, selectedLocations, slotCount,
    selectedState, selectedDistrict, selectedLocality,
    xiaSessionId,
    isRestored
  ]);

  const clearPersistence = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGatewayId(null);
    setXiaSessionId(null);
  };

  // Sync selections to backend when they change

  const showStartScreen = !isGatewaySubmitted;

  // objectives are now dynamic from XIA API quick_replies

  const normalizeText = (value) => (value || '').toString().trim().toLowerCase()

  const formatSummaryDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }


  const applyLocationsToUI = (localities) => {
    setLocations(localities)
    setFilteredLocations(localities)

    // Initialize slot counts + availability, but do NOT wipe existing selections.
    // This lets us restore selection when navigating back from /campaign-bundle.
    setSlotCount(prev => {
      const next = { ...(prev || {}) }
      localities.forEach(locality => {
        if (next[locality.id] === undefined) next[locality.id] = 0
      })
      return next
    })
    setSlotAvailability(prev => {
      const next = { ...(prev || {}) }
      localities.forEach(locality => {
        next[locality.id] = locality.slot_info?.total_available_slots || 0
      })
      return next
    })
    setUserBookedSlots(prev => {
      const next = { ...(prev || {}) }
      localities.forEach(locality => {
        next[locality.id] = locality.slot_info?.user_booked_slots || 0
      })
      return next
    })

    // Clamp existing slotCount to current availability (handles restored values exceeding new availability)
    setSlotCount(prev => {
      const next = { ...prev }
      localities.forEach(locality => {
        const id = locality.id
        const available = locality.slot_info?.total_available_slots || 0
        const userBooked = locality.slot_info?.user_booked_slots || 0
        const maxAllowed = available + userBooked
        if (next[id] !== undefined && next[id] > maxAllowed) {
          next[id] = maxAllowed
        }
      })
      return next
    })

    setSelectedLocations(prev => {
      const ids = prev || []
      const allowed = new Set(localities.map(l => l.id))
      return ids.filter(id => allowed.has(id))
    })

    if (localities.length > 0) {
      setMapCenter([localities[0].latitude, localities[0].longitude])
      setMapZoom(11)
    }
  }

  // Restore state when coming back from /campaign-bundle
  useEffect(() => {
    const restore = routerLocation?.state?.restoreSelection
    if (!restore) return

    // Gateway + navigation state
    setStartDate(restore.startDate || '')
    setEndDate(restore.endDate || '')
    setDatesConfirmed(true)
    setIsGatewaySubmitted(true)
    setSelectedCity(restore.city ? [restore.city] : [])
    setSelectedObjective(restore.objective || '')
    setBundleCampaignName(restore.campaignName || '')
    setCampaignCreated(!!restore.campaignCreated)

    // Selection + slots
    const restoredIds = (restore.selectedScreens || []).map(s => s.id).filter(Boolean)
    setSelectedLocations(restoredIds)
    setSlotCount(restore.slotCount || {})

    // Ensure we land back on the selection step UI in list view
    setViewMode('list')
    // When coming back from bundle, keep Campaign Builder tab active for editing
    setGuidedMode('manual')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Handles slot changes for campaign creation
   * @param {string} markerId - The ID of the marker/location
   * @param {boolean} increment - Whether to increment or decrement the slot count
   */
  const handleSlotChange = (markerId, increment) => {
    setSlotCount(prev => {
      const current = prev[markerId] || 0;
      const availableSlots = slotAvailability[markerId] || 0;
      const userBooked = userBookedSlots[markerId] || 0;

      // Calculate the maximum allowed slots (available + already booked by user)
      const maxAllowedSlots = availableSlots + userBooked;

      let next = increment ? current + 1 : current - 1;

      // Ensure slot count stays within bounds
      if (next < 0) {
        next = 0;
        return prev; // No change if already at minimum
      }

      // Check if trying to exceed available slots
      if (next > maxAllowedSlots) {
        // Optional: Add toast notification here
        return prev;
      }

      // If user is trying to reduce below their already booked slots
      if (increment === false && next < userBooked) {
        // Optional: Add toast notification here
        return prev;
      }

      // Keep selection in sync with slots:
      // - next > 0  => selected
      // - next === 0 => unselected (unless user already booked slots)
      setSelectedLocations(selPrev => {
        const isSelected = selPrev.includes(markerId)
        if (next > 0) return isSelected ? selPrev : [...selPrev, markerId]
        if (userBooked > 0) return selPrev
        return selPrev.filter(id => id !== markerId)
      })

      return { ...prev, [markerId]: next };
    });
  };

  // NOTE: Locations for the left Map/List are now driven by Gateway (dates + city)
  // so they work the same in both XIA Guided and Campaign Builder tabs.

  // ===== XIA Session Restore — hydrate from GET if returning user =====
  const [xiaSessionRestored, setXiaSessionRestored] = useState(false)
  useEffect(() => {
    if (!isRestored || !xiaSessionId || xiaSessionRestored) return
    if (!isGatewaySubmitted) return // No point restoring if gateway hasn't been submitted

    const restoreXiaSession = async () => {
      try {
        console.log('[XIA Restore] Attempting to restore session:', xiaSessionId)
        setXiaLoading(true)
        const response = await axios.get(`/xia/chat/${xiaSessionId}/`)
        const data = response.data

        console.log('[XIA Restore] Session restored successfully:', data)

        // Hydrate persona, intent, filters
        if (data.detected_persona) setXiaPersona(data.detected_persona)
        if (data.intent) setXiaIntent(data.intent)
        if (data.filters_applied?.xia_filters) setXiaFilters(data.filters_applied.xia_filters)
        if (data.quick_replies && Array.isArray(data.quick_replies)) setXiaQuickReplies(data.quick_replies)

        // Sync plan summary from XIA's current gateway state (source of truth)
        if (data.filters_applied?.gateway) {
          const gw = data.filters_applied.gateway
          if (gw.location && Array.isArray(gw.location)) setSelectedCity(gw.location)
          if (gw.start_date) setStartDate(gw.start_date)
          if (gw.end_date) setEndDate(gw.end_date)
          if (gw.budget_range) setCampaignBudget(String(gw.budget_range))
        }

        // Hydrate chat history from conversation history
        if (data.history && Array.isArray(data.history)) {
          const restoredChat = data.history.map(msg => ({
            type: msg.role === 'assistant' ? 'bot' : 'user',
            text: msg.content
          }))
          setChatHistory(restoredChat)
        }

        // Hydrate screens
        if (data.screens && Array.isArray(data.screens) && data.screens.length > 0) {
          const restoredLocalities = data.screens.map(mapScreenToInternal)
          applyLocationsToUI(restoredLocalities)
          setRecommendedScreens(restoredLocalities)

          setXiaScreenCounts({
            total: data.total_screens_found || restoredLocalities.length,
            available: data.available_screens ?? restoredLocalities.length,
            unavailable: data.unavailable_screens ?? 0
          })
        }

        setXiaSessionRestored(true)
      } catch (err) {
        if (err.response?.status === 404) {
          console.warn('[XIA Restore] Session expired or not found, starting fresh')
          setXiaSessionId(null) // Will clear from localStorage on next save
        } else {
          console.error('[XIA Restore] Error restoring session:', err)
        }
        setXiaSessionRestored(false)
      } finally {
        setXiaLoading(false)
        setLoading(false)
      }
    }

    restoreXiaSession()
  }, [isRestored, xiaSessionId, isGatewaySubmitted])

  // Fetch locations based on Gateway (dates). Works for both tabs.
  useEffect(() => {
    // Skip if session was already restored from GET
    if (xiaSessionRestored) return

    // Skip if we already have a session ID (restored from localStorage — let the restore effect handle it)
    if (xiaSessionId) return

    if (datesConfirmed && startDate && endDate && isGatewaySubmitted) {
      const fetchScreensViaXia = async () => {
        try {
          setLoading(true)
          setLocationsError('')

          // Get user_id from token verification
          const token = localStorage.getItem('token')
          let userId = localStorage.getItem('userId') || ''
          if (token) {
            try {
              const verifyRes = await axios.get('/api/studio/verify-token/', {
                headers: { 'Authorization': `Bearer ${token}` }
              })
              userId = String(verifyRes.data.user_id)
            } catch (verifyErr) {
              console.warn('[XIA] Token verify failed, using stored userId:', verifyErr.message)
            }
          }

          // Create draft campaign if we don't have one yet
          let activeCampaignId = campaignId
          if (!activeCampaignId && token) {
            try {
              const draftRes = await axios.post('/api/studio/campaign/create/', {
                campaign_name: `Draft – ${selectedCity?.[0] || 'Campaign'}`,
                location: (selectedCity || []).join(', '),
                start_date: startDate,
                end_date: endDate,
                booked_screens: {},
                price_snapshot: {},
                total_slots_booked: 0,
                total_budget: 0,
                budget_range: campaignBudget || 0,
              }, {
                headers: { 'Authorization': `Bearer ${token}` }
              })
              activeCampaignId = draftRes.data?.data?.campaign_id
              if (activeCampaignId) {
                console.log('[XIA] Draft campaign created:', activeCampaignId)
                setCampaignId(activeCampaignId)
              }
            } catch (draftErr) {
              console.error('[XIA] Draft campaign creation failed:', draftErr.response?.data || draftErr.message)
            }
          }

          // Send initial "hi" to XIA with gateway params
          const payload = {
            user_id: userId,
            campaign_id: activeCampaignId || '',
            gateway: {
              start_date: startDate,
              end_date: endDate,
              location: selectedCity.length > 0 ? selectedCity : ['Chennai'],
              budget_range: campaignBudget || '50000',
            },
            message: 'hi',
          }

          console.log('[XIA] Initial gateway call:', JSON.stringify(payload))
          const response = await axios.post('/xia/chat/', payload, {
            headers: { 'Content-Type': 'application/json' }
          })
          console.log('[XIA] Initial response:', response.data)

          const { screens, session_id, reply, quick_replies, detected_persona, intent, filters_applied } = response.data

          // Store session_id for subsequent chat messages
          if (session_id) {
            setXiaSessionId(session_id)
          }

          // Store XIA metadata
          if (detected_persona) setXiaPersona(detected_persona)
          if (intent) setXiaIntent(intent)
          if (quick_replies && Array.isArray(quick_replies)) setXiaQuickReplies(quick_replies)
          if (filters_applied?.xia_filters) setXiaFilters(filters_applied.xia_filters)

          if (screens && Array.isArray(screens) && screens.length > 0) {
            const allLocalities = screens.map(mapScreenToInternal)

            applyLocationsToUI(allLocalities)

            // Store screen counts
            setXiaScreenCounts({
              total: response.data.total_screens_found || allLocalities.length,
              available: response.data.available_screens ?? allLocalities.length,
              unavailable: response.data.unavailable_screens ?? 0
            })

            // Reset dependent filters
            setSelectedState([])
            setSelectedDistrict([])
            setSelectedLocality([])
          } else {
            setLocationsError('No screens found for this location and date range.')
            applyLocationsToUI([])
          }

          // Check XIA health
          const w = getXiaWarnings(response.data)
          setXiaStatus(w.length > 0 ? { status: 'degraded', warnings: w } : { status: 'online', warnings: [] })

          // Show XIA greeting in chat (avoid duplicate if chat already has messages)
          if (reply) {
            setChatHistory(prev => {
              if (prev.length <= 1) {
                return [{ type: 'bot', text: reply }]
              }
              return prev
            })
          }
        } catch (error) {
          console.error('[XIA] Error fetching screens:', error)
          setLocationsError('Could not connect to XIA. Please check your network.')
          setXiaStatus({ status: 'offline', warnings: ['Cannot reach XIA server'] })
          applyLocationsToUI([])
        } finally {
          setLoading(false)
        }
      }

      fetchScreensViaXia()
    } else if (!datesConfirmed || !isGatewaySubmitted) {
      // If we're navigating back from /campaign-bundle with a restore payload,
      // do NOT clear selections in the same commit (restore effect runs after render).
      // Otherwise it wipes out the restored screens/slots.
      if (routerLocation?.state?.restoreSelection) return

      // Clear locations when dates are not confirmed
      setLocations([])
      setFilteredLocations([])
      setSelectedLocations([])
      setLocationData([])
      // Clear slot counts
      setSlotCount({})
      setSlotAvailability({})
      setUserBookedSlots({})
    }
  }, [datesConfirmed, startDate, endDate, isGatewaySubmitted, selectedCity, xiaSessionId, xiaSessionRestored])

  // Calculate campaign days
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1
      setCampaignDays(days)
    } else {
      setCampaignDays(0)
    }
  }, [startDate, endDate])

  // Calculate budget estimate based on selected locations and slot counts
  useEffect(() => {
    if (selectedLocations.length === 0) {
      setBudgetEstimate(0)
      return
    }

    // Use actual campaign days if in manual mode, otherwise default to 7
    const days = campaignDays > 0 ? campaignDays : 7
    const total = selectedLocations.reduce((sum, locId) => {
      // Find the location object
      const loc = filteredLocations.find(l => l.id === locId)
      if (!loc) return sum

      // Get slot count for this location (default to 1 if not set)
      const slots = slotCount[locId] ?? 1

      // Always calculate from price_per_day to ensure inclusive day count
      const pricePerDay = parseFloat(loc.price_per_day || 0)
      const locationTotal = pricePerDay * days * slots
      return sum + locationTotal
    }, 0)

    setBudgetEstimate(total)
  }, [selectedLocations, campaignDays, slotCount, filteredLocations])

  // Convert lat/lng to map coordinates (simple projection)
  const getMapPosition = (lat, lng) => {
    // India bounds approximately: lat 6-37, lng 68-98
    // Map canvas is relative positioning
    const minLat = 6
    const maxLat = 37
    const minLng = 68
    const maxLng = 98

    // Normalize to 0-100%
    const x = ((lng - minLng) / (maxLng - minLng)) * 100
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100

    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  // --- Helper: detect XIA degraded responses ---
  const getXiaWarnings = (responseData) => {
    const warnings = []
    // Check for explicit warnings from XIA backend
    if (responseData.warnings && Array.isArray(responseData.warnings)) {
      warnings.push(...responseData.warnings)
    }
    // Check call metadata for failures (rate limits, errors)
    const checkMeta = (meta, callName) => {
      if (!meta) return
      if (meta.error) warnings.push(`${callName}: ${meta.error}`)
      if (meta.fallback) warnings.push(`${callName} used fallback — AI features may be limited`)
    }
    checkMeta(responseData.call1_meta, 'Understanding')
    checkMeta(responseData.call2_meta, 'Ranking')
    checkMeta(responseData.call3_meta, 'Response')
    return warnings
  }

  // --- Helper: convert API screen to internal format ---
  const mapScreenToInternal = useCallback((screen) => {
    const fmtLabel = (val) => {
      if (!val) return '';
      return val.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };
    return {
      id: screen.id,
      name: screen.screen_name || 'Unnamed Screen',
      latitude: parseFloat(screen.latitude || 13.0827),
      longitude: parseFloat(screen.longitude || 80.2707),
      price_per_day: parseFloat(screen.base_price_per_slot_inr || 0),
      price_info: {
        adjusted_avg_price: parseFloat(screen.base_price_per_slot_inr || 0),
        total_price: parseFloat(screen.estimated_cost_for_period || 0)
      },
      screen_id: screen.screen_id || screen.uid,
      display_size: `${screen.screen_width || 0}x${screen.screen_height || 0} ft`,
      display_brief: screen.full_address || '',
      main_image_url: screen.screen_image_front ? `/api/console/media${screen.screen_image_front}` : null,
      images: [
        screen.screen_image_front ? `/api/console/media${screen.screen_image_front}` : null,
        screen.screen_image_back ? `/api/console/media${screen.screen_image_back}` : null,
        screen.screen_image_long ? `/api/console/media${screen.screen_image_long}` : null
      ].filter(Boolean),
      slot_info: {
        total_available_slots: screen.available_slots || 0,
        total_slots: screen.total_slots_per_loop || 0,
        user_booked_slots: 0
      },
      city_name: screen.city || 'Chennai',
      district_name: screen.district || '',
      state_name: screen.state || '',
      environment: screen.environment || 'Outdoor',
      technology: screen.technology || 'LED',
      screen_type: screen.screen_type || 'Billboard',
      orientation: fmtLabel(screen.orientation || 'LANDSCAPE'),
      standard_ad_duration_sec: screen.standard_ad_duration_sec || 10,
      available_slots: screen.available_slots || 0,
      total_slots_per_loop: screen.total_slots_per_loop || 0,
      status: screen.status || '',
      dominantGroup: fmtLabel(screen.ai_profile?.area?.dominantGroup || ''),
      areaContext: screen.ai_profile?.area?.context || '',
      movementType: fmtLabel(screen.ai_profile?.movement?.type || ''),
      dwellCategory: fmtLabel(screen.ai_profile?.dwellCategory || ''),
      dwellScore: screen.ai_profile?.dwellScore ? Math.round(screen.ai_profile.dwellScore * 100) : 0,
      resolution: (screen.resolution_width && screen.resolution_height) ? `${screen.resolution_width}x${screen.resolution_height}` : '',
      brightness: screen.brightness_nits ? `${screen.brightness_nits} nits` : '',
      mounting: (screen.installation_type || screen.mounting_height_ft) ? `${screen.installation_type || 'Mounted'} · ${Math.round(parseFloat(screen.mounting_height_ft || 0))} ft` : '',
      category_restrictions: screen.restricted_categories_json || [],
      unavailability_reason: screen.unavailability_reason || null,
      next_available_date: screen.next_available_date || null,
      slots_freeing_up: screen.slots_freeing_up || null,
      // Scheduled block / availability fields
      scheduled_block_date: screen.scheduled_block_date || null,
      is_available: screen.is_available !== undefined ? screen.is_available : true,
      available_until: screen.available_until || null,
      // AI Ranking fields (from XIA Chat API Call #2)
      relevance_score: screen.relevance_score ?? null,
      ranking_reason: screen.ranking_reason || '',
      // Block warning (XIA or Discover)
      block_warning: screen.block_warning || null,
    };
  }, []);

  // --- XIA Agent API helper ---
  const sendToXiaAgent = useCallback(async (messageText) => {
    if (!messageText || !messageText.trim()) return

    const token = localStorage.getItem('token')
    if (!token) {
      setChatHistory(prev => [...prev, { type: 'bot', text: 'Unable to identify user. Please log out and log back in.' }])
      return
    }

    // Fetch user_id from studio_customuser via backend (not localStorage)
    let userId
    try {
      console.log('[XIA] Step 1: Fetching user_id from /api/verify-token/...')
      const verifyRes = await axios.get('/api/studio/verify-token/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      userId = String(verifyRes.data.user_id)
      console.log('[XIA] Step 1 OK: user_id =', userId)
    } catch (err) {
      console.error('[XIA] Step 1 FAILED: verify-token error', err.response?.status, err.response?.data)
      setChatHistory(prev => [...prev, { type: 'bot', text: 'Session expired. Please log out and log back in.' }])
      return
    }

    // Add user message to chat
    setChatHistory(prev => [...prev, { type: 'user', text: messageText }])
    setXiaLoading(true)

    try {
      let payload

      if (xiaSessionId) {
        // Follow-up message — include session_id, omit gateway
        payload = {
          session_id: xiaSessionId,
          user_id: userId,
          message: messageText,
        }
      } else {
        // First message — include gateway context, no session_id
        // Ensure we have a campaign_id (create draft if gateway didn't create one)
        let activeCampaignId = campaignId
        if (!activeCampaignId) {
          console.log('[XIA] No campaignId found, creating draft campaign...')
          try {
            const draftRes = await axios.post('/api/studio/campaign/create/', {
              campaign_name: `Draft – ${selectedCity?.[0] || 'Campaign'}`,
              location: (selectedCity || []).join(', '),
              start_date: startDate,
              end_date: endDate,
              booked_screens: {},
              price_snapshot: {},
              total_slots_booked: 0,
              total_budget: 0,
              budget_range: campaignBudget || 0,
            }, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            activeCampaignId = draftRes.data?.data?.campaign_id
            if (activeCampaignId) {
              console.log('[XIA] Draft campaign created:', activeCampaignId)
              setCampaignId(activeCampaignId)
            }
          } catch (draftErr) {
            console.error('[XIA] Draft campaign creation failed:', draftErr.response?.data || draftErr.message)
          }
        }

        if (!activeCampaignId) {
          setChatHistory(prev => [...prev, { type: 'bot', text: '⚠️ Could not create a campaign. Please try again or refresh the page.' }])
          setXiaLoading(false)
          return
        }

        payload = {
          user_id: userId,
          campaign_id: activeCampaignId,
          gateway: {
            start_date: startDate,
            end_date: endDate,
            location: selectedCity.length > 0 ? selectedCity : ['Chennai'],
            budget_range: campaignBudget || '50000',
          },
          message: messageText,
        }
      }

      console.log('[XIA] Step 2: Sending payload to /xia/chat/', JSON.stringify(payload))

      const response = await axios.post(
        '/xia/chat/',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      )

      console.log('[XIA] Step 3: Response received', response.data)

      const { reply, session_id, screens, total_screens_found, available_screens, quick_replies, detected_persona, intent, filters_applied } = response.data

      // Store session_id from first response
      if (session_id && !xiaSessionId) {
        setXiaSessionId(session_id)
      }

      // Store XIA metadata
      if (detected_persona) setXiaPersona(detected_persona)
      if (intent) setXiaIntent(intent)
      if (quick_replies && Array.isArray(quick_replies)) setXiaQuickReplies(quick_replies)
      if (filters_applied?.xia_filters) setXiaFilters(filters_applied.xia_filters)

      // Auto-update Active Plan Summary when XIA changes gateway
      if (response.data.gateway_updated && filters_applied?.gateway) {
        const gw = filters_applied.gateway
        console.log('[XIA] Gateway updated by XIA:', gw)

        // Update locations
        if (gw.location && Array.isArray(gw.location)) {
          setSelectedCity(gw.location)
        }
        // Update date range
        if (gw.start_date) setStartDate(gw.start_date)
        if (gw.end_date) setEndDate(gw.end_date)
        // Update budget
        if (gw.budget_range) setCampaignBudget(String(gw.budget_range))
      }

      // Add AI reply to chat
      setChatHistory(prev => [...prev, { type: 'bot', text: reply || 'No response from XIA.' }])

      // Check XIA health
      const w = getXiaWarnings(response.data)
      setXiaStatus(w.length > 0 ? { status: 'degraded', warnings: w } : { status: 'online', warnings: [] })

      // If XIA returned screens, REPLACE the map/list with XIA's screens
      if (screens && Array.isArray(screens) && screens.length > 0) {
        console.log('[XIA] Step 4: Replacing screens with', screens.length, 'XIA recommendations')
        const xiaLocalities = screens.map(mapScreenToInternal)

        // Preserve old ranking data for screens that didn't get re-ranked this turn
        // (Call #2 may be skipped on some intents)
        setLocations(prevLocations => {
          const oldRankingMap = {}
          prevLocations.forEach(loc => {
            if (loc.relevance_score != null && loc.relevance_score > 0) {
              oldRankingMap[loc.id] = { relevance_score: loc.relevance_score, ranking_reason: loc.ranking_reason }
            }
          })

          const merged = xiaLocalities.map(loc => {
            if ((loc.relevance_score == null || loc.relevance_score === 0) && oldRankingMap[loc.id]) {
              return { ...loc, ...oldRankingMap[loc.id] }
            }
            return loc
          })

          // Also update filteredLocations and slot states with merged data
          setFilteredLocations(merged)
          setSlotCount(prev => {
            const next = { ...(prev || {}) }
            merged.forEach(locality => {
              if (next[locality.id] === undefined) next[locality.id] = 0
            })
            return next
          })
          setSlotAvailability(prev => {
            const next = { ...(prev || {}) }
            merged.forEach(locality => {
              next[locality.id] = locality.slot_info?.total_available_slots || 0
            })
            return next
          })
          setUserBookedSlots(prev => {
            const next = { ...(prev || {}) }
            merged.forEach(locality => {
              next[locality.id] = locality.slot_info?.user_booked_slots || 0
            })
            return next
          })

          // Update recommended screen counter
          setRecommendedScreens(merged)

          return merged
        })

        // Store screen counts
        setXiaScreenCounts({
          total: total_screens_found || xiaLocalities.length,
          available: available_screens ?? xiaLocalities.length,
          unavailable: response.data.unavailable_screens ?? 0
        })

        // Reset filters since these are XIA-curated results
        setSelectedState([])
        setSelectedDistrict([])
        setSelectedLocality([])
      }
    } catch (error) {
      console.error('[XIA] FAILED at Step 2/3:', error.message, error.response?.status, error.response?.data)
      const errMsg = error.response?.data?.error || error.response?.data?.detail || error.response?.data?.message || 'Something went wrong. Please try again.'
      setChatHistory(prev => [...prev, { type: 'bot', text: `⚠️ ${errMsg}` }])
    } finally {
      setXiaLoading(false)
    }
  }, [xiaSessionId, campaignId, startDate, endDate, selectedCity, campaignBudget, mapScreenToInternal])

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, xiaLoading])

  const handleQuickReply = async (replyText) => {
    setXiaQuickReplies([]) // Clear quick replies after one is clicked
    await sendToXiaAgent(replyText)
  }

  const handleObjectiveSelect = async (objective) => {
    setSelectedObjective(objective)

    // Send objective to XIA agent
    await sendToXiaAgent(objective)

    // Also sync Brief to backend
    if (campaignId) {
      try {
        const token = localStorage.getItem('token')
        await axios.post(`/api/studio/campaign/${campaignId}/brief/`, {
          objective: objective,
          category: 'Retail',
          geo_narrowing: selectedCity?.[0] || '',
          cta_type: 'QR Code',
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        console.log('Brief synced to backend')
      } catch (err) {
        console.error('Brief sync error:', err)
      }
    }
  }

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      sendToXiaAgent(chatMessage.trim())
      setChatMessage('')
    }
  }

  const handleLocationClick = (location) => {
    const id = location.id
    setSelectedLocations(prev => {
      const isSelected = prev.includes(id)
      const userBooked = userBookedSlots[id] || 0
      const availableSlots = slotAvailability[id] || 0
      const maxAllowedSlots = availableSlots + userBooked

      if (isSelected) {
        // Unselect => slots go to 0 (unless user already booked slots)
        if (userBooked > 0) return prev
        setSlotCount(scPrev => ({ ...(scPrev || {}), [id]: 0 }))
        return prev.filter(locId => locId !== id)
      }

      // Select => ensure at least 1 slot (within availability)
      if (maxAllowedSlots <= 0) return prev
      setSlotCount(scPrev => {
        const current = scPrev?.[id] || 0
        const desired = Math.min(Math.max(current, 1, userBooked), maxAllowedSlots)
        return { ...(scPrev || {}), [id]: desired }
      })
      return [...prev, id]
    })
  }

  const openScreenModal = (location, mode = 'view', xiaSuggested = false) => {
    setActiveScreen(location)
    setScreenModalMode(mode)
    setShowXiaInModal(xiaSuggested)
    setIsScreenModalOpen(true)
  }

  const closeScreenModal = () => {
    setIsScreenModalOpen(false)
    setActiveScreen(null)
  }

  const handleAddToPlanFromModal = (location) => {
    if (!location) return
    // Guard: do not add unavailable/blocked screens
    const isScheduledBlock = location.status === 'SCHEDULED_BLOCK' && location.scheduled_block_date && endDate > location.scheduled_block_date
    const isExpired = location.status === 'SCHEDULED_BLOCK' && location.available_until && startDate > location.available_until
    if (isScheduledBlock || isExpired || location.available_slots === 0) return
    setSelectedLocations(prev => (prev.includes(location.id) ? prev : [...prev, location.id]))
    setSlotCount(prev => {
      const current = prev?.[location.id] || 0
      return { ...prev, [location.id]: Math.max(current, 1) }
    })
    closeScreenModal()
  }

  const closeCompare = () => setIsCompareOpen(false)

  const handleRecommendedScreens = () => {
    const ids = recommendedScreens.map(screen => screen.id)
    setSelectedLocations(ids)
    setSlotCount(prev => {
      const next = { ...(prev || {}) }
      ids.forEach((id) => {
        const userBooked = userBookedSlots[id] || 0
        const availableSlots = slotAvailability[id] || 0
        const maxAllowedSlots = availableSlots + userBooked
        if (maxAllowedSlots > 0) next[id] = Math.min(Math.max(next[id] || 0, 1, userBooked), maxAllowedSlots)
      })
      return next
    })
    setChatHistory([
      ...chatHistory,
      { type: 'bot', text: `I've selected ${recommendedScreens.length} recommended screens based on footfall and performance data.` }
    ])
  }

  const handleClearSelections = () => {
    setSelectedLocations([])
    setSlotCount({})
  }

  const updateSlotCount = (locId, delta) => {
    setSlotCount(prev => {
      const current = prev[locId] || 0
      const next = Math.max(0, current + delta)
      const userBooked = userBookedSlots[locId] || 0
      const available = slotAvailability[locId] || 0
      const maxAllowed = available + userBooked

      // If decrementing to 0, or below userBooked, we might want to prevent or handle it.
      // But for simplicity, we'll just clamp to [userBooked, maxAllowed] if delta is applied
      const finalValue = Math.min(Math.max(next, 0), maxAllowed)

      return { ...prev, [locId]: finalValue }
    })
  }

  // Manual mode handlers
  const handleConfirmDates = () => {
    if (startDate && endDate) {
      if (endDate < startDate) {
        setAlert({ show: true, title: 'Invalid Dates', message: 'End date must be after start date', type: 'error' })
        return
      }

      const todayStr = new Date().toISOString().split('T')[0]
      if (startDate < todayStr) {
        setAlert({ show: true, title: 'Invalid Dates', message: 'Start date cannot be in the past', type: 'error' })
        return
      }

      // Format dates as dd/mm/yyyy
      const formatDate = (date) => {
        const d = new Date(date)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
      }

      const formattedStart = formatDate(startDate)
      const formattedEnd = formatDate(endDate)
      setDateRangeText(`${formattedStart} - ${formattedEnd}`)
      setShowDateInputs(false)
      setDatesConfirmed(true)
    }
  }

  const handleEditDates = () => {
    setShowDateInputs(true)
    setDateRangeText('')
    setDatesConfirmed(false)
    setLocations([])
    setFilteredLocations([])
    setSelectedLocations([])
    setLocationData([])
    setSlotCount({})
    setSlotAvailability({})
    setUserBookedSlots({})
  }

  // Map view component — fit bounds to show all markers

  // Component to fly map to the latest city marker
  // Click on map to drop a pin and add city to gateway location field
  const MapClickHandler = ({ onLocationAdd }) => {
    useMapEvents({
      click(e) {
        if (!window.google?.maps?.Geocoder) return;
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: e.latlng.lat, lng: e.latlng.lng } }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const address = results[0].formatted_address;
            if (address) {
              onLocationAdd(address);
            }
          }
        });
      }
    });
    return null;
  };

  const FlyToCityMarkers = ({ markers }) => {
    const map = useMap();
    useEffect(() => {
      if (markers.length === 0) return;
      if (markers.length === 1) {
        map.flyTo([markers[0].lat, markers[0].lng], 12, { duration: 1.5 });
      } else {
        const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
      }
    }, [markers, map]);
    return null;
  };

  // Fly to a searched location on the map (search-only, no list add)
  const FlyToSearchTarget = ({ target }) => {
    const map = useMap();
    useEffect(() => {
      if (!target) return;
      map.flyTo([target.lat, target.lng], 13, { duration: 1.5 });
    }, [target, map]);
    return null;
  };

  const FitBoundsToMarkers = ({ locations }) => {
    const map = useMap()
    useEffect(() => {
      if (locations && locations.length > 0) {
        const bounds = L.latLngBounds(
          locations.map(loc => [loc.latitude, loc.longitude])
        )
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
      }
    }, [locations, map])
    return null
  }

  // Filter locations based on selected filters (works for both tabs)
  useEffect(() => {
    if (locations.length > 0) {
      let filtered = locations

      // Filter by state
      if (selectedState.length > 0) {
        filtered = filtered.filter(loc => selectedState.includes(loc.state_name))
      }

      // Filter by district
      if (selectedDistrict.length > 0) {
        filtered = filtered.filter(loc => selectedDistrict.includes(loc.district_name))
      }

      // City filtering is handled by the backend API — skip frontend filter
      // (screen.city may be in local language, e.g. "தாம்பரம்" for Tambaram)

      // Fallback: if filter yields nothing, keep full list (avoid blank map)
      setFilteredLocations(filtered.length > 0 ? filtered : locations)

      // Update map center to first filtered location if available
      const centerList = filtered.length > 0 ? filtered : locations
      if (centerList.length > 0) {
        setMapCenter([centerList[0].latitude, centerList[0].longitude])
      }
    } else {
      setFilteredLocations([])
    }
  }, [locations, selectedState, selectedDistrict, selectedCity])

  // Filter handlers
  const handleStateChange = (stateName) => {
    if (selectedState.includes(stateName)) {
      setSelectedState(selectedState.filter(s => s !== stateName))
      // Clear dependent filters
      setSelectedDistrict([])
      setSelectedCity([])
      setSelectedLocality([])
    } else {
      setSelectedState([...selectedState, stateName])
    }
  }

  const handleDistrictChange = (districtName) => {
    if (selectedDistrict.includes(districtName)) {
      setSelectedDistrict(selectedDistrict.filter(d => d !== districtName))
      // Clear dependent filters
      setSelectedCity([])
      setSelectedLocality([])
    } else {
      setSelectedDistrict([...selectedDistrict, districtName])
    }
  }

  const handleCityChange = (cityName) => {
    if (selectedCity.includes(cityName)) {
      setSelectedCity(selectedCity.filter(c => c !== cityName))
      // Clear dependent filters
      setSelectedLocality([])
    } else {
      setSelectedCity([...selectedCity, cityName])
    }
  }

  const handleLocalityChange = (localityName) => {
    if (selectedLocality.includes(localityName)) {
      setSelectedLocality(selectedLocality.filter(l => l !== localityName))
    } else {
      setSelectedLocality([...selectedLocality, localityName])
    }
  }

  const handleResetFilters = () => {
    setSelectedState([])
    setSelectedDistrict([])
    setSelectedCity([])
    setSelectedLocality([])
  }

  // Gateway Submit Handler
  const handleGatewaySubmit = async () => {
    if (!startDate || !endDate) {
      setAlert({ show: true, title: 'Missing Dates', message: 'Please select campaign dates', type: 'error' })
      return
    }

    if (endDate < startDate) {
      setAlert({ show: true, title: 'Invalid Dates', message: 'End date must be after start date', type: 'error' })
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    if (startDate < todayStr) {
      setAlert({ show: true, title: 'Invalid Dates', message: 'Start date cannot be in the past', type: 'error' })
      return
    }

    if (!selectedCity || selectedCity.length === 0) {
      setAlert({ show: true, title: 'Missing Location', message: 'Please select at least one city', type: 'error' })
      return
    }

    // --- Create a draft campaign in the database ---
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const draftName = `Draft - ${selectedCity?.[0] || 'Campaign'}`
        const draftPayload = {
          campaign_name: draftName,
          location: (selectedCity || []).join(', '),
          start_date: startDate,
          end_date: endDate,
          booked_screens: {},
          price_snapshot: {},
          total_slots_booked: 0,
          total_budget: 0,
          budget_range: campaignBudget || 0,
        }
        console.log('[Gateway] Creating draft campaign with:', JSON.stringify(draftPayload))

        const response = await axios.post('/api/studio/campaign/create/', draftPayload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        console.log('[Gateway] Draft campaign response:', response.data)
        const newCampaignId = response.data?.data?.campaign_id
        if (newCampaignId) {
          setCampaignId(newCampaignId)
          console.log('[Gateway] ✅ campaignId set to:', newCampaignId)
        } else {
          console.error('[Gateway] Response OK but no campaign_id in data:', response.data)
        }
      } catch (error) {
        console.error('[Gateway] ❌ Draft campaign creation failed:', error.response?.status, error.response?.data || error.message)
        setAlert({ show: true, title: 'Draft Creation Failed', message: `Could not create draft campaign: ${error.response?.data?.error || error.message}`, type: 'error' })
      }
    } else {
      console.warn('[Gateway] No token found, skipping draft creation')
    }

    setDatesConfirmed(true)
    setIsGatewaySubmitted(true)
    setGuidedMode('xia')
  }

  // When user clicks "Save and Continue", we save to backend and switch to Campaign Builder tab
  const handleFinalCreateCampaign = async () => {
    if (selectedLocationObjects.length === 0 || totalSelectedSlots === 0) {
      setAlert({ show: true, title: 'No Screens Selected', message: 'Please select at least one screen and slot to continue', type: 'error' })
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setGuidedMode('manual')
        return
      }

      // Prepare screen/slot data
      const selectionData = selectedLocations.map(id => ({
        id,
        slots: slotCount?.[id] || 0
      })).filter(s => s.slots > 0)

      // Calculate summary metrics
      const totalScreens = selectionData.length;
      const totalSlots = selectionData.reduce((sum, s) => sum + s.slots, 0);

      // Estimate budget (rough calculation based on selected locations)
      const totalBudget = selectedLocationObjects.reduce((sum, s) => {
        const slots = slotCount?.[s.id] || 0;
        return sum + ((s.price_per_day || 0) * slots * (campaignDays || 1));
      }, 0);

      // Only save if we have a gateway ID (which we should)
      if (gatewayId) {
        const campResponse = await axios.post('/api/studio/campaign/', {
          gateway: gatewayId,
          selected_screens: selectionData,
          total_screens: totalScreens,
          total_slots: totalSlots,
          total_budget: totalBudget
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        console.log('Campaign saved successfully')

        // Save campaignId if returned
        if (campResponse.data?.data?.id) {
          setCampaignId(campResponse.data.data.id)
        }

        // Sync shortlist items to backend
        const cid = campResponse.data?.data?.id || campaignId
        if (cid) {
          for (const sel of selectionData) {
            const screenObj = selectedLocationObjects.find(l => l.id === sel.id)
            await syncShortlistToBackend(sel.id, screenObj, sel.slots)
          }
        }
      }

      setGuidedMode('manual')

    } catch (error) {
      console.error('Error saving campaign:', error)
      setAlert({ show: true, title: 'Error', message: "Failed to save campaign. Please try again.", type: 'error' })
    }
  }

  const summaryObjective = selectedObjective || 'Brand Awareness'

  const openCreateBundle = () => {
    setBundleError('')
    // If campaign name already exists (e.g. returning from bundle page), go directly to bundle page.
    if ((bundleCampaignName || '').trim()) {
      submitCreateBundle()
      return
    }
    setIsCreateBundleOpen(true)
  }

  const closeCreateBundle = () => {
    setIsCreateBundleOpen(false)
    setBundleError('')
  }

  const submitCreateBundle = async () => {
    if (campaignCreated) return // Prevent duplicate creation

    const name = (bundleCampaignName || '').trim()
    if (!name) {
      setBundleError('Please enter your campaign name')
      return
    }
    if (selectedLocationObjects.length === 0 || totalSelectedSlots === 0) {
      setBundleError('Please select screens and slots before creating a bundle')
      return
    }

    // Update the existing draft campaign (PATCH), or create if no draft exists
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // Build booked_screens map: { screen_id: slot_count }
      const bookedScreens = {}
      // Build price_snapshot map: { screen_id: price_per_slot }
      const priceSnapshot = {}
      selectedLocations.forEach(id => {
        const slots = slotCount?.[id] || 0
        if (slots > 0) bookedScreens[id] = slots
        const screen = selectedLocationObjects.find(s => s.id === id)
        if (screen) priceSnapshot[id] = screen.price_per_day || 0
      })

      const totalSlots = Object.values(bookedScreens).reduce((sum, s) => sum + s, 0)
      const totalBudget = selectedLocationObjects.reduce((sum, s) => {
        const slots = slotCount?.[s.id] || 0
        return sum + ((s.price_per_day || 0) * slots * (campaignDays || 1))
      }, 0)

      let savedCampaignId = campaignId

      if (campaignId) {
        // Draft exists — update it with the campaign name and screen data
        const res = await axios.patch(`/api/studio/campaign/${campaignId}/update/`, {
          campaign_name: name,
          booked_screens: bookedScreens,
          price_snapshot: priceSnapshot,
          total_slots_booked: totalSlots,
          total_budget: totalBudget,
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        console.log('Campaign updated:', res.data)
        savedCampaignId = res.data?.data?.campaign_id || campaignId
      } else {
        // No draft — fall back to creating a new campaign
        const res = await axios.post('/api/studio/campaign/create/', {
          campaign_name: name,
          location: (selectedCity || []).join(', '),
          start_date: startDate,
          end_date: endDate,
          booked_screens: bookedScreens,
          price_snapshot: priceSnapshot,
          total_slots_booked: totalSlots,
          total_budget: totalBudget,
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        console.log('Campaign created:', res.data)
        savedCampaignId = res.data?.data?.campaign_id
      }
      if (savedCampaignId) {
        localStorage.setItem('lastCampaignId', savedCampaignId)
      }
      setCampaignCreated(true)
      closeCreateBundle()

      // Navigate to Plan Summary page
      navigate('/campaign-bundle', {
        state: {
          fromDashboard: true,
          campaignName: name,
          campaignId: savedCampaignId,
          bookedScreens,
          priceSnapshot,
          city: (selectedCity || []).join(', '),
          startDate,
          endDate,
          budgetRange: totalBudget,
        }
      })
    } catch (error) {
      console.error('Error creating campaign:', error)
      setBundleError('Failed to create campaign. Please try again.')
    }
  }

  return (
    <div className="app-container">
      <Header hideAskXia={showStartScreen} />

      <div className="create-campaign-container">
        {/* Left Panel - Workspace */}
        <div className="campaign-left-panel">
          {/* Sub Header */}
          <div className="campaign-subheader">
            <div className="subheader-title">Campaign</div>
            <div className="subheader-divider"></div>
            <div className="subheader-subtitle">Select screens to build your media plan</div>
          </div>

          {/* Toolbar (matches reference screenshot) */}
          <div className="campaign-toolbar">
            <div className="map-controls">
              <div className="map-control-group">
                <button
                  type="button"
                  className={`map-control-btn map-control-btn--separate ${viewMode === 'map' ? 'active' : ''}`}
                  onClick={() => setViewMode('map')}
                >
                  <i className="bi bi-map"></i>
                  <span>Map</span>
                </button>
                <button
                  type="button"
                  className={`map-control-btn map-control-btn--separate ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <i className="bi bi-list-ul"></i>
                  <span>List</span>
                </button>
              </div>
            </div>

            {!showStartScreen && (
              <>
                <div className="campaign-toolbar-divider" />

                <div className="campaign-filter-label">
                  <i className="bi bi-sliders"></i>
                  <span>Filter</span>
                </div>

                <select className="campaign-filter-select" defaultValue="">
                  <option value="" disabled>Category</option>
                  <option value="all">All</option>
                </select>

                <select className="campaign-filter-select" defaultValue="">
                  <option value="" disabled>Price range</option>
                  <option value="all">All</option>
                </select>

                <select className="campaign-filter-select" defaultValue="">
                  <option value="" disabled>Reach range</option>
                  <option value="all">All</option>
                </select>

                <div className="campaign-toolbar-spacer" />

                <div className="recommended-badge">
                  {recommendedCount} Screens Recommended
                </div>
              </>
            )}
          </div>

          {showStartScreen ? (
            <div className="campaign-start-screen" style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {viewMode === 'map' ? (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <MapContainer
                    center={[20.5937, 78.9629]}
                    zoom={5}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                    zoomControl={true}
                  >
                    <TileLayer attribution='&copy; Google Maps' url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                    <FlyToCityMarkers markers={cityMarkers} />
                    <FlyToSearchTarget target={mapSearchTarget} />
                    <MapClickHandler onLocationAdd={(city) => {
                      if (!selectedCity.includes(city)) {
                        setSelectedCity(prev => [...prev, city]);
                      }
                    }} />
                    {cityMarkers.map((marker, idx) => {
                      const pinIcon = L.divIcon({
                        className: 'custom-marker',
                        html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42"><path d="M15 0C6.72 0 0 6.72 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.72 23.28 0 15 0z" fill="#EA4335"/><circle cx="15" cy="14" r="6" fill="white"/></svg>`,
                        iconSize: [30, 42],
                        iconAnchor: [15, 42]
                      });
                      return (
                        <Marker key={marker.name} position={[marker.lat, marker.lng]} icon={pinIcon}>
                          <Popup>{marker.name}</Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                  {/* Map Search Box Overlay */}
                  <div style={{
                    position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 1000, width: '360px', maxWidth: '90%'
                  }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', background: '#fff',
                        borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        padding: '0 12px', height: '42px'
                      }}>
                        <i className="bi bi-search" style={{ color: '#666', marginRight: '8px', fontSize: '14px' }}></i>
                        <input
                          type="text"
                          placeholder="Search location on map..."
                          value={mapSearchInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMapSearchInput(val);
                            if (!val.trim() || !autocompleteServiceRef.current) {
                              setMapSearchSuggestions([]);
                              return;
                            }
                            autocompleteServiceRef.current.getPlacePredictions(
                              { input: val },
                              (predictions, status) => {
                                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                                  setMapSearchSuggestions(predictions.map(p => ({
                                    description: p.description,
                                    mainText: p.structured_formatting?.main_text || p.description,
                                    secondaryText: p.structured_formatting?.secondary_text || ''
                                  })));
                                } else {
                                  setMapSearchSuggestions([]);
                                }
                              }
                            );
                          }}
                          style={{
                            flex: 1, border: 'none', outline: 'none', fontSize: '14px',
                            background: 'transparent', color: '#333'
                          }}
                        />
                        {mapSearchInput && (
                          <i className="bi bi-x-lg" style={{ color: '#999', cursor: 'pointer', fontSize: '12px' }}
                            onClick={() => { setMapSearchInput(''); setMapSearchSuggestions([]); }} />
                        )}
                      </div>
                      {mapSearchSuggestions.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '46px', left: 0, right: 0,
                          background: '#fff', borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          maxHeight: '200px', overflowY: 'auto'
                        }}>
                          {mapSearchSuggestions.map((s, i) => (
                            <div key={i}
                              onClick={() => {
                                // Only pan the map, don't add to location list
                                if (!window.google?.maps?.Geocoder) return;
                                const geocoder = new window.google.maps.Geocoder();
                                geocoder.geocode({ address: s.description }, (results, status) => {
                                  if (status === 'OK' && results[0]) {
                                    const loc = results[0].geometry.location;
                                    setMapSearchTarget({ lat: loc.lat(), lng: loc.lng() });
                                  }
                                });
                                setMapSearchInput('');
                                setMapSearchSuggestions([]);
                              }}
                              style={{
                                padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                                borderBottom: i < mapSearchSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                            >
                              <div style={{ fontWeight: 500, color: '#333' }}>{s.mainText}</div>
                              {s.secondaryText && <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{s.secondaryText}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
                  <h2 className="start-title">Start with the basics to plan your campaign</h2>
                  <p className="start-subtitle">
                    Set your location, dates, and budget to see available screens.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {viewMode === 'map' ? (
                <div className="map-canvas" ref={mapCanvasRef}>
                  {loading ? (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#64748b', fontSize: '0.875rem', zIndex: 1000 }}>
                      Loading locations...
                    </div>
                  ) : filteredLocations.length === 0 ? (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#64748b', fontSize: '0.875rem', textAlign: 'center', zIndex: 1000 }}>
                      No locations found.
                    </div>
                  ) : (
                    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                      {locationsError && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          zIndex: 1000,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          pointerEvents: 'none'
                        }}>
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>
                          {locationsError}
                        </div>
                      )}
                      <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                        <FitBoundsToMarkers locations={filteredLocations} />
                        <TileLayer attribution='&copy; Google Maps' url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                        {filteredLocations.map((location, index) => {
                          const isSelected = selectedLocations.includes(location.id);
                          const customIcon = L.divIcon({
                            className: 'custom-marker',
                            html: `<div style="width: 2.5rem; height: 2.5rem; background-color: ${isSelected ? '#10b981' : '#2563eb'}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">${index + 1}</div>`,
                            iconSize: [40, 40],
                            iconAnchor: [20, 20]
                          });

                          const tooltipContent = `
                            <div style="min-width:220px;font-family:Poppins,sans-serif">
                              <div style="font-weight:700;font-size:0.875rem;margin-bottom:6px;color:#1E293B">${location.name}</div>
                              <div style="font-size:0.75rem;color:#64748B;margin-bottom:4px">
                                📍 ${location.city_name || ''} · ${location.environment || 'Outdoor'}
                              </div>
                              <div style="font-size:0.75rem;color:#64748B;margin-bottom:4px">
                                🖥 ${location.technology || ''} ${location.screen_type || ''} · ${location.orientation || ''}
                              </div>
                              <div style="font-size:0.75rem;color:#64748B;margin-bottom:6px">
                                📅 ${location.available_slots || 0} available · ${location.total_slots_per_loop || 0} total slots
                              </div>
                              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E2E8F0;padding-top:6px">
                                <span style="font-size:0.9rem;font-weight:700;color:#1E293B">₹${Math.round(parseFloat(location.price_per_day || 0)).toLocaleString()} <span style="font-size:0.7rem;font-weight:400;color:#94A3B8">Slot/day</span></span>
                                ${isSelected ? '<span style="font-size:0.7rem;padding:2px 8px;border-radius:4px;background:#D1FAE5;color:#059669;font-weight:600">✓ Selected</span>' : ''}
                              </div>
                            </div>`;

                          return (
                            <Marker
                              key={location.id || index}
                              position={[location.latitude, location.longitude]}
                              icon={customIcon}
                              eventHandlers={{
                                click: () => {
                                  // If screen is unavailable, open modal in view-only mode instead of toggling selection
                                  const isSchedBlock = location.status === 'SCHEDULED_BLOCK' && location.scheduled_block_date && endDate > location.scheduled_block_date
                                  const isExpired = location.status === 'SCHEDULED_BLOCK' && location.available_until && startDate > location.available_until
                                  const isLocUnavailable = isSchedBlock || isExpired || location.available_slots === 0
                                  if (isLocUnavailable) {
                                    openScreenModal(location, 'view', false)
                                  } else {
                                    handleLocationClick(location)
                                  }
                                },
                                mouseover: (e) => {
                                  e.target.bindTooltip(tooltipContent, {
                                    direction: 'top',
                                    offset: [0, -24],
                                    opacity: 0.95,
                                    className: 'map-screen-tooltip'
                                  }).openTooltip();
                                },
                                mouseout: (e) => {
                                  e.target.closeTooltip();
                                  e.target.unbindTooltip();
                                }
                              }}
                            />
                          );
                        })}
                      </MapContainer>
                    </div>
                  )}
                </div>
              ) : (
                <div className="locations-list-view">
                  {/* Screen Count Summary */}
                  {xiaScreenCounts && (
                    <div className="xia-screen-count-bar">
                      <span className="count-total"><i className="bi bi-display"></i> {xiaScreenCounts.total} screens found</span>
                      <span className="count-available"><i className="bi bi-check-circle"></i> {xiaScreenCounts.available} available</span>
                      {xiaScreenCounts.unavailable > 0 && (
                        <span className="count-unavailable"><i className="bi bi-x-circle"></i> {xiaScreenCounts.unavailable} unavailable</span>
                      )}
                    </div>
                  )}
                  <div className="locations-list-container">
                    {[...filteredLocations].sort((a, b) => {
                      // Sort unavailable / fully-booked screens to the bottom
                      const aUnavail = (a.available_slots === 0 || a.is_available === false || (a.status === 'SCHEDULED_BLOCK' && a.scheduled_block_date && endDate > a.scheduled_block_date) || (a.status === 'SCHEDULED_BLOCK' && a.available_until && startDate > a.available_until)) ? 1 : 0
                      const bUnavail = (b.available_slots === 0 || b.is_available === false || (b.status === 'SCHEDULED_BLOCK' && b.scheduled_block_date && endDate > b.scheduled_block_date) || (b.status === 'SCHEDULED_BLOCK' && b.available_until && startDate > b.available_until)) ? 1 : 0
                      return aUnavail - bUnavail
                    }).map((location, index) => {
                      const isSelected = selectedLocations.includes(location.id)
                      const pricePerDay = parseFloat(location.price_per_day || 0)
                      const locationLabel = `${location.city_name || 'Chennai'} · ${location.environment || 'Outdoor'}`

                      // Dynamic data from XIA ranking
                      const xiaScore = location.relevance_score;
                      const xiaReason = location.ranking_reason || '';
                      const hasXiaRanking = xiaScore != null && xiaScore > 0;
                      const isVerified = (location.status === 'VERIFIED');

                      // Unavailability logic
                      const isScheduledBlock = location.status === 'SCHEDULED_BLOCK' && location.scheduled_block_date && endDate > location.scheduled_block_date;
                      const isExpiredAvailability = location.status === 'SCHEDULED_BLOCK' && location.available_until && startDate > location.available_until;
                      const isBlocked = isScheduledBlock || isExpiredAvailability;
                      const isSlotUnavailable = !isBlocked && location.available_slots === 0;
                      const isUnavailable = isBlocked || isSlotUnavailable;

                      return (
                        <div
                          key={location.id || index}
                          className={`location-list-card ${isSelected ? 'selected' : ''} ${isUnavailable ? 'unavailable-card' : ''}`}
                          onClick={() => !isUnavailable && handleLocationClick(location)}
                          style={{ cursor: isUnavailable ? 'not-allowed' : 'pointer' }}
                        >
                          {/* Image Section */}
                          <div className="location-card-image-wrapper">
                            {(location.available_slots === 0 || isUnavailable) ? (
                              <div
                                className="location-card-checkbox-cross"
                                style={{
                                  width: '18px', height: '18px', borderRadius: '4px',
                                  background: '#ef4444',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  position: 'absolute', top: '8px', left: '8px', zIndex: 2,
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }}
                                title={isBlocked ? 'Unavailable' : 'Slot Unavailable'}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </div>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="location-card-checkbox"
                              />
                            )}
                            <img
                              src={location.main_image_url || location.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'}
                              alt={location.name}
                              className="location-card-image"
                            />
                          </div>

                          {/* Right Content Section (Wraps Top Row and XIA Box) */}
                          <div className="location-card-content">
                            <div className="location-card-top-row">
                              {/* Details Section */}
                              <div className="location-card-details">
                                <div className="location-card-header">
                                  <h3 className="location-kard-title">{location.name}</h3>
                                  <div className="location-tags">
                                    <span className="location-tag premium">{location.dominantGroup || 'Profiled'}</span>
                                    {isVerified && (
                                      <span className="location-tag verified">
                                        <i className="bi bi-patch-check-fill"></i> Verified
                                      </span>
                                    )}
                                    {isBlocked && (
                                      <span className="location-tag unavailable">
                                        <i className="bi bi-exclamation-triangle-fill"></i> Unavailable
                                      </span>
                                    )}
                                    {isSlotUnavailable && (
                                      <span className="location-tag unavailable">
                                        <i className="bi bi-exclamation-triangle-fill"></i> Slot Unavailable
                                      </span>
                                    )}
                                    {/* Scheduled Block tag */}
                                    {!isUnavailable && location.status === 'SCHEDULED_BLOCK' && location.available_until && endDate > location.available_until && (
                                      <span className="location-tag unavailable">
                                        <i className="bi bi-exclamation-triangle-fill"></i> Not Applicable
                                      </span>
                                    )}
                                  </div>
                                </div>



                                <div className="location-sub-details">
                                  <span className="location-type-text">
                                    <i className="bi bi-geo-alt"></i> {locationLabel}
                                  </span>
                                  <span className="divider-dot">•</span>
                                  <span className="location-tech-text">
                                    <i className="bi bi-display"></i> {location.technology} {location.screen_type}
                                  </span>
                                  <span className="divider-dot">•</span>
                                  <span className="location-orientation-text">
                                    <i className="bi bi-arrows-expand"></i> {location.orientation}
                                  </span>
                                </div>

                                <div className="location-metrics">
                                  <div className="metric-item">
                                    <i className="bi bi-clock-history"></i> {location.dwellCategory || 'Standard'}
                                  </div>
                                  <div className="metric-item">
                                    <i className="bi bi-person-walking"></i> {location.movementType || 'Steady Flow'}
                                  </div>
                                  <div className="metric-item">
                                    <i className="bi bi-stopwatch"></i> {location.standard_ad_duration_sec}s Standard Ad
                                  </div>
                                </div>
                              </div>

                              {/* Actions & Price Section */}
                              <div className="location-card-actions">
                                <div className="action-buttons-row">

                                  <button
                                    className="btn-view"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openScreenModal(location, 'view', index === 0)
                                    }}
                                  >
                                    <i className="bi bi-eye"></i> View
                                  </button>
                                </div>

                                <div className="slots-availability">
                                  {location.available_slots === 0 || isUnavailable ? (
                                    <div className="slots-unavailable-info">
                                      <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                        {isBlocked ? 'Unavailable' : 'Slot Unavailable'}
                                      </span>
                                    </div>
                                  ) : (
                                    <>{location.available_slots} available · {location.total_slots_per_loop} total slots</>
                                  )}
                                </div>

                                <div className="price-section">
                                  <span className="price-currency">₹</span>
                                  <span className="price-amount">{Math.round(pricePerDay).toLocaleString()}</span>
                                  <span className="price-unit"> Slot/day</span>
                                </div>
                              </div>
                            </div>

                            {/* XIA Reasoning Box - Full Width below Details & Actions */}
                            {hasXiaRanking && (
                              <div className="xia-reasoning-box">
                                <div className="xia-content">
                                  <div className="xia-title">
                                    <i className="bi bi-stars"></i> XIA Reasoning
                                  </div>
                                  <div className="xia-text">{xiaReason}</div>
                                </div>
                                <div className="xia-score">
                                  Score: <span className="score-value">{xiaScore}%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}


                  </div>
                </div>
              )}
            </div>
          )}

          {/* Floating Compare button (bottom-right) - Map View Only */}
          {!showStartScreen && viewMode === 'map' && (
            <button
              type="button"
              className="compare-fab"
              onClick={() => setIsCompareOpen(true)}
              disabled={selectedLocationObjects.length < 2}
              aria-label="Compare selected screens"
              title={selectedLocationObjects.length < 2 ? 'Select at least 2 screens to compare' : 'Compare'}
            >
              <span className="compare-fab-label">Compare</span>
              <span className="compare-fab-count">{selectedLocationObjects.length}</span>
              <i className="bi bi-arrow-left-right compare-fab-icon"></i>
            </button>
          )}

          {/* Bottom Bar — only after gateway */}
          {!showStartScreen && (
            <div className="map-bottom-bar">
              <div className="bottom-bar-left">
                <div className="bottom-bar-item">
                  <div className="bottom-bar-label">Selection</div>
                  <div className="bottom-bar-value">{selectedLocations.length} Screens</div>
                </div>
                <div className="bottom-bar-item">
                  <div className="bottom-bar-label">Budget Estimate</div>
                  <div className="bottom-bar-value">
                    {budgetEstimate > 0 ? `₹${budgetEstimate.toLocaleString('en-IN')}` : '₹0'}
                  </div>
                </div>
              </div>

              {!showStartScreen && (
                <div className="bottom-bar-right">
                  <button
                    type="button"
                    className="compare-bottom-btn"
                    onClick={() => setIsCompareOpen(true)}
                    disabled={selectedLocationObjects.length < 2}
                    title={selectedLocationObjects.length < 2 ? 'Select at least 2 screens to compare' : 'Compare'}
                  >
                    <i className="bi bi-arrow-left-right"></i>
                    <span>Compare ({selectedLocationObjects.length})</span>
                  </button>

                  {guidedMode !== 'manual' && (
                    <button
                      type="button"
                      className={`save-continue-btn ${selectedLocations.length === 0 ? 'disabled' : ''}`}
                      onClick={handleFinalCreateCampaign}
                      disabled={selectedLocations.length === 0}
                    >
                      Save and Continue
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - XIA Assistant */}
        <div className="campaign-right-panel">
          <div className="guided-tabs">
            <button
              className={`guided-tab ${guidedMode === 'xia' ? 'active' : ''} ${!isGatewaySubmitted ? 'disabled' : ''}`}
              onClick={() => isGatewaySubmitted && setGuidedMode('xia')}
            >
              XIA Guided
            </button>
            <button
              className={`guided-tab ${guidedMode === 'manual' ? 'active' : ''} ${!isGatewaySubmitted ? 'disabled' : ''}`}
              onClick={() => isGatewaySubmitted && setGuidedMode('manual')}
            >
              Campaign Builder
            </button>
          </div>

          <div className="guided-chat-area">
            {guidedMode === 'xia' ? (
              <>
                {/* Session ID - click to copy + Reset Chat */}
                {xiaSessionId && (
                  <div className="xia-session-row">
                    <div
                      className="xia-session-id"
                      onClick={() => {
                        navigator.clipboard.writeText(xiaSessionId)
                        const el = document.querySelector('.xia-session-id')
                        el.classList.add('copied')
                        setTimeout(() => el.classList.remove('copied'), 1500)
                      }}
                      title="Click to copy session ID"
                    >
                      <i className="bi bi-key-fill"></i>
                      <span className="session-id-text">{xiaSessionId}</span>
                      <i className="bi bi-clipboard"></i>
                    </div>
                    <button
                      className="xia-reset-btn"
                      onClick={() => {
                        setXiaSessionId(null)
                        setChatHistory([])
                        setXiaPersona('')
                        setXiaIntent('')
                        setXiaFilters({})
                        setXiaQuickReplies([])
                        setXiaScreenCounts(null)
                        setXiaSessionRestored(false)
                      }}
                      title="Start a new XIA chat session"
                    >
                      <i className="bi bi-arrow-clockwise"></i> New Chat
                    </button>
                    <span
                      className={`xia-status-tag xia-status-${xiaStatus.status}`}
                      title={xiaStatus.warnings.length > 0 ? xiaStatus.warnings.join('\n') : 'XIA is responding normally'}
                    >
                      <span className="xia-status-dot"></span>
                      {xiaStatus.status === 'online' ? 'Online' : xiaStatus.status === 'degraded' ? 'Degraded' : 'Offline'}
                    </span>
                  </div>
                )}

                {/* XIA Status Badges - Persona, Intent, Filters */}
                {(xiaPersona || xiaIntent || Object.keys(xiaFilters).length > 0) && (
                  <div className="xia-status-bar">
                    {xiaPersona && (
                      <span className="xia-badge xia-badge-persona">
                        <i className="bi bi-person-fill"></i> {xiaPersona.replace(/_/g, ' ')}
                      </span>
                    )}
                    {xiaIntent && (
                      <span className="xia-badge xia-badge-intent">
                        <i className="bi bi-lightning-fill"></i> {xiaIntent.replace(/_/g, ' ')}
                      </span>
                    )}
                    {Object.keys(xiaFilters).length > 0 && Object.entries(xiaFilters).map(([key, val]) => (
                      <span key={key} className="xia-badge xia-badge-filter">
                        <i className="bi bi-funnel-fill"></i> {key.replace(/spec_|_/g, ' ').trim()}: {val}
                      </span>
                    ))}
                  </div>
                )}

                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`chat-msg ${msg.type === 'bot' ? 'chat-msg-bot' : 'chat-msg-user'}`}>
                    {msg.type === 'bot' && <div className="chat-bot-avatar"><i className="bi bi-stars"></i></div>}
                    <div className={`chat-msg-bubble ${msg.type === 'bot' ? 'bot-bubble' : 'user-bubble'}`}>{msg.text}</div>
                  </div>
                ))}
                {xiaLoading && (
                  <div className="chat-msg chat-msg-bot">
                    <div className="chat-bot-avatar"><i className="bi bi-stars"></i></div>
                    <div className="chat-msg-bubble bot-bubble xia-typing">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                )}
                {/* Dynamic Quick Replies from XIA API */}
                {xiaQuickReplies.length > 0 && !xiaLoading && (
                  <div className="objective-buttons">
                    {xiaQuickReplies.map((qr) => (
                      <button key={qr} className="objective-btn" onClick={() => handleQuickReply(qr)}>{qr}</button>
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            ) : (
              <>
                {!isGatewaySubmitted ? (
                  <div className="manual-mode-content">
                    <h3 className="gateway-title">Gate Way</h3>

                    {/* Date Selection Row */}
                    <div className="manual-row">
                      <div className="manual-field">
                        <label className="manual-label">Start Date</label>
                        <div className="manual-input-with-icon">
                          <input
                            type="date"
                            className="manual-input"
                            value={startDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => {
                              const newStartDate = e.target.value;
                              setStartDate(newStartDate);
                              // Reset end date if new start date is after current end date
                              if (endDate && newStartDate > endDate) {
                                setEndDate('');
                              }
                            }}
                            placeholder="dd/mm/yyyy"
                          />
                          <i className="bi bi-calendar-event manual-icon"></i>
                        </div>
                      </div>
                      <div className="manual-field">
                        <label className="manual-label">End Date</label>
                        <div className="manual-input-with-icon">
                          <input
                            type="date"
                            className="manual-input"
                            value={endDate}
                            min={startDate || new Date().toISOString().split('T')[0]}
                            onChange={(e) => setEndDate(e.target.value)}
                            placeholder="dd/mm/yyyy"
                          />
                          <i className="bi bi-calendar-event manual-icon"></i>
                        </div>
                      </div>
                    </div>

                    {/* Location Selection — Tag Dropdown */}
                    <div className="manual-field full-width" ref={locationDropdownRef} style={{ position: 'relative' }}>
                      <label className="manual-label">Location</label>
                      <div
                        className="tag-dropdown-trigger"
                        onClick={() => setIsLocationDropdownOpen(prev => !prev)}
                      >
                        <div className="tag-dropdown-tags">
                          {selectedCity.length > 0 ? selectedCity.map((city, i) => (
                            <span className="tag-chip" key={i} title={city}>
                              <span className="tag-chip-text">{city}</span>
                              <span className="tag-chip-remove" onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCity(prev => prev.filter((_, idx) => idx !== i));
                              }}>×</span>
                            </span>
                          )) : (
                            <span className="tag-dropdown-placeholder">Select locations</span>
                          )}
                        </div>
                        <i className={`bi bi-chevron-${isLocationDropdownOpen ? 'up' : 'down'} tag-dropdown-arrow`}></i>
                      </div>
                      {isLocationDropdownOpen && (
                        <div className="tag-dropdown-menu">
                          {placeSuggestions.length > 0 && (
                            <div className="tag-dropdown-suggestions">
                              {placeSuggestions.map((s, idx) => (
                                <div
                                  key={idx}
                                  className="tag-dropdown-suggestion"
                                  onClick={() => {
                                    if (!selectedCity.includes(s.mainText)) {
                                      setSelectedCity(prev => [...prev, s.mainText]);
                                    }
                                    setLocationInput('');
                                    setPlaceSuggestions([]);
                                  }}
                                >
                                  <span className="suggestion-main">{s.mainText}</span>
                                  {s.secondaryText && <span className="suggestion-secondary">{s.secondaryText}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="tag-dropdown-input-row">
                            <input
                              type="text"
                              className="tag-dropdown-input"
                              value={locationInput}
                              onChange={(e) => setLocationInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && locationInput.trim()) {
                                  e.preventDefault();
                                  const val = locationInput.trim();
                                  if (!selectedCity.includes(val)) setSelectedCity(prev => [...prev, val]);
                                  setLocationInput('');
                                  setPlaceSuggestions([]);
                                }
                              }}
                              placeholder="e.g. Chennai"
                              autoFocus
                            />
                            <button
                              type="button"
                              className="tag-dropdown-add-btn"
                              onClick={() => {
                                const val = locationInput.trim();
                                if (val && !selectedCity.includes(val)) {
                                  setSelectedCity(prev => [...prev, val]);
                                }
                                setLocationInput('');
                                setPlaceSuggestions([]);
                              }}
                            >Add</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Budget Range */}
                    <div className="manual-field full-width">
                      <label className="manual-label">Estimated Budget Range</label>
                      <div className="manual-input-with-icon">
                        <input
                          type="number"
                          className="manual-input"
                          value={campaignBudget}
                          onChange={(e) => setCampaignBudget(e.target.value)}
                          placeholder="₹10,000"
                        />
                        <i className="bi bi-chevron-expand manual-icon"></i>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      className="submit-campaign-btn"
                      onClick={handleGatewaySubmit}
                      disabled={!startDate || !endDate || !selectedCity || selectedCity.length === 0 || !campaignBudget || Number(campaignBudget) <= 0}
                    >
                      {(!startDate || !endDate || !selectedCity || selectedCity.length === 0 || !campaignBudget || Number(campaignBudget) <= 0)
                        ? 'Fill all fields' : 'Submit'}
                    </button>
                  </div>
                ) : (
                  <div className="campaign-builder-content">
                    <div className="active-plan-card">
                      <div className="active-plan-header">
                        <div className="active-plan-title">Active Plan Summary</div>
                        {!isEditingGate ? (
                          <button
                            type="button"
                            className="active-plan-edit-link"
                            onClick={() => {
                              // Initialize draft values from current state
                              setDraftStartDate(startDate)
                              setDraftEndDate(endDate)
                              setDraftCity([...selectedCity])
                              setDraftBudget(campaignBudget)
                              setIsEditingGate(true)
                            }}
                          >
                            Edit Gate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="active-plan-edit-link"
                            style={{ color: '#999' }}
                            onClick={() => setIsEditingGate(false)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {!isEditingGate ? (
                        /* --- Read-only Summary --- */
                        <div className="active-plan-rows">
                          <div className="active-plan-row">
                            <i className="bi bi-geo-alt"></i>
                            <span>{selectedCity.length > 0 ? selectedCity.join(', ') : 'No location set'}</span>
                          </div>
                          <div className="active-plan-row">
                            <i className="bi bi-calendar-event"></i>
                            <span>{formatSummaryDate(startDate)}&nbsp;&nbsp;-&nbsp;&nbsp;{formatSummaryDate(endDate)}</span>
                          </div>
                          <div className="active-plan-row">
                            <i className="bi bi-bullseye"></i>
                            <span>₹{campaignBudget ? Number(campaignBudget).toLocaleString('en-IN') : '0'} Budget</span>
                          </div>
                        </div>
                      ) : (
                        /* --- Inline Editing Mode (uses draft state) --- */
                        <div className="active-plan-edit-form">
                          <div className="gate-edit-row">
                            <div className="gate-edit-field">
                              <label className="gate-edit-label"><i className="bi bi-calendar-event"></i> Start Date</label>
                              <input
                                type="date"
                                className="gate-edit-input"
                                value={draftStartDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setDraftStartDate(e.target.value)}
                              />
                            </div>
                            <div className="gate-edit-field">
                              <label className="gate-edit-label"><i className="bi bi-calendar-event"></i> End Date</label>
                              <input
                                type="date"
                                className="gate-edit-input"
                                value={draftEndDate}
                                min={draftStartDate || new Date().toISOString().split('T')[0]}
                                onChange={(e) => setDraftEndDate(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="gate-edit-field" style={{ position: 'relative' }}>
                            <label className="gate-edit-label"><i className="bi bi-geo-alt"></i> Location</label>
                            <div
                              className="tag-dropdown-trigger"
                              onClick={() => setIsLocationDropdownOpen(prev => !prev)}
                            >
                              <div className="tag-dropdown-tags">
                                {draftCity.length > 0 ? draftCity.map((city, i) => (
                                  <span className="tag-chip" key={i}>
                                    {city}
                                    <span className="tag-chip-remove" onClick={(e) => {
                                      e.stopPropagation();
                                      setDraftCity(prev => prev.filter((_, idx) => idx !== i));
                                    }}>×</span>
                                  </span>
                                )) : (
                                  <span className="tag-dropdown-placeholder">Select locations</span>
                                )}
                              </div>
                              <i className={`bi bi-chevron-${isLocationDropdownOpen ? 'up' : 'down'} tag-dropdown-arrow`}></i>
                            </div>
                            {isLocationDropdownOpen && (
                              <div className="tag-dropdown-menu">
                                {placeSuggestions.length > 0 && (
                                  <div className="tag-dropdown-suggestions">
                                    {placeSuggestions.map((s, idx) => (
                                      <div
                                        key={idx}
                                        className="tag-dropdown-suggestion"
                                        onClick={() => {
                                          if (!draftCity.includes(s.mainText)) {
                                            setDraftCity(prev => [...prev, s.mainText]);
                                          }
                                          setLocationInput('');
                                          setPlaceSuggestions([]);
                                        }}
                                      >
                                        <span className="suggestion-main">{s.mainText}</span>
                                        {s.secondaryText && <span className="suggestion-secondary">{s.secondaryText}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="tag-dropdown-input-row">
                                  <input
                                    type="text"
                                    className="tag-dropdown-input"
                                    value={locationInput}
                                    onChange={(e) => setLocationInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && locationInput.trim()) {
                                        e.preventDefault();
                                        const val = locationInput.trim();
                                        if (!draftCity.includes(val)) setDraftCity(prev => [...prev, val]);
                                        setLocationInput('');
                                        setPlaceSuggestions([]);
                                      }
                                    }}
                                    placeholder="e.g. Chennai"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="tag-dropdown-add-btn"
                                    onClick={() => {
                                      const val = locationInput.trim();
                                      if (val && !draftCity.includes(val)) {
                                        setDraftCity(prev => [...prev, val]);
                                      }
                                      setLocationInput('');
                                      setPlaceSuggestions([]);
                                    }}
                                  >Add</button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="gate-edit-field">
                            <label className="gate-edit-label"><i className="bi bi-bullseye"></i> Budget Range</label>
                            <input
                              type="number"
                              className="gate-edit-input"
                              value={draftBudget}
                              onChange={(e) => setDraftBudget(e.target.value)}
                              placeholder="₹10,000"
                            />
                          </div>
                          {(() => {
                            const hasChanges = draftStartDate !== startDate
                              || draftEndDate !== endDate
                              || JSON.stringify(draftCity) !== JSON.stringify(selectedCity)
                              || draftBudget !== campaignBudget
                            return (
                              <button
                                className="gate-edit-update-btn"
                                disabled={!hasChanges}
                                onClick={() => {
                                  if (!draftStartDate || !draftEndDate) {
                                    setAlert({ show: true, title: 'Missing Dates', message: 'Please select campaign dates', type: 'error' })
                                    return
                                  }
                                  if (draftEndDate < draftStartDate) {
                                    setAlert({ show: true, title: 'Invalid Dates', message: 'End date must be after start date', type: 'error' })
                                    return
                                  }
                                  if (!draftCity || draftCity.length === 0) {
                                    setAlert({ show: true, title: 'Missing Location', message: 'Please add at least one city', type: 'error' })
                                    return
                                  }
                                  // Commit draft values to real state
                                  setStartDate(draftStartDate)
                                  setEndDate(draftEndDate)
                                  setSelectedCity([...draftCity])
                                  setCampaignBudget(draftBudget)
                                  // Close edit mode & force re-fetch from Discovery API
                                  setIsEditingGate(false)
                                  // Toggle datesConfirmed off→on to trigger the useEffect
                                  setDatesConfirmed(false)
                                  setTimeout(() => setDatesConfirmed(true), 0)
                                }}
                              >
                                Update Plan
                              </button>
                            )
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="plan-dashboard">
                      <div className="plan-dashboard-title">Plan Dashboard</div>
                      <div className="plan-selection-card">
                        <div className="plan-selection-header">
                          <span className="plan-selection-title">Your Selection ({selectedLocationObjects.length})</span>
                          {selectedLocationObjects.length > 0 && (
                            <button className="plan-clear-btn" onClick={handleClearSelections}>Clear</button>
                          )}
                        </div>
                        <div className="plan-selection-list">
                          {selectedLocationObjects.map((loc) => {
                            const count = slotCount[loc.id] || 0
                            const available = slotAvailability[loc.id] || 0
                            const userBooked = userBookedSlots[loc.id] || 0
                            const maxAllowed = available + userBooked
                            const subText = `${loc.city_name || ''} · ${loc.district_name || 'Outdoor'}`
                            return (
                              <div key={loc.id} className="plan-selection-card-item">
                                <div className="plan-item-info">
                                  <div className="plan-item-name">{loc.name}</div>
                                  <div className="plan-item-sub">{subText}</div>
                                </div>
                                <div className="plan-item-actions">
                                  <div className="plan-slot-controls">
                                    <label>Slots</label>
                                    <div className="slot-ctrl-group">
                                      <button onClick={() => updateSlotCount(loc.id, -1)} disabled={count <= 0}>−</button>
                                      <span>{count}</span>
                                      <button onClick={() => updateSlotCount(loc.id, 1)} disabled={count >= maxAllowed}>+</button>
                                    </div>
                                  </div>
                                  <button
                                    className="plan-item-remove"
                                    onClick={() => handleLocationClick(loc)}
                                    title="Remove screen"
                                  >
                                    <i className="bi bi-x-lg"></i>
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                          {selectedLocationObjects.length === 0 && (
                            <div className="plan-selection-empty">No screens selected yet.</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="create-bundle-btn"
                          onClick={campaignCreated ? () => navigate('/campaign-bundle', {
                            state: {
                              campaignName: bundleCampaignName,
                              selectedScreens: selectedLocationObjects,
                              slotCount,
                              campaignId: localStorage.getItem('lastCampaignId') || null,
                              city: selectedCity?.[0] || '',
                              startDate,
                              endDate,
                              objective: summaryObjective,
                            }
                          }) : openCreateBundle}
                          disabled={selectedLocationObjects.length === 0}
                        >
                          {campaignCreated ? 'Summary' : 'Create Campaign'}
                        </button>
                        {!campaignCreated && (
                          <div className="create-bundle-help">
                            Group selected screens into a bundle to continue
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

          {/* Hide Ask XIA input on the start screen; show only after Gateway is submitted and in XIA mode */}
          {isGatewaySubmitted && guidedMode === 'xia' && (
            <div className="guided-input-area">
              <div className="guided-input-wrapper">
                <input
                  type="text"
                  className="guided-input"
                  placeholder="Ask XIA ..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button className="guided-send-btn" onClick={handleSendMessage}>
                  <i className="bi bi-send-fill"></i>
                </button>
              </div>
            </div>
          )}
        </div >
      </div >

      <ScreenDetailsModal
        open={isScreenModalOpen}
        mode={screenModalMode}
        location={activeScreen}
        onClose={closeScreenModal}
        onAddToPlan={handleAddToPlanFromModal}
        showXiaContent={showXiaInModal}
        campaignStartDate={startDate}
        campaignEndDate={endDate}
      />

      <CompareScreensModal
        open={isCompareOpen}
        screens={selectedLocationObjects}
        slotCount={slotCount}
        onClose={closeCompare}
      />

      {/* Create Bundle Modal */}
      {isCreateBundleOpen && (
        <div className="bundle-modal-overlay" onClick={closeCreateBundle} role="dialog" aria-modal="true">
          <div className="bundle-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bundle-modal-header">
              <div className="bundle-modal-title">Enter your campaign name</div>
              <button type="button" className="bundle-modal-close" onClick={closeCreateBundle} aria-label="Close">
                ×
              </button>
            </div>

            <div className="bundle-modal-body">
              <label className="bundle-modal-label">Campaign Name</label>
              <input
                type="text"
                className="bundle-modal-input"
                value={bundleCampaignName}
                onChange={(e) => setBundleCampaignName(e.target.value)}
                placeholder="e.g. Summer Sale - Chennai"
                autoFocus
              />
              {bundleError && <div className="bundle-modal-error">{bundleError}</div>}
            </div>

            <div className="bundle-modal-footer">
              <button type="button" className="bundle-modal-btn bundle-modal-btn-outline" onClick={closeCreateBundle}>
                Cancel
              </button>
              <button type="button" className="bundle-modal-btn bundle-modal-btn-primary" onClick={submitCreateBundle}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      <AlertModal
        isOpen={alert.show}
        onClose={() => setAlert({ ...alert, show: false })}
        title={alert.title}
        message={alert.message}
        type={alert.type}
      />
    </div>
  )
}

export default CreateCampaign;
