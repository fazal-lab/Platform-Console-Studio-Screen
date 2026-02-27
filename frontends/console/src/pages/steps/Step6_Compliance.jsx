import { useState, useRef, useEffect } from 'react'

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
 * PremiumSelect component for CMS type with custom option
 */
function PremiumSelect({ label, value, options, onChange, name, placeholder = "Select...", required = false, info = null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)


  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        setShowCustomInput(false)
        setCustomValue('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showCustomInput])

  const handleSelect = (val) => {
    onChange({ target: { name, value: val } })
    setIsOpen(false)
    setShowCustomInput(false)
    setCustomValue('')
  }

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      handleSelect(customValue.trim())
    }
  }

  const selectedLabel = options.find(o => o.val === value)?.label || (value === '' ? placeholder : value) || placeholder

  return (
    <div className="ssp-group">
      {label && <label className="ssp-label">{label} {required && <span className="ssp-required">*</span>}{info && <InfoTooltip text={info} />}</label>}
      <div ref={containerRef} className="ssp-custom-select" style={{ position: 'relative' }}>
        <div
          className="ssp-input ssp-select-trigger"
          onClick={() => setIsOpen(!isOpen)}
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ color: value ? '#1f2937' : '#9ca3af' }}>{selectedLabel}</span>
          <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>
        </div>

        {isOpen && (
          <div className="ssp-dropdown" style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px', maxHeight: '200px', overflow: 'auto'
          }}>
            {options.map(opt => (
              <div
                key={opt.val}
                className="ssp-dropdown-item"
                onClick={() => handleSelect(opt.val)}
                style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = '#fff'}
              >
                {opt.label}
              </div>
            ))}
            {/* Custom Input Section */}
            {!showCustomInput ? (
              <div className="ssp-dropdown-item ssp-dropdown-custom-btn" onClick={(e) => { e.stopPropagation(); setShowCustomInput(true); }}
                style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: '#6B4EE6', fontWeight: '500', borderTop: '1px solid #e5e7eb' }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = '#fff'}
              >
                + Type Custom...
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
                  className="ssp-input"
                  style={{ width: '100%', fontSize: '13px', padding: '8px 10px' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Content Policy Modal
 */
function ContentPolicyModal({ isOpen, onClose, onAccept, isAccepted }) {
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    if (isOpen) setAgreed(isAccepted)
  }, [isOpen, isAccepted])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh',
        overflow: 'auto', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>Xigi Content Moderation Policy</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.7' }}>
          <p style={{ marginBottom: '16px' }}><strong>Effective Date:</strong> January 1, 2024</p>

          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>1. Purpose</h3>
          <p style={{ marginBottom: '16px' }}>
            This Content Moderation Policy outlines the standards and guidelines for all content displayed through Xigi's digital outdoor advertising network.
            All partners must adhere to these guidelines to ensure brand safety, legal compliance, and community standards.
          </p>

          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>2. Prohibited Content</h3>
          <p style={{ marginBottom: '8px' }}>The following content is strictly prohibited:</p>
          <ul style={{ marginBottom: '16px', paddingLeft: '20px' }}>
            <li>Illegal products, services, or activities</li>
            <li>Tobacco, vaping, or smoking-related advertisements</li>
            <li>Adult or sexually explicit content</li>
            <li>Content promoting violence, hatred, or discrimination</li>
            <li>Misleading or deceptive advertising claims</li>
            <li>Political campaign advertisements (unless pre-approved)</li>
            <li>Gambling or betting services (unless licensed)</li>
          </ul>

          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>3. Content Requirements</h3>
          <ul style={{ marginBottom: '16px', paddingLeft: '20px' }}>
            <li>All content must be clear, legible, and appropriate for public viewing</li>
            <li>Advertisements must not obstruct traffic visibility or public safety</li>
            <li>Content must comply with local, state, and national advertising regulations</li>
            <li>Audio content (where applicable) must not exceed permitted decibel levels</li>
          </ul>

          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>4. Review Process</h3>
          <p style={{ marginBottom: '16px' }}>
            All content submissions are subject to review by Xigi's moderation team.
            Content may be rejected or removed at any time if it violates this policy.
            Partners will be notified of any content removal decisions.
          </p>

          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>5. Partner Responsibilities</h3>
          <p style={{ marginBottom: '16px' }}>
            Partners are responsible for ensuring all submitted content complies with this policy,
            applicable laws, and intellectual property rights. Partners must maintain accurate
            inventory information and promptly update any changes.
          </p>

          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>6. Updates to Policy</h3>
          <p style={{ marginBottom: '16px' }}>
            Xigi reserves the right to update this policy at any time. Partners will be
            notified of significant changes via email or platform notification.
          </p>

          <div style={{ marginTop: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              By accepting this policy, you confirm that you have read, understood, and agree to comply
              with all the terms and conditions outlined above.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <label className="ssp-white-checkbox" style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: '4px' }}
            />
            <span className="ssp-checkmark" style={{ marginTop: '4px' }}></span>
            <span style={{ fontSize: '14px', color: '#374151', marginLeft: '12px' }}>
              I hereby accept the Xigi Content Moderation Policy and verify all inventory data provided is legally valid.
            </span>
          </label>
        </div>

        <button
          disabled={!agreed}
          onClick={() => { onAccept(); onClose(); }}
          style={{
            marginTop: '20px', width: '100%', padding: '12px', background: agreed ? '#6B4EE6' : '#d1d5db', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: agreed ? 'pointer' : 'not-allowed'
          }}
        >
          Accept & Continue
        </button>
      </div>
    </div>
  )
}

