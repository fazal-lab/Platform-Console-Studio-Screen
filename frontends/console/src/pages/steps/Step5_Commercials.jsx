import { useState, useEffect, useRef } from 'react'

/**
 * Info Tooltip Component - Shows info icon with hover tooltip
 */
function InfoTooltip({ text }) {
  return (
    <span className="ssp-info-btn">
      i
      <span className="ssp-info-tooltip">{text}</span>
    </span>
  )
}

/** 
 * Reusable Premium Custom Select (Light Theme)
 */
function PremiumSelect({ label, value, options, onChange, name, placeholder = "Select...", required = false, info = null }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleSelect = (val) => {
    if (val === 'OTHER_CUSTOM') {
      const customVal = prompt("Enter Custom Value:")
      if (customVal) onChange({ target: { name, value: customVal } })
    } else {
      onChange({ target: { name, value: val } })
    }
    setIsOpen(false)
  }

  const getDisplayValue = () => {
    if (!value) return placeholder
    const found = options.find(o => o.val === value)
    return found ? found.label : value
  }

  return (
    <div className="ssp-group" ref={containerRef} style={{ position: 'relative' }}>
      <label className="ssp-label">{label} {required && <span className="ssp-required">*</span>}{info && <InfoTooltip text={info} />}</label>
      <div
        className="ssp-input"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: isOpen ? '#6B4EE6' : '#d1d5db' }}
      >
        <span style={{ color: value ? '#1f2937' : '#9ca3af' }}>{getDisplayValue()}</span>
        <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>
      </div>

      {isOpen && (
        <div className="ssp-dropdown-list ssp-dropdown-light">
          {options.map((opt) => (
            <div key={opt.val} className={`ssp-dropdown-item ${value === opt.val ? 'selected' : ''}`} onClick={() => handleSelect(opt.val)}>
              {opt.label}
            </div>
          ))}
          <div className="ssp-dropdown-item ssp-dropdown-custom-btn" onClick={() => handleSelect('OTHER_CUSTOM')}>
            + Type Custom Value
          </div>
        </div>
      )}
    </div>
  )
}

