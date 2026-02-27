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
 * Reusable Premium Custom Select 
 * Matches the light-themed design shown in reference images
 * Now uses inline input instead of browser prompt
 */
function PremiumSelect({ label, value, options, onChange, name, placeholder = "Select...", required = false, info = null, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        setShowCustomInput(false)
        setCustomValue('')
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showCustomInput])

  const handleSelect = (val) => {
    if (disabled) return
    onChange({ target: { name, value: val } })
    setIsOpen(false)
    setShowCustomInput(false)
  }

  const handleCustomSubmit = () => {
    if (disabled) return
    if (customValue.trim()) {
      onChange({ target: { name, value: customValue.trim() } })
    }
    setIsOpen(false)
    setShowCustomInput(false)
    setCustomValue('')
  }

  const getDisplayValue = () => {
    if (!value || value === '') return placeholder
    const found = options.find(o => o.val === value)
    return found ? found.label : value
  }

  return (
    <div className="ssp-group" ref={containerRef} style={{ position: 'relative', opacity: disabled ? 0.6 : 1 }}>
      <label className="ssp-label">{label} {required && !disabled && <span className="ssp-required">*</span>}{info && <InfoTooltip text={info} />}</label>
      <div
        className="ssp-input"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderColor: isOpen ? '#6B4EE6' : '#d1d5db',
          background: disabled ? '#f3f4f6' : '#fff'
        }}
      >
        <span style={{ color: value && !disabled ? '#1f2937' : '#9ca3af' }}>{disabled ? 'N/A (Indoor)' : getDisplayValue()}</span>
        {!disabled && <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>}
      </div>

      {isOpen && !disabled && (
        <div className="ssp-dropdown-list ssp-dropdown-light">
          {options.map((opt, idx) => (
            <div key={opt.val || idx} className={`ssp-dropdown-item ${value === opt.val ? 'selected' : ''}`} onClick={() => handleSelect(opt.val)}>
              {opt.label}
            </div>
          ))}

          {/* Inline Custom Input Section */}
          {!showCustomInput ? (
            <div className="ssp-dropdown-item ssp-dropdown-custom-btn" onClick={(e) => { e.stopPropagation(); setShowCustomInput(true); }}>
              + Type Custom Value
            </div>
          ) : (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Type and press Enter..."
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#fff', color: '#1f2937', boxSizing: 'border-box' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Step3_Visibility({ data, update, isEditMode: _isEditMode = false, fieldAccess = 'all' }) {
  const isEditMode = fieldAccess === 'restricted'
  const [localData, setLocalData] = useState({
    installation_type: data.installation_type || '',
    mounting_height_ft: data.mounting_height_ft || '',
    facing_direction: data.facing_direction || '',
    road_type: data.road_type || '',
    traffic_direction: data.traffic_direction || ''
  })

  // Sync from parent in case Environment changed in Step 2
  useEffect(() => {
    setLocalData(prev => ({
      ...prev,
      road_type: data.road_type,
      traffic_direction: data.traffic_direction
    }))
  }, [data.road_type, data.traffic_direction])

  const isIndoor = data.environment === 'Indoor'

  const handleChange = (e) => {
    const { name, value } = e.target
    setLocalData(prev => ({ ...prev, [name]: value }))
    update({ [name]: value })
  }

  return (
    <div className="ssp-step-content">
      {/* Installation & Mounting */}
      <div className="ssp-row">
        <PremiumSelect
          label="Installation"
          name="installation_type"
          value={localData.installation_type}
          placeholder="Select..."
          required
          options={[
            { val: '', label: 'Select...' },
            { val: 'Wall Mount', label: 'Wall Mount' },
            { val: 'Hanging', label: 'Hanging' },
            { val: 'Structure', label: 'Structure' },
            { val: 'Facade', label: 'Facade (Building Front)' },
            { val: 'Glass', label: 'Glass (For Transparent)' },
            { val: 'Curved', label: 'Curved (For Flexible)' },
            { val: 'Mobile', label: 'Mobile (For Vehicle/Rental)' },
            { val: 'Pole', label: 'Pole (For Outdoor)' },
            { val: 'Rooftop', label: 'Rooftop (For Outdoor)' }
          ]}
          onChange={handleChange}
        />

        <div className="ssp-group">
          <label className="ssp-label">Mounting Height (feet) <span className="ssp-required">*</span></label>
          <input
            type="number"
            name="mounting_height_ft"
            className="ssp-input"
            value={localData.mounting_height_ft}
            onChange={handleChange}
            placeholder="e.g. 10"
            min="0"
            onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
          />
        </div>
      </div>

      <div className="ssp-row">
        <div className="ssp-group">
          <label className="ssp-label">Facing Direction <span className="ssp-required">*</span><InfoTooltip text="The direction the screen faces. Use compass directions (North, South, East, West) or describe relative to a landmark (e.g., 'Towards City Mall', 'Facing Main Road')." /></label>
          <input
            type="text"
            name="facing_direction"
            className="ssp-input"
            value={localData.facing_direction}
            onChange={handleChange}
            placeholder="e.g. Towards Police station"
          />
        </div>

        <PremiumSelect
          label="Road Type"
          name="road_type"
          value={localData.road_type}
          placeholder="Select..."
          required
          disabled={isEditMode || isIndoor}
          options={[
            { val: '', label: 'Select...' },
            { val: 'Local', label: 'Local' },
            { val: 'Highway', label: 'Highway' },
            { val: 'Arterial', label: 'Arterial' },
            { val: 'Pedestrian', label: 'Pedestrian Only' }
          ]}
          onChange={handleChange}
        />
      </div>

      <div className="ssp-row">
        <PremiumSelect
          label="Traffic Direction"
          name="traffic_direction"
          value={localData.traffic_direction}
          placeholder="Select..."
          required
          disabled={isEditMode || isIndoor}
          info="How do vehicles see the screen? Head-on = driving towards it. Parallel = driving alongside it. Cross-traffic = passing perpendicular to it."
          options={[
            { val: '', label: 'Select...' },
            { val: 'One way', label: 'One way' },
            { val: 'Two way', label: 'Two way' },
          ]}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}

export default Step3_Visibility

