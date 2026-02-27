import { useState } from 'react'
import PropTypes from 'prop-types'
import '../styles/screenDetailsModal.css'

function formatMoney(value) {
  const n = Number(value || 0)
  if (Number.isNaN(n)) return '0'
  return Math.round(n).toLocaleString('en-IN')
}

export default function ScreenDetailsModal({ open, mode, location, onClose, onAddToPlan, showXiaContent = false, campaignStartDate = '', campaignEndDate = '' }) {
  if (!open || !location) return null

  const title = location.name || 'Screen'
  const badge = location.dominantGroup || 'Profiled'
  const area = location.city_name || ''
  const city = location.environment || ''
  const screenId = location.screen_id || location.id || ''
  const pricePerDay = Number(location.price_per_day || 0)

  // Determine if screen is unavailable
  const isScheduledBlock = location.status === 'SCHEDULED_BLOCK' && location.scheduled_block_date && campaignEndDate > location.scheduled_block_date
  const isExpiredAvailability = location.status === 'SCHEDULED_BLOCK' && location.available_until && campaignStartDate > location.available_until
  const isBlocked = isScheduledBlock || isExpiredAvailability
  const isSlotUnavailable = !isBlocked && location.available_slots === 0
  const isUnavailable = isBlocked || isSlotUnavailable

  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const imageUrl = location.images && location.images.length > 0 ? location.images[currentImageIndex] : (location.main_image_url || '')
  const hasImage = Boolean(imageUrl)
  const hasMultipleImages = location.images && location.images.length > 1

  const handlePrevImage = () => {
    if (location.images && location.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === 0 ? location.images.length - 1 : prev - 1))
    }
  }

  const handleNextImage = () => {
    if (location.images && location.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === location.images.length - 1 ? 0 : prev + 1))
    }
  }

  return (
    <div className="screen-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="screen-modal" onClick={(e) => e.stopPropagation()}>

        {/* Left Panel */}
        <div className="screen-modal-left">
          <div className="screen-modal-header">
            <div className="screen-modal-title-row">
              <div className="screen-modal-title">{title}</div>
              <div className="screen-modal-badge">{badge}</div>
            </div>
            <div className="screen-modal-subtitle">
              {area}{area && city ? ' · ' : ''}{city}
              <span className="screen-modal-dot">•</span>
              {location.technology || 'LED'} · ID: {screenId}
            </div>
          </div>

          <div className="screen-modal-image-wrap">
            {hasImage ? (
              <div style={{ position: 'relative' }}>
                <img className="screen-modal-image" src={imageUrl} alt={title} />
                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      className="screen-image-nav screen-image-nav-left"
                      onClick={handlePrevImage}
                      aria-label="Previous image"
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <button
                      type="button"
                      className="screen-image-nav screen-image-nav-right"
                      onClick={handleNextImage}
                      aria-label="Next image"
                    >
                      <i className="bi bi-chevron-right"></i>
                    </button>
                    <div className="screen-image-indicator">
                      {currentImageIndex + 1} / {location.images.length}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="screen-modal-image-placeholder">
                <div className="screen-modal-image-placeholder-inner">
                  No preview available
                </div>
              </div>
            )}
          </div>

          <div className="screen-modal-footer-stats">
            <div className="screen-stat">
              <div className="screen-stat-label">Dimensions</div>
              <div className="screen-stat-value">{location.display_size || 'N/A'}</div>
            </div>
            <div className="screen-stat">
              <div className="screen-stat-label">Orientation</div>
              <div className="screen-stat-value">{location.orientation || 'Landscape'}</div>
            </div>
            <div className="screen-stat">
              <div className="screen-stat-label">Slot price</div>
              <div className="screen-stat-value screen-price-highlight">₹{formatMoney(pricePerDay)}/slot</div>
            </div>
            <div className="screen-stat">
              <div className="screen-stat-label">Available Slots</div>
              <div className="screen-stat-value">{location.available_slots || 0}</div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="screen-modal-right">
          <button type="button" className="screen-modal-close-x" onClick={onClose} aria-label="Close">
            <i className="bi bi-x"></i>
          </button>

          <div className="screen-right-content">
            <h3 className="screen-section-heading">Screen Highlights</h3>

            <div className="screen-highlights-grid">
              <div className="screen-highlight-item">
                <i className="bi bi-check-lg screen-check-icon"></i>
                <span>{location.dwellCategory || 'Standard'} Dwell Time</span>
              </div>
              <div className="screen-highlight-item">
                <i className="bi bi-check-lg screen-check-icon"></i>
                <span>{location.movementType || 'Steady Flow'} Zone</span>
              </div>
              <div className="screen-highlight-item">
                <i className="bi bi-check-lg screen-check-icon"></i>
                <span>{badge} Area</span>
              </div>
              {location.relevance_score != null && location.relevance_score > 0 && (
                <div className="screen-highlight-item">
                  <i className="bi bi-check-lg screen-check-icon"></i>
                  <span>Fit Score {location.relevance_score}%</span>
                </div>
              )}
            </div>

            {location.ranking_reason && (
              <div className="xia-reasoning-box">
                <div className="xia-reasoning-title">
                  <i className="bi bi-stars"></i> XIA Reasoning
                </div>
                <p className="xia-reasoning-text">
                  {location.ranking_reason}
                </p>
              </div>
            )}
            {/* Single Unavailability Warning — only one message shown based on reason */}
            {(() => {
              // Priority 1: Screen is explicitly blocked / under maintenance (SCHEDULED_BLOCK)
              if (isBlocked) {
                return (
                  <div className="availability-info-box availability-maintenance">
                    <div className="availability-info-title">
                      <i className="bi bi-tools"></i> Screen Under Maintenance
                    </div>
                    <p className="availability-guidance">
                      <i className="bi bi-info-circle"></i>
                      <span>This screen is currently under maintenance and is not available for campaign scheduling.</span>
                    </p>
                  </div>
                )
              }

              // Priority 2: No slots available
              if (location.available_slots === 0 && location.unavailability_reason) {
                return (
                  <div className="availability-info-box">
                    <div className="availability-info-title">
                      <i className="bi bi-calendar-x"></i> Availability Status
                    </div>
                    <p className="availability-reason">{location.unavailability_reason}</p>
                    {location.next_available_date && (
                      <div className="availability-detail">
                        <i className="bi bi-calendar-check"></i>
                        <span>Next Available: <strong>{new Date(location.next_available_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                      </div>
                    )}
                    {location.slots_freeing_up && location.slots_freeing_up > 0 && (
                      <div className="availability-detail">
                        <i className="bi bi-box-arrow-up"></i>
                        <span><strong>{location.slots_freeing_up} slot{location.slots_freeing_up > 1 ? 's' : ''}</strong> freeing up</span>
                      </div>
                    )}
                  </div>
                )
              }

              // Priority 3: Scheduled block date conflict (campaign end date exceeds block date)
              if (location.status === 'SCHEDULED_BLOCK' && location.scheduled_block_date && campaignEndDate > location.scheduled_block_date) {
                return (
                  <div className="availability-info-box availability-scheduled-block">
                    <div className="availability-info-title">
                      <i className="bi bi-exclamation-triangle-fill"></i> Availability Status
                    </div>
                    <p className="availability-guidance">
                      <i className="bi bi-info-circle"></i>
                      <span>
                        This screen will be blocked starting <strong>{new Date(location.scheduled_block_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>, which falls before your campaign end date. To use this screen, adjust your campaign end date before blocked date.
                      </span>
                    </p>
                  </div>
                )
              }

              // Priority 4: Generic block warning from API (partial conflict, still available)
              if (location.block_warning) {
                return (
                  <div className="availability-info-box availability-scheduled-block">
                    <div className="availability-info-title">
                      <i className="bi bi-exclamation-triangle-fill"></i> Availability Warning
                    </div>
                    <p className="availability-guidance">
                      <i className="bi bi-info-circle"></i>
                      <span>{location.block_warning}</span>
                    </p>
                  </div>
                )
              }

              return null
            })()}

            <div className="screen-info-grid-section">
              <h3 className="screen-section-heading">Where is it?</h3>
              <div className="screen-details-grid mb-3" style={{ gridTemplateColumns: '1fr' }}>
                <div className="screen-detail-item">
                  <label>Near Landmark</label>
                  <div>{location.display_brief || 'N/A'}</div>
                </div>
              </div>
              <div className="screen-details-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: '8px' }}>
                <div className="screen-detail-item">
                  <label>Facing</label>
                  <div>{location.environment || 'Outdoor'}</div>
                </div>
                <div className="screen-detail-item">
                  <label>Road Type</label>
                  <div>{location.city_name || 'N/A'}</div>
                </div>
                <div className="screen-detail-item">
                  <label>Profile</label>
                  <div>{location.dominantGroup || 'Mixed'} area</div>
                </div>
              </div>
            </div>

            <div className="screen-info-grid-section">
              <h3 className="screen-section-heading">Hardware Integrity</h3>
              <div className="screen-details-grid">
                <div className="screen-detail-item">
                  <label>Resolution</label>
                  <div>{location.resolution || 'N/A'}</div>
                </div>
                <div className="screen-detail-item">
                  <label>Brightness</label>
                  <div>{location.brightness || 'N/A'}</div>
                </div>
                <div className="screen-detail-item full-width">
                  <label>Mounting</label>
                  <div>{location.mounting || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="screen-restrictions-box">
              <div className="screen-restrictions-header">
                <i className="bi bi-exclamation-circle"></i> Category Restrictions
              </div>
              <div className="screen-restrictions-list">
                {location.category_restrictions && location.category_restrictions.length > 0 ? (
                  location.category_restrictions.map((r, i) => (
                    <span className="restriction-tag" key={i}>{r}</span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>None listed</span>
                )}
              </div>
            </div>
          </div>

          <div className="screen-modal-actions">
            <button type="button" className="screen-btn screen-btn-outline" onClick={onClose}>
              Close
            </button>
            {isUnavailable ? (
              <button
                type="button"
                className="screen-btn screen-btn-primary"
                disabled
                style={{ opacity: 0.5, cursor: 'not-allowed', background: '#94a3b8' }}
              >
                Unavailable
              </button>
            ) : (
              <button
                type="button"
                className="screen-btn screen-btn-primary"
                onClick={() => onAddToPlan?.(location, mode)}
              >
                Add the Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

ScreenDetailsModal.propTypes = {
  open: PropTypes.bool,
  mode: PropTypes.oneOf(['compare', 'view']),
  location: PropTypes.object,
  onClose: PropTypes.func,
  onAddToPlan: PropTypes.func,
  showXiaContent: PropTypes.bool,
  campaignStartDate: PropTypes.string,
  campaignEndDate: PropTypes.string
}