function Step6_Compliance({ data, update, isEditMode = false }) {
  const [localData, setLocalData] = useState({
    // Proof & Monitoring
    cms_type: data.cms_type || '',
    cms_api: data.cms_api || '',
    ai_camera_installed: data.ai_camera_installed || false,
    screen_health_ping: data.screen_health_ping || false,
    playback_logs: data.playback_logs || false,
    ai_camera_api: data.ai_camera_api || '',
    screen_image_front: data.screen_image_front || null,
    screen_image_back: data.screen_image_back || null,
    screen_image_long: data.screen_image_long || null,

    // Documents & GST
    ownership_proof_uploaded: data.ownership_proof_uploaded || null,
    permission_noc_available: data.permission_noc_available || null,
    gst: data.gst || '',
    content_policy_accepted: data.content_policy_accepted || false
  })

  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const ownershipRef = useRef(null)
  const nocRef = useRef(null)
  const imageFrontRef = useRef(null)
  const imageBackRef = useRef(null)
  const imageLongRef = useRef(null)

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target

    // 🔹 File Handling
    if (type === 'file') {
      const file = files[0]
      setLocalData(prev => ({ ...prev, [name]: file }))
      update({ [name]: file })
    }

    // 🔹 CMS Type Condition (KEEP THIS)
    else if (name === 'cms_type') {

      const apiVal = value === 'Xigi CMS'
        ? 'https://in.vnnox.com/'
        : ''

      setLocalData(prev => ({
        ...prev,
        cms_type: value,
        cms_api: apiVal
      }))

      update({
        cms_type: value,
        cms_api: apiVal
      })
    }

    // 🔹 Other Fields
    else {

      let val = type === 'checkbox' ? checked : value

      if (name === 'gst' && typeof val === 'string') {
        val = val.toUpperCase()
      }

      setLocalData(prev => ({
        ...prev,
        [name]: val
      }))

      update({ [name]: val })
    }
  }

  const triggerUpload = (ref) => {
    ref.current?.click()
  }

  return (
    <div className="ssp-step-content">
      {/* Content Policy Modal */}
      <ContentPolicyModal
        isOpen={showPolicyModal}
        isAccepted={localData.content_policy_accepted}
        onClose={() => setShowPolicyModal(false)}
        onAccept={() => {
          setLocalData(prev => ({ ...prev, content_policy_accepted: true }))
          update({ content_policy_accepted: true })
        }}
      />

      {/* Section 1: Proof & Monitoring — LOCKED in edit mode */}
      <div style={isEditMode ? { opacity: 0.6, pointerEvents: 'none' } : {}}>
        <h4 className="ssp-section-subtitle" style={{ marginTop: 0 }}>Proof & monitoring</h4>

        {/* CMS Type Dropdown - PremiumSelect with custom */}
        <PremiumSelect
          label="CMS type"
          name="cms_type"
          value={localData.cms_type}
          placeholder="Select..."
          required
          info="Content Management System for scheduling ads. 'Xigi CMS' means we handle content delivery. 'Partner CMS' means you manage playback using your own system."
          options={[
            { val: '', label: 'Select...' },
            { val: 'Xigi CMS', label: 'Xigi CMS' },
          ]}
          onChange={handleChange}
        />

        {/* CMS API - Full Width */}
        <div className="ssp-group" style={{ marginTop: '16px' }}>
          <label className="ssp-label"> CMS (API) <span className="ssp-required">*</span><InfoTooltip text="If you use your own content management system, enter the API endpoint here. Xigi will use this to send ad content and scheduling commands to your system." /></label>
          <input
            type="text"
            name="cms_api"
            className="ssp-input"
            placeholder="API"
            value={localData.cms_api}
            onChange={handleChange}
            readOnly={localData.cms_type === 'Xigi CMS'}
            style={localData.cms_type === 'Xigi CMS' ? { backgroundColor: '#f3f4f6', color: '#6b7280' } : {}}
          />
        </div>

        {/* All 4 Checkboxes in One Row - White checkboxes with custom styling */}
        <div style={{ display: 'flex', gap: '32px', marginTop: '20px', flexWrap: 'wrap' }}>
          <label className="ssp-white-checkbox">
            <input
              type="checkbox"
              name="ai_camera_installed"
              checked={localData.ai_camera_installed}
              onChange={handleChange}
            />
            <span className="ssp-checkmark"></span>
            AI Camera Installed<InfoTooltip text="AI-powered camera for audience measurement. Collects anonymous data like viewer count, dwell time, and demographics without storing personal information." />
          </label>
          <label className="ssp-white-checkbox">
            <input
              type="checkbox"
              name="screen_health_ping"
              checked={localData.screen_health_ping}
              onChange={handleChange}
            />
            <span className="ssp-checkmark"></span>
            Screen Health Ping<InfoTooltip text="Automatic monitoring that reports screen status (online/offline), connectivity issues, and hardware health to Xigi servers in real-time." />
          </label>

          <label className="ssp-white-checkbox">
            <input
              type="checkbox"
              name="playback_logs"
              checked={localData.playback_logs}
              onChange={handleChange}
            />
            <span className="ssp-checkmark"></span>
            Playback Logs<InfoTooltip text="Detailed logs of what content played and when. Useful for troubleshooting, auditing, and providing advertisers with playback reports." />
          </label>
        </div>

        {/* AI Camera API - Only visible when AI Camera Installed is checked */}
        {localData.ai_camera_installed && (
          <div className="ssp-group" style={{ marginTop: '20px', maxWidth: '400px' }}>
            <label className="ssp-label">AI Camera (API) <span className="ssp-required">*</span><InfoTooltip text="API endpoint for the AI camera system. This allows Xigi to receive audience analytics and measurement data from your camera." /></label>
            <input
              type="text"
              name="ai_camera_api"
              className="ssp-input"
              placeholder="API"
              value={localData.ai_camera_api}
              onChange={handleChange}
            />
          </div>
        )}

        {/* Section 2: Documents & GST */}
        <h4 className="ssp-section-subtitle" style={{ marginTop: '32px' }}>Documents & GST</h4>

        {/* Checklist Status - Styled input boxes */}
        <div className="ssp-group">
          <label className="ssp-label" style={{ marginBottom: '12px' }}>Checklist Status <span className="ssp-required">*</span></label>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {/* Ownership Proof */}
            <div style={{ flex: 1, minWidth: '280px' }}>
              <label className="ssp-label" style={{ fontSize: '13px', marginBottom: '6px' }}>Ownership Proof / Tax Title</label>
              <div
                onClick={() => triggerUpload(ownershipRef)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '14px', color: localData.ownership_proof_uploaded ? '#1f2937' : '#9ca3af' }}>
                  {localData.ownership_proof_uploaded
                    ? (typeof localData.ownership_proof_uploaded === 'string'
                      ? localData.ownership_proof_uploaded.split('/').pop()
                      : localData.ownership_proof_uploaded.name)
                    : 'Choose file (PDF only)'}
                </span>
                <span style={{ color: '#6B4EE6', fontWeight: '600', fontSize: '14px' }}>
                  {localData.ownership_proof_uploaded ? '✓' : 'Upload'}
                </span>
              </div>
              <input
                type="file"
                ref={ownershipRef}
                name="ownership_proof_uploaded"
                accept=".pdf"
                onChange={handleChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Municipality NOC */}
            <div style={{ flex: 1, minWidth: '280px' }}>
              <label className="ssp-label" style={{ fontSize: '13px', marginBottom: '6px' }}>Municipality NOC</label>
              <div
                onClick={() => triggerUpload(nocRef)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '14px', color: localData.permission_noc_available ? '#1f2937' : '#9ca3af' }}>
                  {localData.permission_noc_available
                    ? (typeof localData.permission_noc_available === 'string'
                      ? localData.permission_noc_available.split('/').pop()
                      : localData.permission_noc_available.name)
                    : 'Choose file (PDF only)'}
                </span>
                <span style={{ color: '#6B4EE6', fontWeight: '600', fontSize: '14px' }}>
                  {localData.permission_noc_available ? '✓' : 'Upload'}
                </span>
              </div>
              <input
                type="file"
                ref={nocRef}
                name="permission_noc_available"
                accept=".pdf"
                onChange={handleChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* GST Details - Narrower */}
        <div className="ssp-group" style={{ marginTop: '20px', maxWidth: '400px' }}>
          <label className="ssp-label">GST Details <span className="ssp-required">*</span></label>
          <input
            type="text"
            name="gst"
            className="ssp-input"
            placeholder="GSTIN-00XXX0000X"
            value={localData.gst}
            onChange={handleChange}
          />
        </div>
      </div>
      {/* End of locked section */}

      {/* Screen Images Upload - Enhanced 3 Box Layout (EDITABLE in edit mode) */}
      <div className="ssp-group" style={{ marginTop: '32px' }}>
        <label className="ssp-label" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Screen Images <span className="ssp-required">*</span></span>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400' }}>
            Please upload 3 distinct views
          </span>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { name: 'screen_image_front', label: 'Front View', ref: imageFrontRef, data: localData.screen_image_front },
            { name: 'screen_image_back', label: 'Back / Side View', ref: imageBackRef, data: localData.screen_image_back },
            { name: 'screen_image_long', label: 'Long Shot / Context', ref: imageLongRef, data: localData.screen_image_long }
          ].map((box) => (
            <div key={box.name}>
              <div
                onClick={() => box.ref.current?.click()}
                style={{
                  height: '160px',
                  border: '1.5px dashed #e5e7eb',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: box.data ? `url(${typeof box.data === 'string' ? box.data : URL.createObjectURL(box.data)}) center/cover no-repeat` : '#fdfdfd',
                  position: 'relative',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
                className="ssp-image-upload-box"
                onMouseEnter={(e) => {
                  if (!box.data) {
                    e.currentTarget.style.borderColor = '#6B4EE6';
                    e.currentTarget.style.background = '#f9f8ff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 78, 230, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!box.data) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.background = '#fdfdfd';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                  }
                }}
              >
                {!box.data ? (
                  <div style={{ textAlign: 'center', padding: '0 12px' }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#374151',
                      marginBottom: '4px',
                      letterSpacing: '-0.01em'
                    }}>
                      {box.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>
                      Click to upload
                    </div>
                  </div>
                ) : (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: '12px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s', backdropFilter: 'blur(2px)'
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                  >
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>{box.label}</div>
                    <span style={{
                      color: '#fff', fontSize: '11px', fontWeight: '600', padding: '6px 16px',
                      background: '#6B4EE6', borderRadius: '20px', boxShadow: '0 2px 8px rgba(107, 78, 230, 0.3)'
                    }}>
                      Replace Image
                    </span>
                  </div>
                )}
              </div>
              <input
                type="file"
                name={box.name}
                accept="image/png, image/jpeg"
                ref={box.ref}
                onChange={handleChange}
                style={{ display: 'none' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Content Policy Acceptance — LOCKED in edit mode */}
      <div className="ssp-group" style={isEditMode ? {
        marginTop: '24px',
        background: localData.content_policy_accepted ? '#f0fdf4' : '#f0f4ff',
        padding: '16px',
        borderRadius: '8px',
        border: localData.content_policy_accepted ? '1px solid #bbf7d0' : '1px solid #e0e7ff',
        opacity: 0.6, pointerEvents: 'none'
      } : {
        marginTop: '24px',
        background: localData.content_policy_accepted ? '#f0fdf4' : '#f0f4ff',
        padding: '16px',
        borderRadius: '8px',
        border: localData.content_policy_accepted ? '1px solid #bbf7d0' : '1px solid #e0e7ff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>
              {localData.content_policy_accepted ? '✓ Content Moderation Policy Accepted' : 'Content Moderation Policy'}
            </span>
            {!localData.content_policy_accepted && (
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>
                Review and accept our policy to verify your inventory data provided is legally valid.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPolicyModal(true)}
            style={{
              background: localData.content_policy_accepted ? '#fff' : '#6B4EE6',
              color: localData.content_policy_accepted ? '#16a34a' : '#fff',
              border: `1px solid ${localData.content_policy_accepted ? '#16a34a' : '#6B4EE6'}`,
              padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            {localData.content_policy_accepted ? 'View Policy' : 'Review & Accept'}
          </button>
        </div>
      </div>

    </div>
  )
}

export default Step6_Compliance
