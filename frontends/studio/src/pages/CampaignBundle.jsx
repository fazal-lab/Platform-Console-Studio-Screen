import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'
import '../styles/dashboard.css'
import '../styles/campaignBundle.css'
import { useXiaContext } from '../context/XiaContext'

function CampaignBundle() {
  const navigate = useNavigate()
  const { state } = useLocation()

  // Session persistence key
  const BUNDLE_SESSION_KEY = 'xigi_bundle_session'

  // Restore from sessionStorage if location.state is missing
  const sessionRestore = (() => {
    if (state?.selectedScreens || state?.bookedScreens) return null // fresh navigation, no need
    try {
      const saved = sessionStorage.getItem(BUNDLE_SESSION_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })()

  const campaignIdForGuard = state?.campaignId || sessionRestore?.campaignId || null

  // Server-driven guard: check if campaign is already paid
  useEffect(() => {
    if (!campaignIdForGuard) return
    axios.get(`/api/console/slot-bookings/status/?campaign_id=${campaignIdForGuard}`)
      .then(res => {
        if (res.data?.payment_status === 'PAID') {
          window.location.replace('/active-dashboard-demo')
        }
      })
      .catch(() => { })
  }, [campaignIdForGuard])

  const initialCampaignName = state?.campaignName || sessionRestore?.campaignName || 'Untitled Campaign'
  // If coming from Dashboard, bookedScreens is {screen_id: slots}; otherwise use slotCount
  const slotCount = state?.slotCount || state?.bookedScreens || sessionRestore?.slotCount || {}
  const campaignIdFromState = state?.campaignId || sessionRestore?.campaignId || null
  const gatewayIdFromState = state?.gatewayId || sessionRestore?.gatewayId || null
  const priceSnapshot = state?.priceSnapshot || sessionRestore?.priceSnapshot || {}

  const [campaignName, setCampaignName] = useState(initialCampaignName)
  const [isEditingName, setIsEditingName] = useState(false)
  const [screens, setScreens] = useState(state?.selectedScreens || sessionRestore?.selectedScreens || [])
  const [city, setCity] = useState(state?.city || sessionRestore?.city || 'Chennai')
  const [startDate, setStartDate] = useState(state?.startDate || sessionRestore?.startDate || '')
  const [endDate, setEndDate] = useState(state?.endDate || sessionRestore?.endDate || '')
  const [loadingScreens, setLoadingScreens] = useState(false)
  const [priceChangeAccepted, setPriceChangeAccepted] = useState(sessionRestore?.priceChangeAccepted || false)
  const { setPageContext } = useXiaContext()

  // When coming from Dashboard with bookedScreens but no selectedScreens, fetch screen details
  useEffect(() => {
    if (state?.fromDashboard && state?.bookedScreens && (!state?.selectedScreens || state.selectedScreens.length === 0)) {
      const fetchScreenDetails = async () => {
        setLoadingScreens(true)
        try {
          const bookedIds = Object.keys(state.bookedScreens).map(Number)
          const response = await axios.post('/api/console/screens/discover/', {
            start_date: state.startDate,
            end_date: state.endDate,
            location: state.city ? state.city.split(',').map(c => c.trim()) : ['Chennai'],
            budget_range: String(state.budgetRange || 50000)
          }, { headers: { 'Content-Type': 'application/json' } })

          if (response.data?.screens) {
            const matched = response.data.screens
              .filter(s => bookedIds.includes(s.id))
              .map(screen => ({
                id: screen.id,
                name: screen.screen_name || 'Unnamed Screen',
                price_per_day: parseFloat(screen.base_price_per_slot_inr || 0),
                price_info: { adjusted_avg_price: parseFloat(screen.base_price_per_slot_inr || 0) },
                city_name: screen.city || state.city || 'Chennai',
                district_name: screen.district || '',
              }))
            if (matched.length > 0) setScreens(matched)
          }
        } catch (err) {
          console.error('Error fetching screen details:', err)
        } finally {
          setLoadingScreens(false)
        }
      }
      fetchScreenDetails()
    }
  }, [state])

  useEffect(() => {
    setCampaignName(initialCampaignName)
  }, [initialCampaignName])

  // --- Persistence Logic ---
  const STORAGE_KEY = 'xigi_campaign_draft';

  // Save to persistence whenever state changes here
  useEffect(() => {
    // Only save if we actually have screens or a name (don't overwrite with empty on mount)
    if (screens.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      let existing = {};
      try { existing = saved ? JSON.parse(saved) : {}; } catch (e) { }

      const updated = {
        ...existing,
        campaignName,
        selectedScreens: screens,
        slotCount,
        city,
        startDate,
        endDate,
        objective: state?.objective || existing.objective || ''
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Also persist to sessionStorage for back-navigation
      sessionStorage.setItem(BUNDLE_SESSION_KEY, JSON.stringify({
        campaignName,
        selectedScreens: screens,
        slotCount,
        campaignId: campaignIdFromState,
        gatewayId: gatewayIdFromState,
        priceSnapshot,
        priceChangeAccepted,
        city,
        startDate,
        endDate,
        objective: state?.objective || existing.objective || ''
      }));
    }
  }, [campaignName, screens, slotCount, city, startDate, endDate, state?.objective, priceChangeAccepted]);

  // Restore from persistence if state is missing
  useEffect(() => {
    if (!state || !state.selectedScreens) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.campaignName) setCampaignName(data.campaignName);
          if (data.selectedScreens) setScreens(data.selectedScreens);
          if (data.city) setCity(data.city);
          if (data.startDate) setStartDate(data.startDate);
          if (data.endDate) setEndDate(data.endDate);
        } catch (e) {
          console.error("Failed to restore bundle state", e);
        }
      }
    }
  }, [state]);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0
    const s = new Date(startDate)
    const e = new Date(endDate)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0
    return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1)
  }, [startDate, endDate])

  const totals = useMemo(() => {
    const costPerDay = screens.reduce((sum, sc) => {
      const slots = slotCount?.[sc.id] || 0
      const price = Number(sc.price_per_day || sc.price_info?.adjusted_avg_price || 0)
      return sum + price * slots
    }, 0)
    const total = costPerDay * (days || 1)
    // Temporary reach estimate (until we wire real data): 25k per selected screen + 10k per extra slot
    const reach = screens.reduce((sum, sc, idx) => {
      const slots = slotCount?.[sc.id] || 0
      const base = 25000 + (idx % 3) * 5000
      return sum + base + Math.max(0, slots - 1) * 10000
    }, 0)
    const low = Math.round(reach * 0.92)
    const high = Math.round(reach * 1.12)
    return { costPerDay, total, reach, low, high }
  }, [screens, slotCount, days])

  const formatMoney = (n) => Math.round(Number(n || 0)).toLocaleString('en-IN')
  const formatReach = (n) => `~${Math.round(Number(n || 0)).toLocaleString('en-IN')}`

  const removeScreen = (id) => setScreens(prev => prev.filter(s => s.id !== id))

  // Price comparison helper
  const getPriceStatus = (screenId, currentPrice) => {
    const snapshotPrice = Number(priceSnapshot?.[screenId] || 0)
    const current = Number(currentPrice || 0)
    if (!snapshotPrice || !current) return { status: 'locked', label: 'Locked', color: '#16a34a' }
    const diff = current - snapshotPrice
    if (Math.abs(diff) < 1) return { status: 'locked', label: 'Locked', color: '#16a34a' }
    if (diff > 0) return { status: 'hiked', label: `+₹${formatMoney(diff)}`, color: '#ef4444' }
    return { status: 'reduced', label: `-₹${formatMoney(Math.abs(diff))}`, color: '#16a34a' }
  }

  // Overall pricing status
  const overallPriceStatus = useMemo(() => {
    if (!Object.keys(priceSnapshot).length || screens.length === 0) return 'locked'
    const statuses = screens.map(s => {
      const price = Number(s.price_per_day || s.price_info?.adjusted_avg_price || 0)
      return getPriceStatus(s.id, price).status
    })
    if (statuses.some(st => st === 'hiked')) return 'hiked'
    if (statuses.some(st => st === 'reduced')) return 'reduced'
    return 'locked'
  }, [screens, priceSnapshot])

  const restorePayload = {
    restoreSelection: {
      campaignName,
      campaignCreated: true,
      selectedScreens: screens,
      slotCount,
      city,
      startDate,
      endDate,
      objective: state?.objective || ''
    }
  }

  // Publish live page data for XIA — full screen + pricing details
  useEffect(() => {
    setPageContext({
      page: 'campaign_bundle',
      page_label: 'Campaign Bundle Review',
      summary: `Reviewing bundle "${campaignName}". ${screens.length} screens selected. Budget: ₹${totals.total.toLocaleString('en-IN')}. City: ${city}. ${startDate} to ${endDate} (${days} days).`,
      data: {
        campaign_name: campaignName,
        screens_count: screens.length,
        total_budget: totals.total,
        total_base_cost: totals.base,
        total_gst: totals.gst,
        estimated_reach: totals.reach,
        city,
        start_date: startDate,
        end_date: endDate,
        days,
        pricing_status: overallPriceStatus,
        screens: screens.map(s => ({
          name: s.name,
          location: s.location || s.city,
          media_type: s.mediaType || s.media_type,
          slots: slotCount?.[s.id] || 0,
          cost_per_slot: s.costPerSlot || s.cost_per_slot,
          screen_total: (slotCount?.[s.id] || 0) * (s.costPerSlot || s.cost_per_slot || 0),
        })),
      }
    })
    return () => setPageContext(null)
  }, [screens, campaignName, totals, city, startDate, endDate, overallPriceStatus])

  return (
    <div className="bundle-page">
      <Header />

      <div className="bundle-top">
        <div className="bundle-top-inner">
          <button
            type="button"
            className="bundle-back"
            onClick={() => navigate('/create-campaign', { state: restorePayload })}
          >
            <i className="bi bi-chevron-left"></i>
            Back to Selection
          </button>

          <div className="bundle-campaign-name-row">
            {isEditingName ? (
              <input
                className="bundle-name-input"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                autoFocus
              />
            ) : (
              <>
                <div className="bundle-campaign-name">{campaignName}</div>
                <button type="button" className="bundle-name-edit-btn" onClick={() => setIsEditingName(true)} aria-label="Edit campaign name">
                  <i className="bi bi-pencil"></i>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bundle-content">
        <div className="bundle-header-row">
          <div>
            <div className="bundle-section-title">Plan Summary</div>
            <div className="bundle-section-subtitle">Review your candidates and proceed to lock.</div>
          </div>
          <button
            type="button"
            className="bundle-edit-link"
            onClick={() => navigate('/create-campaign', { state: restorePayload })}
          >
            <i className="bi bi-pencil"></i>
            Edit gate & selections
          </button>
        </div>

        <div className="bundle-cards">
          <div className="bundle-card">
            <div className="bundle-card-title">Estimated Net Reach</div>
            <div className="bundle-card-value">{formatReach(totals.reach)}</div>
            <div className="bundle-card-sub">Confidence Band: {Math.round(totals.low / 1000)}k-{Math.round(totals.high / 1000)}k</div>
          </div>
          <div className="bundle-card">
            <div className="bundle-card-title">Total Media Investment</div>
            <div className="bundle-card-value">₹ {formatMoney(totals.total)}</div>
            <div className="bundle-bullet" style={{ color: overallPriceStatus === 'hiked' ? '#ef4444' : '#16a34a' }}>
              {overallPriceStatus === 'locked' && '• Pricing Locked for 10 Minutes'}
              {overallPriceStatus === 'hiked' && '⚠ Some screen prices have increased'}
              {overallPriceStatus === 'reduced' && '✓ Some screen prices have decreased'}
            </div>
            <div className="bundle-card-muted">Includes all screen fees, data processing, and platform service fee.</div>
          </div>
          <div className="bundle-card">
            <div className="bundle-card-title">Inventory Summary</div>
            <div className="bundle-card-value">{screens.length} Screens</div>
            <div className="bundle-card-sub" style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>CITY</div>
                <div style={{ fontWeight: 800 }}>{(() => {
                  const screenCities = [...new Set(screens.map(s => s.city_name).filter(Boolean))]
                  return screenCities.length > 0 ? screenCities.join(', ') : city
                })()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>DAYS</div>
                <div style={{ fontWeight: 800 }}>{days || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="inventory-row">
          <div>
            <div className="bundle-section-title" style={{ marginTop: '10px' }}>Plan Inventory</div>
            <div className="bundle-table-card" style={{ marginTop: '10px' }}>
              <div className="bundle-table-header">
                <div className="bundle-table-title">Plan Inventory</div>
                <div className="bundle-table-count">{screens.length} Screens Selected</div>
              </div>
              <table className="bundle-table">
                <thead>
                  <tr>
                    <th>Location Details</th>
                    <th>Est. Reach</th>
                    <th>Slots Booked</th>
                    <th>Cost/Day</th>
                    <th>Price Status</th>
                    <th style={{ width: '90px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {screens.map((s, idx) => {
                    const reachK = [125000, 210000, 95000, 85000, 140000][idx % 5]
                    const price = Number(s.price_per_day || s.price_info?.adjusted_avg_price || 0)
                    const slots = slotCount?.[s.id] || 0
                    const costDay = price * Math.max(1, slots || 1)
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="bundle-loc-name">{s.name}</div>
                          <div className="bundle-loc-sub">{s.district_name || ''}{(s.district_name && s.city_name) ? ', ' : ''}{s.city_name || city}</div>
                        </td>
                        <td>{formatMoney(reachK)}</td>
                        <td>{slots}</td>
                        <td>₹{formatMoney(costDay)}</td>
                        <td>
                          {(() => {
                            const ps = getPriceStatus(s.id, price)
                            return (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                color: ps.color,
                                background: ps.status === 'locked' ? '#f0fdf4' : ps.status === 'hiked' ? '#fef2f2' : '#f0fdf4'
                              }}>
                                {ps.status === 'locked' && '✓ '}
                                {ps.status === 'hiked' && '↑ '}
                                {ps.status === 'reduced' && '↓ '}
                                {ps.label}
                              </span>
                            )
                          })()}
                        </td>
                        <td>
                          <button type="button" className="bundle-trash" onClick={() => removeScreen(s.id)} aria-label="Remove">
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {screens.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ color: '#64748b', fontWeight: 700 }}>No screens selected.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="plan-intel" style={{ marginTop: '46px' }}>
            <div className="plan-intel-title">
              <i className="bi bi-stars"></i>
              Plan Intelligence
            </div>
            <div className="plan-intel-sub">
              {overallPriceStatus === 'locked'
                ? 'All selections fit your budget and objective.'
                : priceChangeAccepted
                  ? 'Updated pricing accepted. You may proceed.'
                  : 'Some screen prices have changed since your draft. Please review and accept before proceeding.'}
            </div>

            {overallPriceStatus !== 'locked' && !priceChangeAccepted && (
              <button
                type="button"
                className="plan-intel-btn"
                style={{ background: overallPriceStatus === 'hiked' ? '#ef4444' : '#16a34a', marginBottom: '10px' }}
                onClick={() => setPriceChangeAccepted(true)}
              >
                {overallPriceStatus === 'hiked' ? '⚠ Accept Updated Pricing' : '✓ Accept Reduced Pricing'}
              </button>
            )}

            <button
              type="button"
              className="plan-intel-btn"
              disabled={overallPriceStatus !== 'locked' && !priceChangeAccepted}
              style={{
                opacity: (overallPriceStatus !== 'locked' && !priceChangeAccepted) ? 0.5 : 1,
                cursor: (overallPriceStatus !== 'locked' && !priceChangeAccepted) ? 'not-allowed' : 'pointer'
              }}
              onClick={() => {
                if (overallPriceStatus !== 'locked' && !priceChangeAccepted) return
                navigate('/proposal-review', {
                  state: {
                    campaignName,
                    selectedScreens: screens,
                    slotCount,
                    city,
                    startDate,
                    endDate,
                    objective: state?.objective || '',
                    campaignId: campaignIdFromState,
                    gatewayId: gatewayIdFromState,
                    priceSnapshot,
                    priceChangeAccepted
                  }
                })
              }}
            >
              Proceed to Proposal Lock
            </button>
            <div className="plan-intel-help">You'll be able to review before final confirmation</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CampaignBundle


