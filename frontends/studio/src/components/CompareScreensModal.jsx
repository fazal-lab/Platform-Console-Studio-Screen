import PropTypes from 'prop-types'
import '../styles/compareScreensModal.css'

function formatMoney(value) {
    const n = Number(value || 0)
    if (Number.isNaN(n)) return '0'
    return Math.round(n).toLocaleString('en-IN')
}

export default function CompareScreensModal({ open, screens, slotCount, onClose }) {
    if (!open) return null
    const safeScreens = Array.isArray(screens) ? screens : []

    return (
        <div className="compare-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
                <div className="compare-modal-header">
                    <div className="compare-modal-title">Compare ({safeScreens.length})</div>
                    <button type="button" className="compare-modal-close" onClick={onClose} aria-label="Close">
                        <i className="bi bi-x"></i>
                    </button>
                </div>

                <div className="compare-modal-body">
                    {safeScreens.length === 0 ? (
                        <div className="compare-empty">No screens selected.</div>
                    ) : (
                        <div className="compare-grid">
                            {safeScreens.map((loc) => {
                                const title = loc.name || 'Screen'
                                const badge = loc.environment || 'Outdoor'
                                const badgeClass = badge === 'Indoor' ? 'cmp-badge-indoor' : 'cmp-badge-outdoor'
                                const area = loc.city_name || ''
                                const screenId = loc.screen_id || loc.id || ''
                                const pricePerDay = Number(loc.price_per_day || 0)
                                const imageUrl = loc.main_image_url || (loc.images && loc.images[0] && loc.images[0].url) || ''
                                const hasImage = Boolean(imageUrl)
                                const available = loc.available_slots || 0
                                const total = loc.total_slots_per_loop || 0
                                const booked = total - available
                                const userSlots = slotCount?.[loc.id] || 0

                                return (
                                    <div className="cmp-card" key={loc.id || loc.screen_id}>
                                        {/* Top Dark Section */}
                                        <div className="cmp-card-top">
                                            <div className="cmp-header-section">
                                                <div className="cmp-title">{title}</div>
                                                <div className="cmp-subtitle">
                                                    {area}
                                                    <span className="cmp-dot">·</span>
                                                    ID: {screenId}
                                                </div>
                                            </div>
                                            <span className={`cmp-badge ${badgeClass}`}>{badge}</span>

                                            <div className="cmp-image-wrap">
                                                {hasImage ? (
                                                    <img className="cmp-image" src={imageUrl} alt={title} />
                                                ) : (
                                                    <span className="cmp-image-placeholder">No preview</span>
                                                )}
                                            </div>

                                            <div className="cmp-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                                <div className="cmp-stat">
                                                    <label>Dimensions</label>
                                                    <span>{loc.display_size || 'N/A'}</span>
                                                </div>
                                                <div className="cmp-stat">
                                                    <label>Orientation</label>
                                                    <span>{loc.orientation || 'Landscape'}</span>
                                                </div>
                                                <div className="cmp-stat">
                                                    <label>Slot Price</label>
                                                    <span className="cmp-price">₹{formatMoney(pricePerDay)}</span>
                                                </div>
                                                <div className="cmp-stat" style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                                                    <label>Availability</label>
                                                    <span>{available} available · {total} total slots</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom White Section */}
                                        <div className="cmp-card-bottom">
                                            {/* Screen Info */}
                                            <div className="cmp-section-heading">SCREEN INFO</div>
                                            <div className="cmp-details-grid">
                                                <div className="cmp-detail">
                                                    <label>Type</label>
                                                    <div>{loc.screen_type || 'Billboard'}</div>
                                                </div>
                                                <div className="cmp-detail">
                                                    <label>Technology</label>
                                                    <div>{loc.technology || 'LED'}</div>
                                                </div>
                                                <div className="cmp-detail">
                                                    <label>Ad Duration</label>
                                                    <div>{loc.standard_ad_duration_sec || 10}s</div>
                                                </div>
                                            </div>

                                            <div className="cmp-section-separator" />

                                            {/* Hardware Integrity */}
                                            <div className="cmp-section-heading">HARDWARE INTEGRITY</div>
                                            <div className="cmp-details-grid">
                                                <div className="cmp-detail">
                                                    <label>Resolution</label>
                                                    <div>{loc.resolution || 'N/A'}</div>
                                                </div>
                                                <div className="cmp-detail">
                                                    <label>Brightness</label>
                                                    <div>{loc.brightness || 'N/A'}</div>
                                                </div>
                                                <div className="cmp-detail" style={{ gridColumn: '1 / -1' }}>
                                                    <label>Mounting</label>
                                                    <div>{loc.mounting || 'N/A'}</div>
                                                </div>
                                            </div>

                                            <div className="cmp-section-separator" />

                                            {/* Screen Highlights */}
                                            <div className="cmp-section-heading">HIGHLIGHTS</div>
                                            <div className="cmp-highlights-grid">
                                                <div className="cmp-highlight">
                                                    <i className="bi bi-check-lg"></i>
                                                    <span>{loc.dwellCategory || 'Standard'} Dwell</span>
                                                </div>
                                                <div className="cmp-highlight">
                                                    <i className="bi bi-check-lg"></i>
                                                    <span>{loc.movementType || 'Steady'} Flow</span>
                                                </div>
                                                {loc.dominantGroup && (
                                                    <div className="cmp-highlight">
                                                        <i className="bi bi-check-lg"></i>
                                                        <span>{loc.dominantGroup} Area</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="cmp-section-separator" />

                                            {/* Location Info */}
                                            <div className="cmp-section-heading">LOCATION</div>
                                            <div className="cmp-details-grid">
                                                <div className="cmp-detail" style={{ gridColumn: 'span 2' }}>
                                                    <label>Address</label>
                                                    <div>{loc.display_brief || 'N/A'}</div>
                                                </div>
                                                <div className="cmp-detail">
                                                    <label>Environment</label>
                                                    <div>{loc.environment || 'Outdoor'}</div>
                                                </div>
                                            </div>

                                            <div className="cmp-section-separator" />

                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="compare-modal-footer">
                    <button type="button" className="compare-btn compare-btn-outline" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

CompareScreensModal.propTypes = {
    open: PropTypes.bool,
    screens: PropTypes.array,
    slotCount: PropTypes.object,
    onClose: PropTypes.func
}
