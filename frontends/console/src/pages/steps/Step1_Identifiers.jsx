import { useState, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import api from '../../utils/api'

// Fix for default marker icon in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Sub-component to handle map clicks — only sets lat/lng, no address auto-fill
function LocationMarker({ position, setPosition }) {
  const map = useMap()

  // Sync map center when position changes manually
  useEffect(() => {
    const lat = parseFloat(position.lat)
    const lng = parseFloat(position.lng)

    if (!isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], map.getZoom())
    }
  }, [position.lat, position.lng, map])

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      setPosition({ lat: lat.toFixed(6), lng: lng.toFixed(6) })
    },
  })

  const lat = parseFloat(position.lat)
  const lng = parseFloat(position.lng)

  return (!isNaN(lat) && !isNaN(lng)) ? (
    <Marker position={[lat, lng]} />
  ) : null
}

// Component to control map view independently of marker
function ViewControl({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom())
    }
  }, [center, map])
  return null
}

// Role options for dropdown
const ROLE_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'xigi', label: 'Xigi' },
  { value: 'partner', label: 'Partner' },
  { value: 'franchise', label: 'Franchise' }
]

// Helper: combine address sub-fields into one full_address string
// Order: street_name, city, district, state, pincode
function buildFullAddress({ street_name, city, district, state, pincode }) {
  return [street_name, city, district, state, pincode].filter(Boolean).join(', ')
}

// Helper: parse existing full_address back into sub-fields (for edit mode)
function parseFullAddress(fullAddr) {
  if (!fullAddr) return { street_name: '', city: '', district: '', state: '', pincode: '' }
  const parts = fullAddr.split(',').map(s => s.trim())
  if (parts.length >= 5) {
    // street, city, district, state, pincode
    const pincode = parts[parts.length - 1]
    const state = parts[parts.length - 2]
    const district = parts[parts.length - 3]
    const city = parts[parts.length - 4]
    const street_name = parts.slice(0, parts.length - 4).join(', ')
    return { street_name, city, district, state, pincode }
  }
  if (parts.length === 4) {
    return { street_name: parts[0], city: parts[1], district: '', state: parts[2], pincode: parts[3] }
  }
  if (parts.length === 3) {
    return { street_name: parts[0], city: '', district: '', state: parts[1], pincode: parts[2] }
  }
  if (parts.length === 2) {
    return { street_name: parts[0], city: '', district: '', state: parts[1], pincode: '' }
  }
  return { street_name: fullAddr, city: '', district: '', state: '', pincode: '' }
}

