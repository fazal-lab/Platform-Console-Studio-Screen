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
    if (found) return found.label
    // Check in groups
    for (const opt of options) {
      if (opt.type === 'group') {
        const item = opt.items.find(i => i.val === value)
        if (item) return item.label
      }
    }
    return value
  }

  return (
    <div className="ssp-group" ref={containerRef} style={{ position: 'relative', opacity: disabled ? 0.6 : 1 }}>
      <label className="ssp-label">{label} {required && !disabled && <span className="ssp-required">*</span>}{info && <InfoTooltip text={info} />}</label>
      <div
        className="ssp-input"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: isOpen ? '#6B4EE6' : '#d1d5db', background: disabled ? '#f3f4f6' : '#fff' }}
      >
        <span style={{ color: value && !disabled ? '#1f2937' : '#9ca3af' }}>{getDisplayValue()}</span>
        {!disabled && <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>}
      </div>

      {isOpen && !disabled && (
        <div className="ssp-dropdown-list ssp-dropdown-light">
          {options.map((opt, idx) => {
            if (opt.type === 'group') {
              return (
                <div key={`group-${idx}`}>
                  <div style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', background: '#f9fafb' }}>{opt.label}</div>
                  {opt.items.map(item => (
                    <div key={item.val} className={`ssp-dropdown-item ${value === item.val ? 'selected' : ''}`} onClick={() => handleSelect(item.val)}>
                      {item.label}
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div key={opt.val} className={`ssp-dropdown-item ${value === opt.val ? 'selected' : ''}`} onClick={() => handleSelect(opt.val)}>
                {opt.label}
              </div>
            )
          })}

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


function Step2_Display({ data, update, isEditMode: _isEditModeFromParent = false, fieldAccess = 'all' }) {
  const isEditMode = fieldAccess === 'restricted'
  const lockedStyle = { backgroundColor: '#f3f4f6', color: '#6b7280', pointerEvents: 'none' }
  const [localData, setLocalData] = useState({
    technology: data.technology || '',
    environment: data.environment || '',
    screen_type: data.screen_type || '',
    screen_width: data.screen_width || '',
    screen_height: data.screen_height || '',
    resolution_width: data.resolution_width || '',
    resolution_height: data.resolution_height || '',
    pixel_pitch_mm: data.pixel_pitch_mm || '',
    brightness_nits: data.brightness_nits || '',
    refresh_rate_hz: data.refresh_rate_hz || '',
    installation_type: data.installation_type || '',
    facing_direction: data.facing_direction || '',
    road_type: data.road_type || '',
  })

  // Computed Values
  const getComputed = () => {
    const w = parseFloat(localData.screen_width) || 0
    const h = parseFloat(localData.screen_height) || 0
    const rw = parseInt(localData.resolution_width) || 0
    const rh = parseInt(localData.resolution_height) || 0

    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))

    const calcAspect = (w, h) => {
      const d = gcd(w, h)
      return `${w / d}:${h / d}`
    }

    let aspect = 'Auto - Calculated'
    if (rw && rh) aspect = calcAspect(rw, rh)

    let orient = 'Auto - Calculated'
    if (rw && rh) {
      if (rw > rh) orient = "LANDSCAPE"
      else if (rh > rw) orient = "PORTRAIT"
      else orient = "SQUARE"
    }

    return {
      area: (w * h).toFixed(2),
      aspect,
      orient
    }
  }

  const computed = getComputed()

  // Push computed orientation to parent formData so Step 4 can access it
  useEffect(() => {
    const rw = parseInt(localData.resolution_width) || 0
    const rh = parseInt(localData.resolution_height) || 0
    if (rw && rh) {
      let orient = 'SQUARE'
      if (rw > rh) orient = 'LANDSCAPE'
      else if (rh > rw) orient = 'PORTRAIT'
      update({ orientation: orient })
    }
  }, [localData.resolution_width, localData.resolution_height])

  const handleChange = (e) => {
    const { name, value } = e.target
    setLocalData(prev => {
      const newData = { ...prev, [name]: value }
      if (name === 'screen_type' && value === 'van_led') {
        newData.environment = 'Outdoor'
      }
      return newData
    })

    const updatePayload = { [name]: value }
    if (name === 'screen_type' && value === 'van_led') updatePayload.environment = 'Outdoor'

    // Auto-fill Road Type and Traffic Direction as null for Indoor
    if (name === 'environment' && value === 'Indoor') {
      updatePayload.road_type = null
      updatePayload.traffic_direction = null
      setLocalData(prev => ({ ...prev, ...updatePayload }))
    }

    update(updatePayload)
  }

  return (
    <div className="ssp-step-content">
      <div className="ssp-section-category">

        {/* Row 0: Tech, Env, Type */}
        <div className="ssp-row three-col">
          <PremiumSelect
            label="Technology"
            name="technology"
            value={localData.technology}
            placeholder="Select..."
            required
            disabled={isEditMode}
            options={[
              { val: '', label: 'Select...' },
              { val: 'LED', label: 'LED' }
            ]}
            onChange={handleChange}
          />

          <PremiumSelect
            label="Environment"
            name="environment"
            value={localData.environment}
            placeholder="Select..."
            required
            disabled={isEditMode}
            options={[
              { val: '', label: 'Select...' },
              { val: 'Indoor', label: 'Indoor' },
              { val: 'Outdoor', label: 'Outdoor' }
            ]}
            onChange={handleChange}
          />

          <PremiumSelect
            label="Screen Type"
            name="screen_type"
            value={localData.screen_type}
            placeholder="Select..."
            required
            disabled={isEditMode}
            options={[
              { val: '', label: 'Select...' },
              { val: 'Video Wall', label: 'Video Wall' },
              { val: 'transparent_led', label: 'Transparent LED' },
              { val: 'flexible_led', label: 'Flexible LED' },
              { val: 'interactive_led', label: 'Interactive LED' },
              { val: 'van_led', label: 'Van LED' },
              { val: 'standee_led', label: 'Standee LED' }
            ]}
            onChange={handleChange}
          />
        </div>

        {/* Row 1: Dimensions & Area */}
        <div className="ssp-row three-col">
          <div className="ssp-group">
            <label className="ssp-label">Width (m) <span className="ssp-required">*</span></label>
            <input
              type="number"
              name="screen_width"
              className="ssp-input"
              value={localData.screen_width}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
              disabled={isEditMode}
              style={isEditMode ? lockedStyle : {}}
            />
          </div>
          <div className="ssp-group">
            <label className="ssp-label">Height (m) <span className="ssp-required">*</span></label>
            <input
              type="number"
              name="screen_height"
              className="ssp-input"
              value={localData.screen_height}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
              disabled={isEditMode}
              style={isEditMode ? lockedStyle : {}}
            />
          </div>
          <div className="ssp-group">
            <label className="ssp-label">Total Area (Auto)</label>
            <input
              type="text"
              className="ssp-input"
              value={computed.area > 0 ? computed.area + ' sq.m' : 'Auto - Calculated'}
              readOnly
              style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
            />
          </div>
        </div>

        {/* Row 2: Resolution, Aspect, Orientation */}
        <div className="ssp-row three-col">

          <PremiumSelect
            label="Pixel Pitch (mm)"
            name="pixel_pitch_mm"
            value={localData.pixel_pitch_mm}
            placeholder="Select..."
            disabled={isEditMode}
            info="Distance between LED pixels in mm. Lower values (P0.9-P2.5) offer higher resolution for close viewing. Higher values (P3.0+) are better for outdoor/distance viewing."
            options={[
              { val: '', label: 'Select...' },
              {
                type: 'group', label: 'Indoor (Fine Pitch)', items: [
                  { val: 'P0.9', label: 'P0.9' }, { val: 'P1.2', label: 'P1.2' }, { val: 'P1.5', label: 'P1.5' },
                  { val: 'P1.8', label: 'P1.8' }, { val: 'P2.0', label: 'P2.0' }, { val: 'P2.5', label: 'P2.5' }
                ]
              },
              {
                type: 'group', label: 'Outdoor / Standard', items: [
                  { val: 'P3.0', label: 'P3.0' }, { val: 'P4.0', label: 'P4.0' }, { val: 'P5.0', label: 'P5.0' },
                  { val: 'P6.0', label: 'P6.0' }, { val: 'P8.0', label: 'P8.0' }, { val: 'P10.0', label: 'P10.0' },
                  { val: 'P16.0', label: 'P16.0' }
                ]
              }
            ]}
            onChange={handleChange}
          />
          <div className="ssp-group">
            <label className="ssp-label">Resolution (WxH) <span className="ssp-required">*</span><InfoTooltip text="Total number of pixels (Width x Height) determining image clarity; higher resolution equals sharper content display." /></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                name="resolution_width"
                className="ssp-input"
                placeholder="e.g. 1920"
                value={localData.resolution_width}
                onChange={handleChange}
                min="0"
                onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                disabled={isEditMode}
                style={isEditMode ? lockedStyle : {}}
              />
              <span style={{ color: '#6b7280' }}>x</span>
              <input
                type="number"
                name="resolution_height"
                className="ssp-input"
                placeholder="e.g. 1080"
                value={localData.resolution_height}
                onChange={handleChange}
                min="0"
                onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                disabled={isEditMode}
                style={isEditMode ? lockedStyle : {}}
              />
            </div>
          </div>
          <div className="ssp-group">
            <label className="ssp-label">Orientation</label>
            <input
              type="text"
              className="ssp-input"
              value={computed.orient}
              readOnly
              style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: '500' }}
            />
          </div>
        </div>

        {/* Row 3: Pixel Pitch, Brightness, Hz */}
        <div className="ssp-row three-col">


          <PremiumSelect
            label="Brightness (Nit)"
            name="brightness_nits"
            value={localData.brightness_nits}
            placeholder="Select..."
            options={[
              { val: '', label: 'Select...' },
              {
                type: 'group', label: 'Indoor', items: [
                  { val: '600', label: '600 nits (Standard Indoor)' }, { val: '800', label: '800 nits (High Bright Indoor)' }, { val: '1000', label: '1000 nits (Window Indoor)' }
                ]
              },
              {
                type: 'group', label: 'Outdoor', items: [
                  { val: '4000', label: '4000 nits (Semi-Outdoor)' }, { val: '5000', label: '5000 nits (Standard Outdoor)' }, { val: '6500', label: '6500 nits (High Bright Outdoor)' }, { val: '8000', label: '8000+ nits (Direct Sun)' }
                ]
              }
            ]}
            onChange={handleChange}
          />

          <PremiumSelect
            label="Refresh Rate (Hz)"
            name="refresh_rate_hz"
            value={localData.refresh_rate_hz}
            placeholder="Select..."
            options={[
              { val: '', label: 'Select...' },
              { val: '1920', label: '1920 Hz (Standard)' },
              { val: '3840', label: '3840 Hz (High Refresh)' },
              { val: '7680', label: '7680 Hz (Broadcast)' }
            ]}
            onChange={handleChange}
          />
        </div>

      </div>
    </div>
  )
}

export default Step2_Display

