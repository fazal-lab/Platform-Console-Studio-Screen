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

function TimePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value "11:00 PM"
  const parseTime = (v) => {
    if (!v) return { h: '12', m: '00', p: 'AM' };
    const m = v.match(/(\d+):(\d+)\s?(AM|PM)/i);
    if (!m) return { h: '12', m: '00', p: 'AM' };
    return { h: m[1], m: m[2], p: m[3].toUpperCase() };
  };

  const time = parseTime(value);

  // Options
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const periods = ['AM', 'PM'];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (h, m, p) => {
    onChange(`${h}:${m} ${p}`);
  };

  return (
    <div className="ssp-time-picker-wrapper" ref={containerRef}>
      <div className="ssp-time-display" onClick={() => setIsOpen(!isOpen)}>
        <span style={{ color: value ? '#1f2937' : '#9ca3af' }}>{value || 'Select...'}</span>
        <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>
      </div>

      {isOpen && (
        <div className="ssp-time-dropdown">
          <div className="ssp-time-selector">
            <div className="ssp-time-col">
              {hours.map(h => (
                <div
                  key={h}
                  className={`ssp-time-val ${time.h === h ? 'active' : ''}`}
                  onClick={() => handleSelect(h, time.m, time.p)}
                >
                  {h}
                </div>
              ))}
            </div>
            <div className="ssp-time-divider">:</div>
            <div className="ssp-time-col">
              {minutes.map(m => (
                <div
                  key={m}
                  className={`ssp-time-val ${time.m === m ? 'active' : ''}`}
                  onClick={() => handleSelect(time.h, m, time.p)}
                >
                  {m}
                </div>
              ))}
            </div>
            <div className="ssp-time-col">
              {periods.map(p => (
                <div
                  key={p}
                  className={`ssp-time-val ${time.p === p ? 'active' : ''}`}
                  onClick={() => handleSelect(time.h, time.m, p)}
                >
                  {p}
                </div>
              ))}
            </div>
          </div>
          <div className="ssp-time-actions">
            <button className="ssp-time-ok-btn" onClick={() => setIsOpen(false)}>DONE</button>
          </div>
        </div>
      )}
    </div>
  );
}
function Step4_Playback({ data, update, isEditMode = false, screenId = null }) {
  const lockedStyle = { backgroundColor: '#f3f4f6', color: '#6b7280', pointerEvents: 'none' }
  const [localData, setLocalData] = useState({
    // Playback
    standard_ad_duration_sec: data.standard_ad_duration_sec || '',
    total_slots_per_loop: data.total_slots_per_loop || '',
    loop_length_sec: data.loop_length_sec || '',
    reserved_slots: data.reserved_slots || '',

    // Connectivity
    max_file_size_mb: data.max_file_size_mb || '',
    internet_type: data.internet_type || '',
    average_bandwidth_mbps: data.average_bandwidth_mbps || '',
    power_backup_type: data.power_backup_type || '',
    days_active_per_week: data.days_active_per_week || '',
    downtime_windows: data.downtime_windows || '',
    enable_downtime: data.enable_downtime || false,
    audio_supported: data.audio_supported || false,
    backup_internet: data.backup_internet || false
  })

  const [activeDropdown, setActiveDropdown] = useState(null)
  const [slotError, setSlotError] = useState('')
  const [availableSlotInfo, setAvailableSlotInfo] = useState(null)

  // In edit mode, compute the max allowed for reserved_slots
  const maxReservable = isEditMode && availableSlotInfo ? availableSlotInfo.available_for_reservation : null;
  const isReservedLocked = isEditMode && availableSlotInfo && maxReservable <= 0;

  // Fetch booked slots from existing slot-bookings API when in edit mode
  useEffect(() => {
    if (isEditMode && screenId) {
      fetch(`http://localhost:8000/api/console/slot-bookings/?screen=${screenId}`)
        .then(res => res.json())
        .then(result => {
          // Sum num_slots for ACTIVE and HOLD bookings only
          const bookings = result.bookings || []
          const bookedSlots = bookings
            .filter(b => b.status === 'ACTIVE' || b.status === 'HOLD')
            .reduce((sum, b) => sum + (b.num_slots || 0), 0)

          const totalSlots = parseInt(data.total_slots_per_loop) || 0
          const currentReserved = parseInt(data.reserved_slots) || 0
          const availableSlots = totalSlots - currentReserved - bookedSlots

          setAvailableSlotInfo({
            total_slots: totalSlots,
            booked_slots: bookedSlots,
            current_reserved: currentReserved,
            available_slots: Math.max(availableSlots, 0),
            available_for_reservation: Math.max(totalSlots - bookedSlots, 0),
          })
        })
        .catch(err => console.error('Failed to fetch slot bookings:', err))
    }
  }, [isEditMode, screenId])

  // Slot Validation
  useEffect(() => {
    const total = parseInt(localData.total_slots_per_loop) || 0
    const reserved = parseInt(localData.reserved_slots) || 0

    if (isEditMode && availableSlotInfo) {
      if (reserved > maxReservable) {
        setSlotError(`Cannot exceed ${maxReservable} reserved slots (${availableSlotInfo.booked_slots} of ${availableSlotInfo.total_slots} slots are booked)`)
      } else {
        setSlotError('')
      }
    } else if (total > 0 && reserved >= total) {
      setSlotError('Reserved slots must be less than total slots')
    } else {
      setSlotError('')
    }
  }, [localData.total_slots_per_loop, localData.reserved_slots, isEditMode, availableSlotInfo])

  const internetRef = useRef(null)
  const bandwidthRef = useRef(null)
  const powerRef = useRef(null)

  // Inline custom input states
  const [customInternet, setCustomInternet] = useState('')
  const [customBandwidth, setCustomBandwidth] = useState('')
  const [customPower, setCustomPower] = useState('')

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (activeDropdown && ![internetRef, bandwidthRef, powerRef].some(ref => ref.current && ref.current.contains(event.target))) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [activeDropdown])

  // Auto-fill max_file_size_mb based on orientation from Step 2
  useEffect(() => {
    const orientation = data.orientation || '';
    if (orientation === 'LANDSCAPE') {
      setLocalData(prev => ({ ...prev, max_file_size_mb: '1 GB' }))
      update({ max_file_size_mb: '1 GB' })
    } else if (orientation === 'PORTRAIT') {
      setLocalData(prev => ({ ...prev, max_file_size_mb: '100 MB' }))
      update({ max_file_size_mb: '100 MB' })
    }
  }, [data.orientation])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    if (value === 'OTHER_CUSTOM') {
      setCustomFields(prev => ({ ...prev, [name]: true }))
      // Clear value for custom typing
      setLocalData(prev => ({ ...prev, [name]: '' }))
      update({ [name]: '' })
    } else {
      const val = type === 'checkbox' ? checked : value

      // In edit mode, clamp reserved_slots to max allowed
      let finalVal = val
      if (isEditMode && name === 'reserved_slots' && maxReservable !== null) {
        const numVal = parseInt(val)
        if (!isNaN(numVal) && numVal > maxReservable) {
          finalVal = String(maxReservable)
        }
        if (!isNaN(numVal) && numVal < 0) {
          finalVal = '0'
        }
      }

      setLocalData(prev => {
        const newData = { ...prev, [name]: finalVal }
        if (name === 'enable_downtime' && !checked) {
          newData.downtime_windows = ''
        }
        return newData
      })

      const updatePayload = { [name]: finalVal }
      if (name === 'enable_downtime' && !checked) {
        updatePayload.downtime_windows = ''
      }
      update(updatePayload)
    }
  }

  // Toggle back to dropdown
  const handleRevertToDropdown = (field) => {
    setCustomFields(prev => ({ ...prev, [field]: false }))
    setLocalData(prev => ({ ...prev, [field]: '' }))
    update({ [field]: '' })
  }

  // Auto-calculate Loop Length
  useEffect(() => {
    const duration = parseInt(localData.standard_ad_duration_sec) || 0
    const slots = parseInt(localData.total_slots_per_loop) || 0
    const calculatedLoop = duration * slots

    // Only update to parent if meaningful change
    if (calculatedLoop !== data.loop_length_sec && calculatedLoop > 0) {
      update({ loop_length_sec: calculatedLoop })
    }
  }, [localData.standard_ad_duration_sec, localData.total_slots_per_loop])



  return (
    <div className="ssp-step-content">
      {/* Playback & Slot Rules */}

      {/* Row 1: Duration, Total Slot, Loop Length */}
      <div className="ssp-row three-col" style={isEditMode ? { opacity: 0.6, pointerEvents: 'none' } : {}}>
        <div className="ssp-group">
          <label className="ssp-label">Standard Ad Duration (s) <span className="ssp-required">*</span><InfoTooltip text="The default length of each ad slot in seconds. This determines how long each advertisement plays before switching to the next." /></label>
          <input
            type="number"
            name="standard_ad_duration_sec"
            className="ssp-input"
            value={localData.standard_ad_duration_sec}
            onChange={handleChange}
            placeholder="e.g. 15"
            min="0"
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e') {
                e.preventDefault();
              }
            }}
          />
        </div>
        <div className="ssp-group">
          <label className="ssp-label">Total Slot <span className="ssp-required">*</span><InfoTooltip text="Number of ad slots per loop. For example, 12 slots × 10 sec = 2 minute loop. Advertisers compete for these slots." /></label>
          <input
            type="number"
            name="total_slots_per_loop"
            className="ssp-input"
            value={localData.total_slots_per_loop}
            onChange={handleChange}
            placeholder="e.g. 20"
            min="0"
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e') {
                e.preventDefault();
              }
            }}
          />
        </div>
        <div className="ssp-group">
          <label className="ssp-label">Loop Length (min:sec) <span className="ssp-required">*</span><InfoTooltip text="Auto-calculated from Duration × Slots. This is how long one complete advertising cycle takes before repeating." /></label>
          <input
            type="text"
            name="loop_length_sec"
            className="ssp-input"
            value={(() => {
              const sec = localData.standard_ad_duration_sec && localData.total_slots_per_loop ?
                parseInt(localData.standard_ad_duration_sec) * parseInt(localData.total_slots_per_loop) : 0
              if (!sec) return 'Auto - Calculated'
              const m = Math.floor(sec / 60)
              const s = sec % 60
              return `${m}:${s < 10 ? '0' + s : s}`
            })()}
            readOnly
            style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
          />
        </div>
      </div>

      {/* Row 2: Reserved Slot, Max File */}
      <div className="ssp-row" style={{
        display: 'grid', gridTemplateColumns: '140px 1fr', gap: '20px', alignItems: 'start'
      }}>
        <div className="ssp-group">
          <label className="ssp-label">Reserved Slot <span className="ssp-required">*</span><InfoTooltip text="Slots kept for screen owner's own content (e.g., your own ads, promos). These are not available for sale to advertisers." /></label>
          <input
            type="number"
            name="reserved_slots"
            className={`ssp-input ${slotError ? 'ssp-input-error' : ''}`}
            value={localData.reserved_slots}
            onChange={handleChange}
            placeholder="e.g. 2"
            min="0"
            max={isEditMode && availableSlotInfo ? availableSlotInfo.available_for_reservation : undefined}
            disabled={isReservedLocked}
            style={{
              borderColor: slotError ? '#ef4444' : '',
              ...(isReservedLocked ? { backgroundColor: '#f3f4f6', color: '#6b7280' } : {})
            }}
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e') {
                e.preventDefault();
              }
            }}
          />
          {slotError && <div className="ssp-error-msg" style={{ color: '#ef4444', fontSize: '11px', fontWeight: '600', marginTop: '4px' }}>{slotError}</div>}
          {isEditMode && availableSlotInfo && !isReservedLocked && (
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              <strong style={{ color: '#22c55e' }}>{Math.max(availableSlotInfo.available_for_reservation - (parseInt(localData.reserved_slots) || 0), 0)}</strong> out of <strong>{availableSlotInfo.available_for_reservation}</strong> slots available
            </div>
          )}
          {isReservedLocked && (
            <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
              No slots available — cannot modify reservation
            </div>
          )}
        </div>
        <div className="ssp-group">
          <label className="ssp-label">Max File Size <span className="ssp-required">*</span><InfoTooltip text="Auto-set based on orientation. Landscape = 1 GB, Portrait = 100 MB." /></label>
          <input
            type="text"
            className="ssp-input"
            value={localData.max_file_size_mb || (data.orientation ? 'Auto-calculated' : 'Set orientation in Step 2')}
            readOnly
            style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
          />
        </div>
      </div>



      {/* Connectivity & Ops Section */}
      <h4 className="ssp-subtitle" style={{ marginTop: '24px' }}>Connectivity & Ops</h4>

      {/* Row 4: Internet, Bandwidth, Power */}
      <div className="ssp-row three-col">
        <div className="ssp-group" ref={internetRef} style={{ position: 'relative' }}>
          <label className="ssp-label">Internet Type <span className="ssp-required">*</span></label>
          <div
            className="ssp-input"
            onClick={() => setActiveDropdown(activeDropdown === 'internet' ? null : 'internet')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: activeDropdown === 'internet' ? '#6B4EE6' : '#d1d5db' }}
          >
            <span>{localData.internet_type || 'Select...'}</span>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>
          </div>

          {activeDropdown === 'internet' && (
            <div className="ssp-dropdown-list ssp-dropdown-light">
              {['Select...', 'Fiber Optics', '4G / LTE', '5G', 'Broadband', 'WiFi'].map(type => (
                <div
                  key={type}
                  className={`ssp-dropdown-item ${localData.internet_type === (type === 'Select...' ? '' : type) ? 'selected' : ''}`}
                  onClick={() => {
                    const finalVal = type === 'Select...' ? '' : type
                    setLocalData(prev => ({ ...prev, internet_type: finalVal }))
                    update({ internet_type: finalVal })
                    setActiveDropdown(null)
                  }}
                >
                  {type}
                </div>
              ))}
              {/* Inline Custom Input */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Starlink"
                    value={customInternet}
                    onChange={(e) => setCustomInternet(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customInternet) {
                        setLocalData(prev => ({ ...prev, internet_type: customInternet }))
                        update({ internet_type: customInternet })
                        setCustomInternet('')
                        setActiveDropdown(null)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#fff', color: '#1f2937' }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (customInternet) {
                        setLocalData(prev => ({ ...prev, internet_type: customInternet }))
                        update({ internet_type: customInternet })
                        setCustomInternet('')
                        setActiveDropdown(null)
                      }
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
        <div className="ssp-group" ref={bandwidthRef} style={{ position: 'relative' }}>
          <label className="ssp-label">Bandwidth <span className="ssp-required">*</span></label>
          <div
            className="ssp-input"
            onClick={() => setActiveDropdown(activeDropdown === 'bandwidth' ? null : 'bandwidth')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: activeDropdown === 'bandwidth' ? '#6B4EE6' : '#d1d5db' }}
          >
            <span>{localData.average_bandwidth_mbps || 'Select...'}</span>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>
          </div>

          {activeDropdown === 'bandwidth' && (
            <div className="ssp-dropdown-list ssp-dropdown-light">
              {['Select...', '10 Mbps', '25 Mbps', '50 Mbps', '100 Mbps', '200 Mbps', '500 Mbps', '1 Gbps'].map(bw => (
                <div
                  key={bw}
                  className={`ssp-dropdown-item ${localData.average_bandwidth_mbps === (bw === 'Select...' ? '' : bw) ? 'selected' : ''}`}
                  onClick={() => {
                    const finalVal = bw === 'Select...' ? '' : bw
                    setLocalData(prev => ({ ...prev, average_bandwidth_mbps: finalVal }))
                    update({ average_bandwidth_mbps: finalVal })
                    setActiveDropdown(null)
                  }}
                >
                  {bw}
                </div>
              ))}
              {/* Inline Custom Input */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <input
                  type="text"
                  placeholder="Type and press Enter..."
                  value={customBandwidth}
                  onChange={(e) => setCustomBandwidth(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customBandwidth) {
                      const finalVal = customBandwidth.toLowerCase().includes('mbps') || customBandwidth.toLowerCase().includes('gbps') ? customBandwidth : `${customBandwidth} Mbps`
                      setLocalData(prev => ({ ...prev, average_bandwidth_mbps: finalVal }))
                      update({ average_bandwidth_mbps: finalVal })
                      setCustomBandwidth('')
                      setActiveDropdown(null)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#fff', color: '#1f2937', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="ssp-group" ref={powerRef} style={{ position: 'relative' }}>
          <label className="ssp-label">Power Backup <span className="ssp-required">*</span></label>
          <div
            className="ssp-input"
            onClick={() => setActiveDropdown(activeDropdown === 'power' ? null : 'power')}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: activeDropdown === 'power' ? '#6B4EE6' : '#d1d5db' }}
          >
            <span>{localData.power_backup_type || 'Select...'}</span>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>
          </div>

          {activeDropdown === 'power' && (
            <div className="ssp-dropdown-list ssp-dropdown-light">
              {['Select...', 'None', 'UPS Only', 'Generator Only', 'UPS + Generator'].map(type => (
                <div
                  key={type}
                  className={`ssp-dropdown-item ${localData.power_backup_type === (type === 'Select...' ? '' : type) ? 'selected' : ''}`}
                  onClick={() => {
                    const finalVal = type === 'Select...' ? '' : type
                    setLocalData(prev => ({ ...prev, power_backup_type: finalVal }))
                    update({ power_backup_type: finalVal })
                    setActiveDropdown(null)
                  }}
                >
                  {type}
                </div>
              ))}
              {/* Inline Custom Input */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Solar Backup"
                    value={customPower}
                    onChange={(e) => setCustomPower(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customPower) {
                        setLocalData(prev => ({ ...prev, power_backup_type: customPower }))
                        update({ power_backup_type: customPower })
                        setCustomPower('')
                        setActiveDropdown(null)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#fff', color: '#1f2937' }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (customPower) {
                        setLocalData(prev => ({ ...prev, power_backup_type: customPower }))
                        update({ power_backup_type: customPower })
                        setCustomPower('')
                        setActiveDropdown(null)
                      }
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


      {/* Row 5: Days Active, Downtime */}
      <div className="ssp-row" style={isEditMode ? { opacity: 0.6, pointerEvents: 'none' } : {}}>
        <div className="ssp-group">
          <label className="ssp-label">Days Active per week <span className="ssp-required">*</span></label>
          <input
            type="number"
            name="days_active_per_week"
            className="ssp-input"
            value={localData.days_active_per_week}
            onChange={handleChange}
            min="1" max="7"
            placeholder="e.g. 7"
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e') {
                e.preventDefault();
              }
            }}
          />
        </div>
        <div className="ssp-group">
          <label className="ssp-checkbox-wrapper" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              name="enable_downtime"
              className="ssp-checkbox-input"
              checked={localData.enable_downtime}
              onChange={handleChange}
            />
            <span className="ssp-checkbox-label" style={{ fontWeight: '600', color: '#374151' }}>Enable Downtime Windows</span>
            <InfoTooltip text="Check this if the screen has specific periods where it's switched off (e.g., 11:00 PM - 06:00 AM)." />
          </label>

          {localData.enable_downtime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <TimePicker
                value={localData.downtime_windows ? localData.downtime_windows.split(' - ')[0] : ''}
                onChange={(newTime) => {
                  const currentEnd = (localData.downtime_windows && localData.downtime_windows.includes(' - ')) ? localData.downtime_windows.split(' - ')[1] : ''
                  if (currentEnd && newTime === currentEnd) {
                    alert("Start time and End time cannot be the same.")
                    return
                  }
                  const newVal = currentEnd ? `${newTime} - ${currentEnd}` : newTime
                  setLocalData(prev => ({ ...prev, downtime_windows: newVal }))
                  update({ downtime_windows: newVal })
                }}
              />
              <span style={{ color: '#6b7280', fontSize: '16px' }}>→</span>
              <TimePicker
                value={(localData.downtime_windows && localData.downtime_windows.includes(' - ')) ? localData.downtime_windows.split(' - ')[1] : ''}
                onChange={(newTime) => {
                  const currentStart = localData.downtime_windows ? localData.downtime_windows.split(' - ')[0] : ''
                  if (currentStart && newTime === currentStart) {
                    alert("Start time and End time cannot be the same.")
                    return
                  }
                  const newVal = currentStart ? `${currentStart} - ${newTime}` : newTime
                  setLocalData(prev => ({ ...prev, downtime_windows: newVal }))
                  update({ downtime_windows: newVal })
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Checkboxes */}
      <div className="ssp-row" style={isEditMode ? { opacity: 0.6, pointerEvents: 'none', marginTop: '12px' } : { marginTop: '12px' }}>
        <div className="ssp-group" style={{ flexDirection: 'row', gap: '32px', display: 'flex' }}>
          <label className="ssp-checkbox-wrapper">
            <input
              type="checkbox"
              name="audio_supported"
              className="ssp-checkbox-input"
              checked={localData.audio_supported}
              onChange={handleChange}
            />
            <span className="ssp-checkbox-label">Audio Support</span>
          </label>
          <label className="ssp-checkbox-wrapper">
            <input
              type="checkbox"
              name="backup_internet"
              className="ssp-checkbox-input"
              checked={localData.backup_internet}
              onChange={handleChange}
            />
            <span className="ssp-checkbox-label">Backup Internet</span>
          </label>
        </div>
      </div>

    </div>
  )
}

export default Step4_Playback
