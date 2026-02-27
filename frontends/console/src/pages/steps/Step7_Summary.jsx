/**
 * Step 7: Summary/Review Component
 * Shows all form data for final verification before submission
 */
function Step7_Summary({ data, adminName, onGoBack, onConfirmSubmit, isSubmitting }) {
  // Helper to display arrays nicely
  const formatArray = (arr) => {
    if (!arr || arr.length === 0) return 'None'
    return arr.join(', ')
  }

  // Helper to display boolean
  const formatBool = (val) => val ? '✓ Yes' : '✗ No'

  // Compute orientation from resolution (same logic as Step2)
  const getOrientation = () => {
    const w = parseInt(data.resolution_width) || 0
    const h = parseInt(data.resolution_height) || 0
    if (!w || !h) return null
    if (w > h) return 'LANDSCAPE'
    if (h > w) return 'PORTRAIT'
    return 'SQUARE'
  }

  // Compute aspect ratio
  const getAspectRatio = () => {
    const w = parseInt(data.resolution_width) || 0
    const h = parseInt(data.resolution_height) || 0
    if (!w || !h) return null
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
    const d = gcd(w, h)
    return `${w / d}:${h / d}`
  }

  // Helper to create clickable file preview link
  const FileLink = ({ file, label }) => {
    if (!file) return <span style={{ color: '#dc2626' }}>✗ Not uploaded</span>

    const isUrl = typeof file === 'string'
    const url = isUrl ? file : URL.createObjectURL(file)
    const displayName = isUrl ? file.split('/').pop() : (file.name || label)

    const handleClick = () => {
      window.open(url, '_blank')
    }

    return (
      <span
        onClick={handleClick}
        style={{
          color: '#6B4EE6',
          cursor: 'pointer',
          textDecoration: 'underline',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title="Click to preview file"
      >
        📄 {displayName}
      </span>
    )
  }

  // Section component for consistent styling
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: '24px' }}>
      <h4 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#6B4EE6',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '2px solid #6B4EE6'
      }}>
        {title}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 24px' }}>
        {children}
      </div>
    </div>
  )

  // Field display component
  const Field = ({ label, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
        {value || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not provided</span>}
      </span>
    </div>
  )

  // Helper to create a thumbnail preview for images
  const ImagePreview = ({ file, label }) => {
    if (!file) return <span style={{ color: '#dc2626', fontSize: '14px' }}>✗ Not uploaded</span>

    const url = typeof file === 'string' ? file : URL.createObjectURL(file)

    return (
      <div
        onClick={() => window.open(url, '_blank')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '8px',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '4px',
          background: `url(${url}) center/cover no-repeat`,
          border: '1px solid #e5e7eb'
        }} />
        <span style={{ color: '#6B4EE6', fontSize: '14px', fontWeight: '500', textDecoration: 'underline' }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div className="ssp-step-content">
      <div style={{
        background: 'linear-gradient(135deg, #6B4EE6 0%, #8B6EF6 100%)',
        color: '#fff',
        padding: '20px 24px',
        borderRadius: '12px',
        marginBottom: '24px',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>📋 Review Your Screen Specification</h3>
        <p style={{ margin: '8px 0 0', opacity: 0.9, fontSize: '14px' }}>
          Please verify all information before final submission
        </p>
      </div>

      {/* Step 1: Identifiers */}
      <Section title="1. Identifiers & Location">
        <Field label="Added By" value={adminName || null} />
        <Field label="Screen Name" value={data.screen_name} />
        <Field label="Role" value={data.role ? data.role.charAt(0).toUpperCase() + data.role.slice(1) : null} />
        <Field label="City" value={data.city} />
        <Field label="Latitude" value={data.latitude} />
        <Field label="Longitude" value={data.longitude} />
        <Field label="Full Address" value={data.full_address} />
        <Field label="Nearest Landmark" value={data.nearest_landmark} />
      </Section>

      {/* Step 2: Display */}
      <Section title="2. Display Specifications">
        <Field label="Technology" value={data.technology} />
        <Field label="Environment" value={data.environment} />
        <Field label="Screen Type" value={data.screen_type} />
        <Field label="Dimensions (W × H)" value={data.screen_width && data.screen_height ? `${data.screen_width}m × ${data.screen_height}m` : null} />
        <Field label="Resolution" value={data.resolution_width && data.resolution_height ? `${data.resolution_width} × ${data.resolution_height} px` : null} />
        <Field label="Orientation" value={getOrientation()} />
        <Field label="Pixel Pitch" value={data.pixel_pitch_mm} />
        <Field label="Brightness" value={data.brightness_nits ? `${data.brightness_nits} nits` : null} />
        <Field label="Refresh Rate" value={data.refresh_rate_hz ? `${data.refresh_rate_hz} Hz` : null} />
      </Section>

      {/* Step 3: Visibility */}
      <Section title="3. Visibility & Installation">
        <Field label="Installation Type" value={data.installation_type} />
        <Field label="Mounting Height" value={data.mounting_height_ft ? `${data.mounting_height_ft} ft` : null} />
        <Field label="Facing Direction" value={data.facing_direction} />
        <Field label="Road Type" value={data.environment === 'Indoor' ? 'N/A (Indoor)' : data.road_type} />
        <Field label="Traffic Direction" value={data.environment === 'Indoor' ? 'N/A (Indoor)' : data.traffic_direction} />
      </Section>

      {/* Step 4: Playback */}
      <Section title="4. Playback & Connectivity">
        <Field label="Ad Duration" value={data.standard_ad_duration_sec ? `${data.standard_ad_duration_sec} sec` : null} />
        <Field label="Total Slots" value={data.total_slots_per_loop} />
        <Field label="Loop Length" value={data.loop_length_sec} />
        <Field label="Reserved Slots" value={data.reserved_slots} />
        <Field label="Supported Formats" value={formatArray(data.supported_formats_json)} />
        <Field label="Max File Size" value={data.max_file_size_mb} />
        <Field label="Internet Type" value={data.internet_type} />
        <Field label="Bandwidth" value={data.average_bandwidth_mbps} />
        <Field label="Power Backup" value={data.power_backup_type} />
        <Field label="Days Active/Week" value={data.days_active_per_week} />
        <Field label="Downtime" value={data.enable_downtime ? (data.downtime_windows || 'Not set') : 'Not Enabled'} />
        <Field label="Audio Supported" value={formatBool(data.audio_supported)} />
        <Field label="Backup Internet" value={formatBool(data.backup_internet)} />
      </Section>

      {/* Step 5: Commercials */}
      <Section title="5. Commercials & Pricing">
        <Field label="Base Price (₹/slot/day)" value={data.base_price_per_slot_inr ? `₹${data.base_price_per_slot_inr}` : null} />
        <Field label="Seasonal Pricing" value={formatBool(data.seasonal_pricing)} />
        <Field label="Min Booking Days" value={data.enable_min_booking ? `${data.minimum_booking_days || '—'} days` : 'Not set'} />
        <Field label="Extra Charge" value={data.enable_min_booking && data.surcharge_percent ? `+${data.surcharge_percent}%` : 'Not set'} />
        <Field label="Sensitive Zones" value={formatArray(data.sensitive_zone_flags_json)} />
        <Field label="Restricted Categories" value={formatArray(data.restricted_categories_json)} />
      </Section>

      {/* Seasonal Pricing Details */}
      {data.seasonal_pricing && data.seasons_json && data.seasons_json.length > 0 && (
        <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
          <h5 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Seasonal Pricing Tiers</h5>
          {data.seasons_json.map((s, i) => (
            <div key={i} style={{ fontSize: '13px', color: '#4b5563', marginBottom: '6px' }}>
              • {s.name || 'Season'}: {s.type} {s.percentage}%
            </div>
          ))}
        </div>
      )}
      {/* Step 6: Compliance */}
      <Section title="6. Compliance & Monitoring">
        <Field label="CMS Type" value={data.cms_type} />
        <Field label="CMS API" value={data.cms_api} />
        <Field label="AI Camera Installed" value={formatBool(data.ai_camera_installed)} />
        <Field label="Screen Health Ping" value={formatBool(data.screen_health_ping)} />
        <Field label="Playback Logs" value={formatBool(data.playback_logs)} />
        <Field label="AI Camera API" value={data.ai_camera_api} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Front View Image</span>
          <ImagePreview file={data.screen_image_front} label="View Front" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Back / Side View Image</span>
          <ImagePreview file={data.screen_image_back} label="View Back" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Long Shot / Context Image</span>
          <ImagePreview file={data.screen_image_long} label="View Long Shot" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Ownership Proof</span>
          <FileLink file={data.ownership_proof_uploaded} label="Ownership Proof" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Municipality NOC</span>
          <FileLink file={data.permission_noc_available} label="Municipality NOC" />
        </div>
        <Field label="GST" value={data.gst} />
        <Field label="Content Policy" value={data.content_policy_accepted ? '✓ Accepted' : '✗ Not accepted'} />
      </Section>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <button
          onClick={onGoBack}
          style={{
            padding: '12px 32px',
            background: '#fff',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Go Back & Edit
        </button>
        <button
          onClick={onConfirmSubmit}
          disabled={isSubmitting}
          style={{
            padding: '12px 40px',
            background: isSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}
        >
          {isSubmitting ? (
            <>
              <div className="ssp-spinner" style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ssp-spin 0.6s linear infinite' }}></div>
              Submitting...
            </>
          ) : (
            <>✓ Confirm & Submit</>
          )}
        </button>
      </div>
    </div>
  )
}

export default Step7_Summary