function Step1_Identifiers({ data, update, isEditMode: _isEditModeFromParent = false, fieldAccess = 'all' }) {
  const isEditMode = fieldAccess === 'restricted'
  const lockedStyle = { backgroundColor: '#f3f4f6', color: '#6b7280', pointerEvents: 'none' }

  // Parse existing full_address into sub-fields
  const parsedAddr = parseFullAddress(data.full_address)

  const [localData, setLocalData] = useState({
    screen_name: data.screen_name || '',
    role: data.role || '',
    city: parsedAddr.city || data.city || '',
    district: parsedAddr.district || '',
    latitude: data.latitude || '',
    longitude: data.longitude || '',
    street_name: parsedAddr.street_name,
    pincode: parsedAddr.pincode,
    state: parsedAddr.state,
    nearest_landmark: data.nearest_landmark || ''
  })

  // Duplicate screen name error state
  const [screenNameError, setScreenNameError] = useState('')

  // State for role dropdown
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
  const [customRole, setCustomRole] = useState('')
  const roleDropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target)) {
        setIsRoleDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // State to control map view independently
  const [viewCenter, setViewCenter] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)

  // Map click → only lat/lng
  const updateFromMap = (pos) => {
    const newData = { ...localData, latitude: pos.lat, longitude: pos.lng }
    setLocalData(newData)
    update({ latitude: pos.lat, longitude: pos.lng })
  }

  // Search → only lat/lng (no city/address auto-fill)
  const doSearch = async () => {
    if (!searchQuery) return
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        const newPos = { lat: parseFloat(lat).toFixed(6), lng: parseFloat(lon).toFixed(6) }

        setLocalData(prev => ({
          ...prev,
          latitude: newPos.lat,
          longitude: newPos.lng,
        }))
        update({
          latitude: newPos.lat,
          longitude: newPos.lng,
        })
      }
    } catch (err) {
      console.error("Search error:", err)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const updated = { ...localData, [name]: value }
    setLocalData(updated)

    // For address sub-fields, also send the combined full_address to parent
    if (['street_name', 'city', 'district', 'pincode', 'state'].includes(name)) {
      const fullAddr = buildFullAddress(updated)
      update({ full_address: fullAddr, city: updated.city })
    } else {
      update({ [name]: value })
    }

    // Clear screen name error when user starts typing again
    if (name === 'screen_name') {
      setScreenNameError('')
      update({ [name]: value, _screenNameError: false })
    }
  }

  const handleRoleSelect = (value) => {
    setLocalData(prev => ({ ...prev, role: value }))
    update({ role: value })
    setIsRoleDropdownOpen(false)
    setCustomRole('')
  }

  const handleCustomRoleAdd = () => {
    if (customRole.trim()) {
      handleRoleSelect(customRole.trim().toLowerCase())
    }
  }

  // City blur → only move map view (no lat/lng/address auto-fill)
  const handleCityBlur = async (e) => {
    const query = e.target.value
    if (!query || query.trim().length < 3) return

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        // Only move the map view to the city — don't auto-fill anything
        setViewCenter([parseFloat(lat), parseFloat(lon)])
      }
    } catch (err) {
      console.error("City geocode error:", err)
    }
  }

  const handleNameBlur = async (e) => {
    const name = e.target.value;
    if (!name || name.trim() === '') {
      setScreenNameError('')
      update({ _screenNameError: false })
      return;
    }

    try {
      const response = await api.get(`screen-specs/?search=${encodeURIComponent(name)}`);
      const exists = response.data.some(s => s.screen_name && s.screen_name.toLowerCase() === name.toLowerCase() && s.id !== data.dbId);

      if (exists) {
        setScreenNameError(`This screen name "${name}" already exists. Please use a unique name.`)
        update({ _screenNameError: true })
      } else {
        setScreenNameError('')
        update({ _screenNameError: false })
      }
    } catch (err) {
      console.error("Duplicate check error:", err);
    }
  }

  return (
    <div className="ssp-step-content">
      {/* Screen Name and Role in same row */}
      <div className="ssp-row">
        <div className="ssp-group" style={{ flex: 2 }}>
          <label className="ssp-label">Screen Name <span className="ssp-required">*</span></label>
          <input
            type="text"
            name="screen_name"
            className="ssp-input"
            placeholder="e.g. Main Lobby LED Wall - Theni"
            value={localData.screen_name}
            onChange={handleChange}
            onBlur={!isEditMode ? handleNameBlur : undefined}
            disabled={isEditMode}
            style={isEditMode ? lockedStyle : (screenNameError ? { borderColor: '#dc2626' } : {})}
          />
          {screenNameError && (
            <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', fontWeight: '500' }}>
              ⚠ {screenNameError}
            </p>
          )}
        </div>
        <div className="ssp-group" style={{ flex: 1 }} ref={roleDropdownRef}>
          <label className="ssp-label">Role <span className="ssp-required">*</span></label>
          <div className="ssp-custom-dropdown" style={isEditMode ? { opacity: 0.6 } : {}}>
            <div
              className="ssp-dropdown-trigger ssp-input"
              onClick={() => !isEditMode && setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              style={isEditMode ? { ...lockedStyle, cursor: 'not-allowed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } : {}}
            >
              <span className={localData.role ? '' : 'ssp-placeholder'}>{ROLE_OPTIONS.find(opt => opt.value === localData.role)?.label || 'Select...'}</span>
              {!isEditMode && <span className="ssp-dropdown-arrow">▼</span>}
            </div>
            {isRoleDropdownOpen && !isEditMode && (
              <div className="ssp-dropdown-menu">
                {ROLE_OPTIONS.map(option => (
                  <div
                    key={option.value}
                    className={`ssp-dropdown-item ${localData.role === option.value ? 'selected' : ''}`}
                    onClick={() => handleRoleSelect(option.value)}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <h4 className="ssp-subtitle">Location & GIS</h4>
      <div className="ssp-row ssp-map-row" style={isEditMode ? { opacity: 0.6, pointerEvents: 'none' } : {}}>
        {/* Map Column */}
        <div className="ssp-map-column">
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <MapContainer
              center={[parseFloat(localData.latitude) || 20.5937, parseFloat(localData.longitude) || 78.9629]}
              zoom={localData.latitude ? 15 : 5}
              style={{ height: "100%", width: "100%", borderRadius: "8px" }}
              scrollWheelZoom={!isEditMode}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <ViewControl center={viewCenter} />
              {!isEditMode && <LocationMarker
                position={{ lat: parseFloat(localData.latitude), lng: parseFloat(localData.longitude) }}
                setPosition={updateFromMap}
              />}
            </MapContainer>

            {/* Search Overlay */}
            {!isEditMode && <div className="ssp-map-search-overlay">
              <input
                ref={searchInputRef}
                type="text"
                className="ssp-map-search-input"
                placeholder="Search location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              />
              <button className="ssp-map-search-btn" onClick={doSearch}>🔍</button>
            </div>}
          </div>
        </div>

        {/* Fields Column */}
        <div className="ssp-fields-column">
          {/* 1. Latitude & Longitude — fetched from map */}
          <div className="ssp-row">
            <div className="ssp-group">
              <label className="ssp-label">Latitude <span className="ssp-required">*</span></label>
              <input
                type="number"
                name="latitude"
                className="ssp-input"
                placeholder="Click map or search"
                value={localData.latitude}
                onChange={handleChange}
                onKeyDown={(e) => (e.key === 'e') && e.preventDefault()}
                disabled={isEditMode}
                style={isEditMode ? lockedStyle : {}}
              />
            </div>
            <div className="ssp-group">
              <label className="ssp-label">Longitude <span className="ssp-required">*</span></label>
              <input
                type="number"
                name="longitude"
                className="ssp-input"
                placeholder="Click map or search"
                value={localData.longitude}
                onChange={handleChange}
                onKeyDown={(e) => (e.key === 'e') && e.preventDefault()}
                disabled={isEditMode}
                style={isEditMode ? lockedStyle : {}}
              />
            </div>
          </div>

          {/* 2. Street Name */}
          <div className="ssp-group">
            <label className="ssp-label">Street Name <span className="ssp-required">*</span></label>
            <input
              type="text"
              name="street_name"
              className="ssp-input"
              placeholder="e.g. 12, Gandhi Nagar Main Road"
              value={localData.street_name}
              onChange={handleChange}
              disabled={isEditMode}
              style={isEditMode ? lockedStyle : {}}
            />
          </div>

          {/* 3. City & District in one row */}
          <div className="ssp-row">
            <div className="ssp-group">
              <label className="ssp-label">City <span className="ssp-required">*</span></label>
              <input
                type="text"
                name="city"
                className="ssp-input"
                placeholder="e.g. Theni"
                value={localData.city}
                onChange={handleChange}
                onBlur={handleCityBlur}
                disabled={isEditMode}
                style={isEditMode ? lockedStyle : {}}
              />
            </div>
            <div className="ssp-group">
              <label className="ssp-label">District <span className="ssp-required">*</span></label>
              <input
                type="text"
                name="district"
                className="ssp-input"
                placeholder="e.g. Theni District"
                value={localData.district}
                onChange={handleChange}
                disabled={isEditMode}
                style={isEditMode ? lockedStyle : {}}
              />
            </div>
          </div>

          {/* 4. State & Pincode in one row */}
          <div className="ssp-row">
            <div className="ssp-group">
              <label className="ssp-label">State <span className="ssp-required">*</span></label>
              <input
                type="text"
                name="state"
                className="ssp-input"
                placeholder="e.g. Tamil Nadu"
                value={localData.state}
                onChange={handleChange}
                disabled={isEditMode}
                style={isEditMode ? lockedStyle : {}}
              />
            </div>
            <div className="ssp-group">
              <label className="ssp-label">Pincode <span className="ssp-required">*</span></label>
              <input
                type="text"
                name="pincode"
                className="ssp-input"
                placeholder="e.g. 625531"
                value={localData.pincode}
                onChange={handleChange}
                disabled={isEditMode}
                style={isEditMode ? lockedStyle : {}}
              />
            </div>
          </div>

          {/* 5. Nearest Landmark */}
          <div className="ssp-group">
            <label className="ssp-label">Nearest Landmark <span className="ssp-required">*</span></label>
            <input
              type="text"
              name="nearest_landmark"
              className="ssp-input"
              placeholder="e.g. Opposite Metro Station Logic Board"
              value={localData.nearest_landmark}
              onChange={handleChange}
              disabled={isEditMode}
              style={isEditMode ? lockedStyle : {}}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Step1_Identifiers