function Step5_Commercials({ data, update, isEditMode = false }) {
  const [localData, setLocalData] = useState({
    base_price_per_slot_inr: data.base_price_per_slot_inr || '',
    seasonal_pricing: data.seasonal_pricing || false,
    minimum_booking_days: data.minimum_booking_days || '',
    surcharge_percent: data.surcharge_percent || '',
    enable_min_booking: !!data.minimum_booking_days,
    booking_type: data.booking_type || 'BOTH',
    restricted_categories_json: data.restricted_categories_json || [],
    sensitive_zone_flags_json: data.sensitive_zone_flags_json || [],
    // Multiple seasons support
    seasons_json: data.seasons_json || []
  })

  const [activeDropdown, setActiveDropdown] = useState(null)
  const zonesRef = useRef(null)
  const catsRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (activeDropdown === 'zones' && zonesRef.current && !zonesRef.current.contains(event.target)) {
        setActiveDropdown(null)
      }
      if (activeDropdown === 'categories' && catsRef.current && !catsRef.current.contains(event.target)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [activeDropdown])

  // Inline custom input states
  const [customZone, setCustomZone] = useState('')
  const [customCategory, setCustomCategory] = useState('')

  const sensitiveZoneOptions = [
    'School zone', 'Hospital zone', 'Temple Zone', 'Mosque Zone', 'Church zone', 'Govt. Building zone'
  ]

  const restrictedCategoryOptions = [
    'Tobacco products', 'Liquor brands', 'Gambling ads', 'Political ads', 'Adult Content', 'Religious ads', 'Vaping products'
  ]

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value

    setLocalData(prev => {
      const newData = { ...prev, [name]: val }
      // Clear related data when unchecking boxes
      if (name === 'enable_min_booking' && !checked) {
        newData.minimum_booking_days = ''
        newData.surcharge_percent = ''
      }
      if (name === 'seasonal_pricing' && !checked) {
        newData.seasons_json = []
      }
      return newData
    })

    // Sync checkbox and clear related data to parent
    if (name === 'enable_min_booking' && !checked) {
      update({ [name]: val, minimum_booking_days: '', surcharge_percent: '' })
    } else if (name === 'seasonal_pricing' && !checked) {
      update({ [name]: val, seasons_json: [] })
    } else {
      update({ [name]: val })
    }
  }

  const toggleArrayItem = (field, item) => {
    const current = localData[field] || []
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item]

    setLocalData(prev => ({ ...prev, [field]: updated }))
    update({ [field]: updated })
  }

  const addCustomToArrayInline = (field, value, clearFn) => {
    if (value && value.trim()) {
      const updated = [...(localData[field] || []), value.trim()]
      setLocalData(prev => ({ ...prev, [field]: updated }))
      update({ [field]: updated })
      clearFn('')
    }
  }

  // === Season Management ===
  const addSeason = () => {
    const newSeason = { id: Date.now(), name: '', type: '', percentage: '' }
    const updated = [...(localData.seasons_json || []), newSeason]
    setLocalData(prev => ({ ...prev, seasons_json: updated }))
    update({ seasons_json: updated })
  }

  const updateSeason = (id, field, value) => {
    const updated = (localData.seasons_json || []).map(s =>
      s.id === id ? { ...s, [field]: value } : s
    )
    setLocalData(prev => ({ ...prev, seasons_json: updated }))
    update({ seasons_json: updated })
  }

  const removeSeason = (id) => {
    const updated = (localData.seasons_json || []).filter(s => s.id !== id)
    setLocalData(prev => ({ ...prev, seasons_json: updated }))
    update({ seasons_json: updated })
  }



  return (
    <div className="ssp-step-content" style={isEditMode ? { opacity: 0.6, pointerEvents: 'none' } : {}}>
      <h4 className="ssp-section-subtitle" style={{ marginTop: 0 }}>Pricing & Inventory</h4>

      {/* Row 1: Base Price */}
      <div className="ssp-row">
        <div className="ssp-group">
          <label className="ssp-label">Base price (slot/Day) <span className="ssp-required">*</span><InfoTooltip text="Cost per ad slot per day in INR. This is your starting price - advertisers pay this rate multiplied by the number of days and slots booked." /></label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#374151', fontSize: '14px' }}>₹</span>
            <input
              type="number"
              name="base_price_per_slot_inr"
              className="ssp-input"
              style={{ paddingLeft: '28px' }}
              placeholder="e.g. 500"
              value={localData.base_price_per_slot_inr}
              onChange={handleChange}
              min="0"
              onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Sensitive Zones & Restricted Categories (Light Theme) */}
      <div className="ssp-row">
        {/* Sensitive Zone Flags */}
        <div className="ssp-group" ref={zonesRef} style={{ position: 'relative' }}>
          <label className="ssp-label">Sensitive zone flags <span className="ssp-required">*</span><InfoTooltip text="Locations near religious, educational, or government buildings may have content restrictions. Select applicable zones to ensure compliant ad delivery." /></label>
          <div
            className="ssp-select-multi-wrapper"
            onClick={() => setActiveDropdown(activeDropdown === 'zones' ? null : 'zones')}
            style={{ cursor: 'pointer', borderColor: activeDropdown === 'zones' ? '#6B4EE6' : '#d1d5db' }}
          >
            {localData.sensitive_zone_flags_json.length === 0 && <span style={{ color: '#9ca3af', fontSize: '14px' }}>Select...</span>}
            {localData.sensitive_zone_flags_json.map(zone => (
              <span key={zone} className="ssp-multi-chip" onClick={(e) => e.stopPropagation()}>
                {zone}
                <button type="button" onClick={() => toggleArrayItem('sensitive_zone_flags_json', zone)} className="ssp-multi-chip-remove">×</button>
              </span>
            ))}
            <div className="ssp-multi-arrow">▼</div>
          </div>

          {activeDropdown === 'zones' && (
            <div className="ssp-dropdown-list ssp-dropdown-light">
              {sensitiveZoneOptions.map(option => (
                <div
                  key={option}
                  className={`ssp-dropdown-item ${localData.sensitive_zone_flags_json.includes(option) ? 'selected' : ''}`}
                  onClick={() => toggleArrayItem('sensitive_zone_flags_json', option)}
                >
                  {option}
                </div>
              ))}
              {/* Inline Custom Input */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Metro zone"
                    value={customZone}
                    onChange={(e) => setCustomZone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customZone) {
                        addCustomToArrayInline('sensitive_zone_flags_json', customZone, setCustomZone)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#fff', color: '#1f2937' }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      addCustomToArrayInline('sensitive_zone_flags_json', customZone, setCustomZone)
                    }}
                    style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Categories Restricted */}
        <div className="ssp-group" ref={catsRef} style={{ position: 'relative' }}>
          <label className="ssp-label">Categories restricted <span className="ssp-required">*</span><InfoTooltip text="Ad categories that cannot be displayed on this screen. Common restrictions include tobacco, alcohol, political, and adult content." /></label>
          <div
            className="ssp-select-multi-wrapper"
            onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
            style={{ cursor: 'pointer', borderColor: activeDropdown === 'categories' ? '#6B4EE6' : '#d1d5db' }}
          >
            {localData.restricted_categories_json.length === 0 && <span style={{ color: '#9ca3af', fontSize: '14px' }}>Select...</span>}
            {localData.restricted_categories_json.map(cat => (
              <span key={cat} className="ssp-multi-chip" onClick={(e) => e.stopPropagation()}>
                {cat}
                <button type="button" onClick={() => toggleArrayItem('restricted_categories_json', cat)} className="ssp-multi-chip-remove">×</button>
              </span>
            ))}
            <div className="ssp-multi-arrow">▼</div>
          </div>

          {activeDropdown === 'categories' && (
            <div className="ssp-dropdown-list ssp-dropdown-light">
              {restrictedCategoryOptions.map(option => (
                <div
                  key={option}
                  className={`ssp-dropdown-item ${localData.restricted_categories_json.includes(option) ? 'selected' : ''}`}
                  onClick={() => toggleArrayItem('restricted_categories_json', option)}
                >
                  {option}
                </div>
              ))}
              {/* Inline Custom Input */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Crypto ads"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customCategory) {
                        addCustomToArrayInline('restricted_categories_json', customCategory, setCustomCategory)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#fff', color: '#1f2937' }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      addCustomToArrayInline('restricted_categories_json', customCategory, setCustomCategory)
                    }}
                    style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Row 3: Checkboxes - White styling */}
      <div className="ssp-row" style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <label className="ssp-white-checkbox">
            <input
              type="checkbox"
              name="seasonal_pricing"
              checked={localData.seasonal_pricing}
              onChange={handleChange}
            />
            <span className="ssp-checkmark"></span>
            Seasonal pricing<InfoTooltip text="Enable dynamic pricing for peak seasons (festivals, holidays). Add seasons below and set percentage adjustments (increase or decrease)." />
          </label>
          <label className="ssp-white-checkbox">
            <input
              type="checkbox"
              name="enable_min_booking"
              checked={localData.enable_min_booking}
              onChange={handleChange}
            />
            <span className="ssp-checkmark"></span>
            Minimum booking days<InfoTooltip text="Set a minimum number of days advertisers must book. Example: If set to 15, no one can book this screen for less than 15 days, even if they offer to pay more." />
          </label>
        </div>
      </div>


      {/* Row 4: Seasonal Pricing - Multiple Seasons */}
      {
        localData.seasonal_pricing && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Seasonal Pricing</span>
              <button
                type="button"
                onClick={addSeason}
                style={{ padding: '6px 12px', background: '#6B4EE6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
              >
                + Add Season
              </button>
            </div>

            {(localData.seasons_json || []).length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '12px' }}>No seasons added. Click "Add Season" to add one.</p>
            )}

            {(localData.seasons_json || []).map((season, idx) => (
              <div key={season.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '12px', padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ flex: 1 }}>
                  <label className="ssp-label">Season Name <span className="ssp-required">*</span></label>
                  <select
                    className="ssp-input"
                    value={season.name}
                    onChange={(e) => updateSeason(season.id, 'name', e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Select...</option>
                    <option value="Diwali">Diwali</option>
                    <option value="Christmas">Christmas</option>
                    <option value="New Year">New Year</option>
                    <option value="Summer Sale">Summer Sale</option>
                    <option value="Eid">Eid</option>
                    <option value="Holi">Holi</option>
                    <option value="Independence Day">Independence Day</option>
                    <option value="Republic Day">Republic Day</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="ssp-label">Adjustment Type <span className="ssp-required">*</span></label>
                  <select
                    className="ssp-input"
                    value={season.type}
                    onChange={(e) => updateSeason(season.id, 'type', e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Select...</option>
                    <option value="Discount">Discount</option>
                    <option value="Surcharge">Surcharge</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="ssp-label">Adjustment (%) <span className="ssp-required">*</span></label>
                  <input
                    type="number"
                    className="ssp-input"
                    placeholder="0"
                    value={season.percentage}
                    onChange={(e) => updateSeason(season.id, 'percentage', e.target.value)}
                    min="0"
                    onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSeason(season.id)}
                  style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )
      }

      {/* Row 5: Minimum Booking Days Input */}
      {
        localData.enable_min_booking && (
          <div className="ssp-row" style={{ marginTop: '16px' }}>
            <div className="ssp-group">
              <label className="ssp-label">Minimum Booking Days <span className="ssp-required">*</span><InfoTooltip text="Hard limit. No advertiser can book for fewer days than this, regardless of how much they pay. Example: Set to 15 = bookings under 15 days are rejected." /></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  name="minimum_booking_days"
                  className="ssp-input"
                  placeholder="e.g. 7"
                  value={localData.minimum_booking_days}
                  onChange={handleChange}
                  min="1"
                  onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                  style={{ flex: 1 }}
                />
                <span style={{ color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>days</span>
              </div>
            </div>
            <div className="ssp-group">
              <label className="ssp-label">Extra Charge (%) <span className="ssp-required">*</span><InfoTooltip text="Short-duration booking surcharge. Extra charges when booking duration is at or below the minimum booking days. Bookings longer than this = no extra charge." /></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  name="surcharge_percent"
                  className="ssp-input"
                  placeholder="e.g. 10"
                  value={localData.surcharge_percent}
                  onChange={handleChange}
                  min="0"
                  onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                  style={{ flex: 1 }}
                />
                <span style={{ color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>%</span>
              </div>
            </div>
          </div>
        )
      }

    </div >
  )
}

export default Step5_Commercials


