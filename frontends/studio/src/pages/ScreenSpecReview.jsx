import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'
import '../styles/dashboard.css'
import '../styles/screenSpecReview.css'
import { useXiaContext } from '../context/XiaContext'

// const API_BASE_URL = 'http://127.0.0.1:8000'

function ScreenSpecRow({ screen, isActive, onToggle, onSelectSidebar }) {
    const specs = screen.specs || {}
    const rules = screen.rules || {}

    return (
        <div className="screen-list-item">
            <div className="screen-list-header" onClick={onToggle}>
                <div className="screen-icon-wrapper sm">
                    <i className="bi bi-cast"></i>
                </div>
                <div className="screen-title-group">
                    <div className="screen-name">
                        {screen.name}
                        {screen.environment && (
                            <span className="env-badge" style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: screen.environment === 'Outdoor' ? '#fef3c7' : '#e0e7ff', color: screen.environment === 'Outdoor' ? '#92400e' : '#3730a3', fontWeight: 600 }}>
                                {screen.environment}
                            </span>
                        )}
                    </div>
                    <div className="screen-location">{screen.location}</div>
                </div>
                {screen.verified && (
                    <div className="verified-badge">
                        <span className="dot"></span> Spec Pack Verified
                    </div>
                )}
                <div className="expand-icon">
                    <i className={`bi bi-chevron-${isActive ? 'up' : 'down'}`}></i>
                </div>
            </div>

            {isActive && (
                <div className="screen-list-content">
                    {screen.isGlobalDefault && (
                        <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#92400e' }}>
                            ⚠ Spec pack not found — showing <strong>Global Default</strong> rules. These will be used for validation.
                        </div>
                    )}
                    {screen.physicalSize && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px', color: '#6b7280' }}>
                            <i className="bi bi-aspect-ratio" style={{ color: '#4f46e5' }}></i>
                            <span>Physical Size: <strong style={{ color: '#1f2937' }}>{screen.physicalSize}</strong></span>
                        </div>
                    )}
                    <div className="specs-row-layout">
                        <div className="spec-col">
                            <label>Resolution</label>
                            <div className="spec-val">{specs.resolution}</div>
                        </div>
                        <div className="spec-col">
                            <label>Orientation</label>
                            <div className="spec-val">{specs.orientation}</div>
                        </div>
                        <div className="spec-col">
                            <label>Aspect Ratio</label>
                            <div className="spec-val">{specs.aspectRatio}</div>
                        </div>
                        <div className="spec-col">
                            <label>Max File Size</label>
                            <div className="spec-val highlight-blue">{specs.maxSize}</div>
                        </div>
                    </div>

                    <div className="specs-row-layout second-row">
                        <div className="spec-col">
                            <label>Audio Rule</label>
                            <div className="spec-val highlight-red">{specs.audioRule}</div>
                        </div>
                        <div className="spec-col">
                            <label>Audio</label>
                            <div className="spec-val">{specs.audio}</div>
                        </div>
                        <div className="spec-col">
                            <label>Supported Formats</label>
                            <div className="spec-val">{specs.format}</div>
                        </div>
                        <div className="spec-col"></div>
                    </div>

                    <div className="slot-rule-box full-width">
                        <div className="slot-rule-label">Slot & Durations</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            {rules.totalSlots && (
                                <div className="slot-pill">{rules.totalSlots} slots/loop</div>
                            )}
                            {rules.adDuration && (
                                <div className="slot-pill" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{rules.adDuration}s per ad</div>
                            )}
                            {rules.loopLength && (
                                <div className="slot-pill" style={{ background: '#faf5ff', color: '#6b21a8', border: '1px solid #e9d5ff' }}>{rules.loopLength}s loop</div>
                            )}
                        </div>
                        <div className="rule-text-row">
                            {rules.isStandard ? (
                                <span className="rule-desc">{rules.type}</span>
                            ) : (
                                <>
                                    <i className="bi bi-info-circle rule-icon"></i>
                                    <span className="rule-desc">{rules.type}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ScreenSpecReview() {
    const navigate = useNavigate()
    const { state } = useLocation()
    const [searchParams] = useSearchParams()

    // Get selected screens from navigation state or fallback to empty
    const selectedScreens = state?.selectedScreens || []
    const slotCount = state?.slotCount || {}
    const campaignId = searchParams.get('campaignId') || state?.campaignId || ''

    // Console API calls go through the Vite proxy (/api/console → localhost:8000)
    const CONSOLE_URL = ''

    const [screenData, setScreenData] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeScreenId, setActiveScreenId] = useState(null)
    const [profilesMap, setProfilesMap] = useState({})
    const [sidebarScreenId, setSidebarScreenId] = useState(null)
    const [manifestExists, setManifestExists] = useState(false)
    const { setPageContext } = useXiaContext()

    // Publish live page data for XIA — include FULL spec details + audience profiles
    useEffect(() => {
        setPageContext({
            page: 'screen_spec_review',
            page_label: 'Screen Spec Review',
            summary: `Reviewing specs for ${screenData.length} screens (campaign ${campaignId}). ${screenData.filter(s => s.verified).length} verified, ${screenData.filter(s => s.isGlobalDefault).length} using global defaults.`,
            data: {
                campaign_id: campaignId,
                screens_count: screenData.length,
                verified_count: screenData.filter(s => s.verified).length,
                global_default_count: screenData.filter(s => s.isGlobalDefault).length,
                has_manifest: manifestExists,
                screens: screenData.map(s => {
                    const profile = profilesMap?.[s.id];
                    return {
                        name: s.name,
                        location: s.location,
                        verified: s.verified,
                        is_global_default: s.isGlobalDefault,
                        environment: s.environment,
                        physical_size: s.physicalSize,
                        resolution: s.specs?.resolution,
                        aspect_ratio: s.specs?.aspectRatio,
                        orientation: s.specs?.orientation,
                        format: s.specs?.format,
                        max_file_size: s.specs?.maxSize,
                        audio: s.specs?.audio,
                        audio_rule: s.specs?.audioRule,
                        slots_per_loop: s.rules?.totalSlots,
                        ad_duration_sec: s.rules?.adDuration,
                        loop_length_sec: s.rules?.loopLength,
                        slot_count: s.slot_count,
                        audience_profile: profile ? {
                            area_type: profile.area_type,
                            dominant_group: profile.dominant_group,
                            confidence: profile.confidence,
                            city_tier: profile.city_tier,
                            dwell: profile.dwell,
                            movement: profile.movement,
                        } : null,
                    };
                }),
            }
        })
        return () => setPageContext(null)
    }, [screenData, manifestExists, campaignId, profilesMap])

    // Helper: build screen data from a spec API response
    const buildScreenFromSpec = (screenId, screenName, screenLocation, spec, slots) => {
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
        const w = spec.resolution_width || 1920
        const h = spec.resolution_height || 1080
        const d = gcd(w, h)
        const aspectRatio = `${w / d}:${h / d}`
        const formats = Array.isArray(spec.supported_formats_json)
            ? spec.supported_formats_json.join(' / ')
            : (spec.supported_formats_json || 'MP4')

        return {
            id: screenId,
            name: spec.screen_name || screenName || 'Unknown Screen',
            location: spec.city || screenLocation || 'Unknown Location',
            verified: spec.status === 'VERIFIED',
            isGlobalDefault: false,
            environment: spec.environment || null,
            physicalSize: (spec.screen_width && spec.screen_height) ? `${spec.screen_width}ft × ${spec.screen_height}ft` : null,
            specs: {
                resolution: `${w}x${h}`,
                orientation: spec.orientation ? spec.orientation.charAt(0) + spec.orientation.slice(1).toLowerCase() : 'Landscape',
                aspectRatio,
                audio: spec.audio_supported ? 'Audio Supported' : 'No Audio Support',
                maxSize: spec.max_file_size_mb ? `${String(spec.max_file_size_mb).replace(/\s*MB$/i, '')} MB` : '—',
                audioRule: spec.audio_supported ? 'Allowed' : 'Not Allowed',
                format: formats,
            },
            rules: {
                totalSlots: spec.total_slots_per_loop,
                reservedSlots: spec.reserved_slots,
                adDuration: spec.standard_ad_duration_sec || null,
                loopLength: spec.loop_length_sec || null,
                type: 'Rule: Standard Rotation',
                isStandard: true
            },
            slot_count: slots
        }
    }

    const buildGlobalDefault = (screenId, screenName, screenLocation, slots) => ({
        id: screenId,
        name: screenName || `Screen ${screenId}`,
        location: screenLocation || 'Unknown Location',
        verified: false,
        isGlobalDefault: true,
        specs: {
            resolution: '1920x1080', orientation: 'Landscape', aspectRatio: '16:9',
            audio: 'No Audio Support', maxSize: '50MB', audioRule: 'Not Allowed', format: 'MP4',
        },
        environment: null, physicalSize: null,
        rules: {
            totalSlots: null, reservedSlots: null, adDuration: null, loopLength: null,
            type: 'Rule: Standard Rotation (Global Default)', isStandard: true
        },
        slot_count: slots
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Step 1: Check if manifest already exists for this campaign
                let screensFromManifest = []
                if (campaignId) {
                    try {
                        const manifestRes = await axios.get(`/api/console/campaign/${campaignId}/manifest/`)
                        const manifestRows = manifestRes.data?.assets || []
                        if (Array.isArray(manifestRows) && manifestRows.length > 0) {
                            setManifestExists(true)
                            console.log('[ScreenSpec] Manifest exists, user already accepted')

                            // If no Router state, reconstruct screens from manifest
                            if (selectedScreens.length === 0) {
                                const screenMap = {}
                                manifestRows.forEach(row => {
                                    if (!screenMap[row.screen_id]) {
                                        screenMap[row.screen_id] = {
                                            id: row.screen_id,
                                            name: row.screen_name || `Screen ${row.screen_id}`,
                                            location: row.screen_location || '',
                                            slot_count: 0
                                        }
                                    }
                                    screenMap[row.screen_id].slot_count++
                                })
                                screensFromManifest = Object.values(screenMap)
                            }
                        }
                    } catch (_) { /* no manifest yet */ }
                }

                // Step 2: Determine which screen list to use
                const screensToFetch = selectedScreens.length > 0
                    ? selectedScreens
                    : screensFromManifest

                if (screensToFetch.length === 0) {
                    setLoading(false)
                    return
                }

                // Step 3: Fetch specs for each screen
                const fetchedScreens = await Promise.all(screensToFetch.map(async (s) => {
                    try {
                        const res = await axios.get(`${CONSOLE_URL}/api/console/screen-specs/${s.id}/`, { _skipAuthRedirect: true })
                        return buildScreenFromSpec(s.id, s.name, s.location, res.data, slotCount?.[s.id] || s.slot_count || 1)
                    } catch (_) {
                        return buildGlobalDefault(s.id, s.name, s.location, slotCount?.[s.id] || s.slot_count || 1)
                    }
                }))

                setScreenData(fetchedScreens)
                if (fetchedScreens.length > 0) {
                    setActiveScreenId(fetchedScreens[0].id)
                    setSidebarScreenId(fetchedScreens[0].id)
                }

                // Step 4: Fetch audience profiles
                const profileMap = {}
                await Promise.all(screensToFetch.map(async (s) => {
                    try {
                        const profileRes = await axios.get(`${CONSOLE_URL}/api/console/screen-profiles/`, {
                            params: { screen_id: s.id },
                            _skipAuthRedirect: true
                        })
                        const profiles = profileRes.data?.profiles
                        if (profiles?.length > 0) profileMap[s.id] = profiles[0]
                    } catch (_) { /* no profile */ }
                }))
                setProfilesMap(profileMap)
            } catch (error) {
                console.error('Error fetching screen specs:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [campaignId])

    if (loading) {
        return (
            <div className="screen-spec-page">
                <Header />
                <div className="loading-container">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading Specs...</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="screen-spec-page">
            <Header />

            <div className="screen-spec-layout">
                {/* Left Sidebar - Audience Match */}
                <div className="spec-sidebar">
                    <div className="sidebar-header">Audience Match</div>

                    {/* Screen navigator */}
                    {screenData.length > 0 && (() => {
                        const idx = screenData.findIndex(s => s.id === sidebarScreenId)
                        const current = idx >= 0 ? idx : 0
                        const screen = screenData[current]
                        const goPrev = () => setSidebarScreenId(screenData[Math.max(0, current - 1)].id)
                        const goNext = () => setSidebarScreenId(screenData[Math.min(screenData.length - 1, current + 1)].id)
                        return (
                            <div style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <button
                                        onClick={goPrev}
                                        disabled={current === 0}
                                        style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: current === 0 ? 'default' : 'pointer', color: current === 0 ? '#d1d5db' : '#4f46e5', flexShrink: 0 }}
                                    >
                                        <i className="bi bi-chevron-left" style={{ fontSize: '12px' }}></i>
                                    </button>
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937', lineHeight: 1.3, marginBottom: '2px' }}>
                                            {screen?.name}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                            {current + 1} of {screenData.length} screen{screenData.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <button
                                        onClick={goNext}
                                        disabled={current === screenData.length - 1}
                                        style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: current === screenData.length - 1 ? 'default' : 'pointer', color: current === screenData.length - 1 ? '#d1d5db' : '#4f46e5', flexShrink: 0 }}
                                    >
                                        <i className="bi bi-chevron-right" style={{ fontSize: '12px' }}></i>
                                    </button>
                                </div>
                            </div>
                        )
                    })()}

                    {profilesMap[sidebarScreenId] ? (() => {
                        const prof = profilesMap[sidebarScreenId]
                        return (
                            <>
                                <div className="sidebar-section-title">Location Context</div>
                                <div className="sidebar-card">
                                    <div className="sidebar-row border-bottom">
                                        <span className="sidebar-label">Area Type</span>
                                        <span className="sidebar-value">{prof.primary_type?.replace(/_/g, ' ') || '—'}</span>
                                    </div>
                                    <div className="sidebar-row border-bottom">
                                        <span className="sidebar-label">Dominant Group</span>
                                        <span className="sidebar-value">{prof.dominant_group || '—'}</span>
                                    </div>
                                    <div className="sidebar-row border-bottom">
                                        <span className="sidebar-label">Confidence</span>
                                        <span className="sidebar-value" style={{ textTransform: 'capitalize' }}>{prof.confidence || '—'}</span>
                                    </div>
                                    {prof.city_tier && (
                                        <div className="sidebar-row">
                                            <span className="sidebar-label">City Tier</span>
                                            <span className="sidebar-value" style={{ fontWeight: 600, color: prof.city_tier === 'TIER_1' ? '#059669' : prof.city_tier === 'TIER_2' ? '#d97706' : '#6b7280' }}>
                                                {prof.city_tier.replace('_', ' ')}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="sidebar-section-title">Dwell & Movement</div>
                                <div className="sidebar-card">
                                    <div className="sidebar-row border-bottom">
                                        <span className="sidebar-label">Dwell</span>
                                        <span className="sidebar-value">{prof.dwell_category?.replace(/_/g, ' ') || '—'}</span>
                                    </div>
                                    <div className="sidebar-row">
                                        <span className="sidebar-label">Movement</span>
                                        <span className="sidebar-value">{prof.movement_type?.replace(/_/g, ' ') || '—'}</span>
                                    </div>
                                </div>

                                <div className="sidebar-section-title">Context</div>
                                <div className="sidebar-info-box">
                                    {prof.area_context || prof.movement_context || 'No context available.'}
                                </div>
                            </>
                        )
                    })() : (
                        <>
                            <div className="sidebar-section-title">Context</div>
                            <div className="sidebar-info-box" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                No audience profile available for this screen.
                            </div>
                        </>
                    )}
                </div>

                {/* Main Content */}
                <div className="spec-main">
                    <div className="main-header" style={{ display: 'flex', flexDirection: 'row', padding: '12px 24px 12px' }}>
                        <button
                            className="back-btn me-3"
                            onClick={() => navigate(-1)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'none',
                                border: '1px solid #4f46e5',
                                color: '#4f46e5',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                padding: '4px',
                                marginBottom: '8px',

                            }}
                        >
                            ←
                        </button>
                        <h3 className="page-title mb-0 pb-0">Creative Preparation</h3>
                    </div>

                    <div className="spec-content-area">
                        <h2 className="section-heading">Screen Spec Pack Review</h2>

                        {/* Acceptance Rules Alert */}
                        <div className="acceptance-rules-card">
                            <div className="rules-title">
                                {screenData.length > 2 ? 'Deterministic Rules' : 'Screen Acceptance Rules'}
                            </div>
                            <div className="rules-desc">
                                {screenData.length > 2
                                    ? 'Review the technical constraints for each screen. You must accept these rules to prevent validation errors during upload.'
                                    : 'These rules will be enforced during creative validation.'
                                }
                            </div>
                        </div>

                        {/* Conditional Layout */}
                        {screenData.length > 2 ? (
                            <div className="screen-list-layout">
                                {screenData.map((screen) => (
                                    <ScreenSpecRow
                                        key={screen.id}
                                        screen={screen}
                                        onSelectSidebar={() => setSidebarScreenId(screen.id)}
                                        isActive={activeScreenId === screen.id}
                                        onToggle={() => {
                                            const newId = activeScreenId === screen.id ? null : screen.id
                                            setActiveScreenId(newId)
                                            if (newId) setSidebarScreenId(newId)
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="screen-cards-grid">
                                {screenData.map((screen, index) => (
                                    <div key={index} className="screen-spec-card" onClick={() => setSidebarScreenId(screen.id)} style={{ cursor: 'pointer' }}>
                                        <div className="card-header-row">
                                            <div className="screen-icon-wrapper">
                                                <i className="bi bi-cast"></i>
                                            </div>
                                            <div className="screen-title-group">
                                                <div className="screen-name">
                                                    {screen.name}
                                                    {screen.environment && (
                                                        <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: screen.environment === 'Outdoor' ? '#fef3c7' : '#e0e7ff', color: screen.environment === 'Outdoor' ? '#92400e' : '#3730a3', fontWeight: 600 }}>
                                                            {screen.environment}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="screen-location">{screen.location}</div>
                                            </div>
                                            {screen.verified && (
                                                <div className="verified-badge">
                                                    <span className="dot"></span> Spec Pack Verified
                                                </div>
                                            )}
                                        </div>

                                        {screen.isGlobalDefault && (
                                            <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#92400e' }}>
                                                ⚠ Spec pack not found — showing <strong>Global Default</strong> rules. These will be used for validation.
                                            </div>
                                        )}

                                        {screen.physicalSize && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px', color: '#6b7280' }}>
                                                <i className="bi bi-aspect-ratio" style={{ color: '#4f46e5' }}></i>
                                                <span>Physical Size: <strong style={{ color: '#1f2937' }}>{screen.physicalSize}</strong></span>
                                            </div>
                                        )}

                                        <div className="specs-grid">
                                            <div className="spec-column">
                                                <div className="spec-item">
                                                    <label>Resolution</label>
                                                    <div className="spec-val">{screen.specs.resolution}</div>
                                                </div>
                                                <div className="spec-item">
                                                    <label>Orientation</label>
                                                    <div className="spec-val">{screen.specs.orientation}</div>
                                                </div>
                                                <div className="spec-item">
                                                    <label>Max File Size</label>
                                                    <div className="spec-val highlight-blue">{screen.specs.maxSize}</div>
                                                </div>
                                            </div>

                                            <div className="spec-column">
                                                <div className="spec-item">
                                                    <label>Aspect Ratio</label>
                                                    <div className="spec-val">{screen.specs.aspectRatio}</div>
                                                </div>
                                                <div className="spec-item">
                                                    <label>Audio</label>
                                                    <div className="spec-val">{screen.specs.audio}</div>
                                                </div>
                                                <div className="spec-item">
                                                    <label>Audio Rule</label>
                                                    <div className="spec-val highlight-red">{screen.specs.audioRule}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="spec-footer-row">
                                            <div className="spec-item full-width">
                                                <label>Supported Formats</label>
                                                <div className="spec-val">{screen.specs.format}</div>
                                            </div>
                                        </div>

                                        <div className="slot-rule-box">
                                            <div className="slot-rule-label">Slot & Durations</div>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                {screen.rules.totalSlots && (
                                                    <div className="slot-pill">{screen.rules.totalSlots} slots/loop</div>
                                                )}
                                                {screen.rules.adDuration && (
                                                    <div className="slot-pill" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{screen.rules.adDuration}s per ad</div>
                                                )}
                                                {screen.rules.loopLength && (
                                                    <div className="slot-pill" style={{ background: '#faf5ff', color: '#6b21a8', border: '1px solid #e9d5ff' }}>{screen.rules.loopLength}s loop</div>
                                                )}
                                            </div>
                                            <div className="rule-text-row">
                                                {screen.rules.isStandard ? (
                                                    <span className="rule-desc">{screen.rules.type}</span>
                                                ) : (
                                                    <>
                                                        <i className="bi bi-info-circle rule-icon"></i>
                                                        <span className="rule-desc">{screen.rules.type}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="action-footer">
                            {manifestExists ? (
                                <>
                                    <span className="footer-label" style={{ color: '#059669' }}>
                                        <i className="bi bi-check-circle-fill" style={{ marginRight: '6px' }}></i>
                                        Specs already accepted for this campaign
                                    </span>
                                    <button
                                        className="accept-manifest-btn"
                                        style={{ background: '#4f46e5' }}
                                        onClick={() => {
                                            navigate(`/screen-bundle?campaignId=${encodeURIComponent(campaignId)}`, { state: { selectedScreens: screenData, slotCount, campaignId } });
                                        }}
                                    >
                                        Continue to Upload →
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="footer-label">Proceed to mapping with rules accepted</span>
                                    <button
                                        className="accept-manifest-btn"
                                        onClick={async () => {
                                            try {
                                                await axios.post(`/api/console/campaign/${campaignId}/manifest/`, {});
                                            } catch (err) {
                                                console.warn('Manifest creation:', err.response?.data?.error || err.message);
                                            }
                                            navigate(`/screen-bundle?campaignId=${encodeURIComponent(campaignId)}`, { state: { selectedScreens: screenData, slotCount, campaignId } });
                                        }}
                                    >
                                        I Accept - Upload Creatives
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ScreenSpecReview
