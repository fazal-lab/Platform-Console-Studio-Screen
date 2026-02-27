import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'
import '../styles/dashboard.css'
import '../styles/proposalReview.css'
import { useXiaContext } from '../context/XiaContext'

function formatMoney(n) {
  return Math.round(Number(n || 0)).toLocaleString('en-IN')
}

function ProposalReview() {
  const navigate = useNavigate()
  const { state } = useLocation()

  // Session persistence key
  const PROPOSAL_SESSION_KEY = 'xigi_proposal_session'

  // Restore from sessionStorage if location.state is missing
  const sessionRestore = (() => {
    if (state?.selectedScreens) return null // fresh navigation, no need
    try {
      const saved = sessionStorage.getItem(PROPOSAL_SESSION_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })()

  const campaignName = state?.campaignName || sessionRestore?.campaignName || 'Untitled Campaign'
  const screens = state?.selectedScreens || sessionRestore?.selectedScreens || []
  const slotCount = state?.slotCount || sessionRestore?.slotCount || {}
  const city = state?.city || sessionRestore?.city || ''
  const startDate = state?.startDate || sessionRestore?.startDate || ''
  const endDate = state?.endDate || sessionRestore?.endDate || ''
  const objective = state?.objective || sessionRestore?.objective || ''
  const campaignId = state?.campaignId || sessionRestore?.campaignId || null
  const gatewayId = state?.gatewayId || sessionRestore?.gatewayId || null

  // Server-driven guard: check if campaign is already paid
  useEffect(() => {
    if (!campaignId) return
    axios.get(`/api/console/slot-bookings/status/?campaign_id=${campaignId}`)
      .then(res => {
        if (res.data?.payment_status === 'PAID') {
          window.location.replace('/active-dashboard-demo')
        }
      })
      .catch(() => { })
  }, [campaignId])

  // Save page state to sessionStorage on mount (when arriving with fresh state)
  useEffect(() => {
    if (state?.selectedScreens && screens.length > 0) {
      sessionStorage.setItem(PROPOSAL_SESSION_KEY, JSON.stringify({
        campaignName, selectedScreens: screens, slotCount,
        city, startDate, endDate, objective, campaignId, gatewayId
      }))
    }
  }, [])

  const [proposalId, setProposalId] = useState(null)
  const [lockStatus, setLockStatus] = useState('loading') // 'loading' | 'locked' | 'error'
  const [capacityOk, setCapacityOk] = useState(false)
  const [policyOk, setPolicyOk] = useState(false)
  const [holdTimeRemaining, setHoldTimeRemaining] = useState(600) // 10 minutes in seconds
  const [failedScreens, setFailedScreens] = useState([]) // Screens that failed capacity check
  const [policyConflicts, setPolicyConflicts] = useState([]) // Policy conflicts
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [capacityCheckDone, setCapacityCheckDone] = useState(false) // step 1 finished
  const [policyCheckReady, setPolicyCheckReady] = useState(false) // step 2 ready for user
  const [holdAlreadyActive, setHoldAlreadyActive] = useState(false) // existing hold detected
  const { setPageContext } = useXiaContext()

  // Check for existing active hold on mount
  const holdKey = `hold_${campaignId}`
  const existingHold = (() => {
    try {
      const saved = sessionStorage.getItem(holdKey)
      if (!saved || !campaignId) return null
      const data = JSON.parse(saved)
      const elapsed = Math.floor((Date.now() - data.startedAt) / 1000)
      if (elapsed < 600) return { remaining: 600 - elapsed }
      sessionStorage.removeItem(holdKey)
      return null
    } catch { return null }
  })()

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0
    const s = new Date(startDate)
    const e = new Date(endDate)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0
    return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1)
  }, [startDate, endDate])

  const totalInvestment = useMemo(() => {
    const costPerDay = screens.reduce((sum, sc) => {
      const slots = slotCount?.[sc.id] || 0
      const price = Number(sc.price_per_day || sc.price_info?.adjusted_avg_price || 0)
      return sum + price * slots
    }, 0)
    return costPerDay * (days || 1)
  }, [screens, slotCount, days])

  // All three readiness checks must pass before timer starts
  const allPassed = capacityOk && policyOk && lockStatus === 'locked'

  // Publish live page data for XIA — include per-screen readiness
  useEffect(() => {
    setPageContext({
      page: 'proposal_review',
      page_label: 'Proposal Review & Readiness',
      summary: `Proposal review for "${campaignName}". Investment: ₹${formatMoney(totalInvestment)}. Capacity: ${capacityOk ? 'OK' : 'Pending'}. Policy: ${policyOk ? 'Accepted' : 'Pending'}. Lock: ${lockStatus}.`,
      data: {
        campaign_id: campaignId,
        campaign_name: campaignName,
        city,
        start_date: startDate,
        end_date: endDate,
        total_investment: totalInvestment,
        capacity_ok: capacityOk,
        policy_ok: policyOk,
        lock_status: lockStatus,
        hold_remaining_seconds: holdTimeRemaining,
        all_passed: allPassed,
        screens: screens.map(s => ({
          name: s.name,
          location: s.location || s.city,
          slots: s.slots || s.slot_count,
          cost: s.totalCost || s.cost,
          capacity_status: failedScreens.includes(s.id) ? 'FAILED' : 'PASSED',
        })),
        failed_screens_count: failedScreens.length,
      }
    })
    return () => setPageContext(null)
  }, [capacityOk, policyOk, lockStatus, holdTimeRemaining, totalInvestment, screens, allPassed])

  // If returning within an active hold, restore state immediately
  useEffect(() => {
    if (existingHold) {
      setCapacityOk(true)
      setPolicyOk(true)
      setLockStatus('locked')
      setCapacityCheckDone(true)
      setPolicyCheckReady(true)
      setHoldTimeRemaining(existingHold.remaining)
      setHoldAlreadyActive(true)
    }
  }, [])

  // Run readiness checks on mount — only if no active hold
  useEffect(() => {
    if (existingHold) return // Skip — hold is already active

    const runReadinessChecks = async () => {
      try {
        // ---- Step 1: Inventory Capacity Check (port 8000 API) ----
        const bookedScreens = screens.map(sc => ({
          screen_id: sc.id,
          slots_booked: slotCount?.[sc.id] || 1
        }))

        // Run API call and minimum 2s delay in parallel
        const [capacityRes] = await Promise.all([
          axios.post(
            '/api/console/screens/capacity-check/',
            {
              start_date: startDate,
              end_date: endDate,
              booked_screens: bookedScreens
            },
            { headers: { 'Content-Type': 'application/json' } }
          ),
          new Promise(r => setTimeout(r, 2000)) // min 2s delay
        ])

        if (capacityRes.data?.status === 'success') {
          const isCapacityReady = capacityRes.data.capacity_ready
          setCapacityOk(isCapacityReady)

          // Collect failed screens
          if (!isCapacityReady && capacityRes.data.screens) {
            const failed = capacityRes.data.screens
              .filter(s => !s.passed)
              .map(s => ({
                name: s.screen_name,
                screen_id: s.screen_id,
                available: s.available_slots,
                requested: s.requested_slots
              }))
            setFailedScreens(failed)
          }
        } else {
          setCapacityOk(false)
        }

        // ---- Step 2: Policy Compliance — 1.5s delay before showing ----
        await new Promise(r => setTimeout(r, 1500))
        setCapacityCheckDone(true)
        setPolicyCheckReady(true)
        // policyOk stays false until user accepts via the modal

        // ---- Step 3: Pricing Snapshot Lock — 1.5s delay ----
        await new Promise(r => setTimeout(r, 1500))

        if (capacityRes.data?.capacity_ready && campaignId) {
          try {
            const token = localStorage.getItem('token')
            const res = await axios.post(`/api/studio/campaign/${campaignId}/proposal/lock/`, {}, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.data?.data?.proposal?.id) {
              setProposalId(res.data.data.proposal.id)
            }
          } catch (lockErr) {
            console.error('Proposal snapshot creation failed:', lockErr)
          }
        }

        // Set final lock status based on capacity result
        setLockStatus(capacityRes.data?.capacity_ready ? 'locked' : 'error')

      } catch (err) {
        console.error('Readiness check failed:', err)
        setCapacityOk(false)
        setLockStatus('error')
      }
    }

    if (screens.length > 0 && startDate && endDate) {
      runReadinessChecks()
    } else {
      setLockStatus('error')
    }
  }, [screens, startDate, endDate, campaignId])


  // Hold timer countdown — only starts when ALL checks pass
  useEffect(() => {
    if (!allPassed) return

    // Only book slots if this is a NEW hold (not restoring an existing one)
    if (!holdAlreadyActive) {
      // Save hold start time to sessionStorage
      sessionStorage.setItem(holdKey, JSON.stringify({ startedAt: Date.now() }))

      // Book/hold slots for each screen via SlotBooking API
      const bookSlots = async () => {
        const userId = localStorage.getItem('userId') || ''
        try {
          await Promise.all(
            screens.map(sc => {
              const numSlots = slotCount?.[sc.id] || 1
              return axios.post(
                '/api/console/slot-bookings/',
                {
                  screen: sc.id,
                  num_slots: numSlots,
                  start_date: startDate,
                  end_date: endDate,
                  campaign_id: campaignId || '',
                  user_id: userId
                },
                { headers: { 'Content-Type': 'application/json' } }
              )
            })
          )
          console.log('All slot bookings created (HOLD)')
        } catch (err) {
          console.error('Slot booking failed:', err)
        }
      }

      bookSlots()

      // Set timer to 10 minutes for a fresh hold
      setHoldTimeRemaining(600)
    }

    const timer = setInterval(() => {
      setHoldTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          // Clear hold from session when expired
          sessionStorage.removeItem(holdKey)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [allPassed])

  // Check campaign name
  useEffect(() => {
    if (lockStatus === 'locked' && (!campaignName || campaignName === 'Untitled Campaign')) {
      setShowNamePrompt(true)
    }
  }, [lockStatus, campaignName])

  const restorePayload = {
    restoreSelection: {
      campaignName,
      selectedScreens: screens,
      slotCount,
      city,
      startDate,
      endDate,
      objective
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="proposal-page">
      <Header />

      <div className="proposal-center">
        <div className="proposal-card">
          <div className="proposal-title">Proposal Review & Readiness</div>
          <div className="proposal-subtitle">
            We are validating your campaign’s technical readiness and generating a final pricing snapshot.
          </div>

          {/* Hold Timer — only shows after all 3 checks pass */}
          {allPassed && (
            <div className={`proposal-hold-timer ${holdTimeRemaining < 120 ? 'urgent' : ''}`}>
              <i className="bi bi-clock-history"></i>
              <span>Hold expires in: <strong>{formatTime(holdTimeRemaining)}</strong></span>
            </div>
          )}

          {/* Campaign Name Prompt */}
          {showNamePrompt && (
            <div className="proposal-name-alert">
              <i className="bi bi-exclamation-triangle"></i>
              <span>Campaign name is required. Please go back and set a campaign name before proceeding.</span>
            </div>
          )}

          {/* Failure States */}
          {failedScreens.length > 0 && (
            <div className="proposal-error-box">
              <div className="proposal-error-title">
                <i className="bi bi-x-circle"></i> Capacity Issues
              </div>
              <p>The following screens no longer have enough available slots:</p>
              <ul>
                {failedScreens.map((screen, idx) => (
                  <li key={idx}>
                    <strong>{screen.name || screen.screen_id}</strong>
                    {screen.available !== undefined && ` — ${screen.available} available, ${screen.requested} requested`}
                  </li>
                ))}
              </ul>
              <p>Please go back and select alternative screens or reduce slots.</p>
            </div>
          )}

          {policyConflicts.length > 0 && (
            <div className="proposal-error-box">
              <div className="proposal-error-title">
                <i className="bi bi-shield-x"></i> Policy Conflicts
              </div>
              <ul>
                {policyConflicts.map((conflict, idx) => (
                  <li key={idx}>{conflict.message || conflict}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="proposal-checklist">
            <div className="proposal-checklist-header">
              <div className="proposal-checklist-title">Readiness Checklist</div>
              <div className="proposal-checklist-chip">{(!capacityCheckDone || lockStatus === 'loading') ? 'Analyzing' : ((capacityOk && policyOk && lockStatus === 'locked') ? 'All Passed' : 'Action Required')}</div>
            </div>

            <div className="proposal-checklist-row">
              <div className="proposal-checklist-left">
                <span className={`proposal-check ${!capacityCheckDone ? 'spin' : (capacityOk ? 'ok' : 'fail')}`}>{capacityCheckDone ? (capacityOk ? '✓' : '✗') : ''}</span>
                Inventory Capacity Checked
              </div>
              <div className={`proposal-status ${!capacityCheckDone ? 'updating' : (capacityOk ? 'ok' : 'fail')}`}>{!capacityCheckDone ? 'Checking...' : (capacityOk ? 'Passed' : 'Failed')}</div>
            </div>
            <div className="proposal-checklist-row">
              <div className="proposal-checklist-left">
                <span className={`proposal-check ${!policyCheckReady ? 'spin' : (policyOk ? 'ok' : 'pending')}`}>{policyCheckReady ? (policyOk ? '✓' : '!') : ''}</span>
                Policy Compliance Verified
              </div>
              {!policyCheckReady ? (
                <div className="proposal-status updating">Checking...</div>
              ) : policyOk ? (
                <div className="proposal-status ok">Accepted</div>
              ) : (
                <button type="button" className="policy-review-link" onClick={() => setShowPolicyModal(true)}>
                  Review & Accept <i className="bi bi-chevron-right"></i>
                </button>
              )}
            </div>
            <div className="proposal-checklist-row">
              <div className="proposal-checklist-left">
                <span className={`proposal-check ${lockStatus === 'locked' ? 'ok' : 'spin'}`}>{lockStatus === 'locked' ? '✓' : ''}</span>
                Real-time Pricing Snapshot
              </div>
              <div className={`proposal-status ${lockStatus === 'locked' ? 'ok' : 'updating'}`}>{lockStatus === 'locked' ? 'Locked' : 'Updating'}</div>
            </div>
          </div>

          <div className="proposal-investment-row">
            <div className="proposal-investment-label">Estimated Media Investment</div>
            <div className="proposal-investment-value">₹{formatMoney(totalInvestment)}</div>
          </div>

          {/* Locked Screens Summary */}
          {lockStatus === 'locked' && screens.length > 0 && (
            <div className="proposal-screens-section">
              <div className="proposal-screens-title">
                <i className="bi bi-lock-fill"></i> Locked Screens ({screens.length})
              </div>
              <div className="proposal-screens-table">
                <table>
                  <thead>
                    <tr>
                      <th>Screen Name</th>
                      <th>Location</th>
                      <th>Slots</th>
                      <th>Cost/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screens.map((screen) => {
                      const slots = slotCount?.[screen.id] || 1
                      const price = Number(screen.price_per_day || screen.price_info?.adjusted_avg_price || 0)
                      const costPerDay = price * slots
                      return (
                        <tr key={screen.id}>
                          <td>{screen.name}</td>
                          <td>{screen.district_name || ''}{screen.district_name && screen.city_name ? ', ' : ''}{screen.city_name || city}</td>
                          <td>{slots}</td>
                          <td>₹{formatMoney(costPerDay)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="proposal-info">
            <div className="proposal-info-icon">
              <i className="bi bi-exclamation-circle"></i>
            </div>
            <div className="proposal-info-text">
              Pricing and inventory availability are verified in real-time. Final costs and screen slots are secured upon successful completion of the booking.
            </div>
          </div>

          <div className="proposal-footer">
            <button
              type="button"
              className="proposal-link-btn"
              onClick={() => navigate('/campaign-bundle', { state: restorePayload })}
            >
              <i className="bi bi-chevron-left"></i>
              Go back to Plan Summary
            </button>
            <button
              type="button"
              className="proposal-primary-btn"
              disabled={lockStatus !== 'locked' || !capacityOk || !policyOk || holdTimeRemaining === 0 || showNamePrompt}
              onClick={() =>
                navigate('/secure-checkout', {
                  state: { campaignName, selectedScreens: screens, slotCount, city, startDate, endDate, objective, campaignId, gatewayId, proposalId }
                })
              }
            >
              Confirm & Proceed to Payment
            </button>
          </div>
        </div>
      </div>

      {/* Policy Compliance Modal */}
      {showPolicyModal && (
        <div className="policy-modal-overlay" onClick={() => setShowPolicyModal(false)}>
          <div className="policy-modal" onClick={e => e.stopPropagation()}>
            <div className="policy-modal-header">
              <div className="policy-modal-title">
                <i className="bi bi-shield-check"></i>
                Booking Policy & Terms
              </div>
              <button className="policy-modal-close" onClick={() => setShowPolicyModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="policy-modal-body">
              <p className="policy-intro">
                Please carefully read and understand the following terms before proceeding with your campaign booking. By accepting, you confirm that you have reviewed all details and agree to the conditions below.
              </p>

              <div className="policy-section">
                <div className="policy-section-number">1</div>
                <div className="policy-section-content">
                  <h4>Your Responsibility</h4>
                  <p>
                    You are responsible for reviewing each screen's details — including <strong>location, content restrictions, operating hours, and audience type</strong> — before booking. Refund requests based on missed details will not be accepted.
                  </p>
                </div>
              </div>

              <div className="policy-section">
                <div className="policy-section-number">2</div>
                <div className="policy-section-content">
                  <h4>Content Restrictions</h4>
                  <p>
                    Some screens restrict certain ad categories (e.g., tobacco, alcohol, political). If your ad is <strong>rejected during upload review</strong> due to a restriction that was visible at the time of selection, no refund will be issued.
                  </p>
                </div>
              </div>

              <div className="policy-section highlight">
                <div className="policy-section-number">3</div>
                <div className="policy-section-content">
                  <h4>Cancellation & Refund</h4>
                  <p>
                    If you cancel after booking, a <strong>20% cancellation fee</strong> applies. You will receive only <strong>80% of the paid amount</strong> as a refund — regardless of the reason, including ad rejection or change of plans.
                  </p>
                </div>
              </div>
            </div>

            <div className="policy-modal-footer">
              <button className="policy-decline-btn" onClick={() => setShowPolicyModal(false)}>
                I'll Review Later
              </button>
              <button className="policy-accept-btn" onClick={() => { setPolicyOk(true); setShowPolicyModal(false) }}>
                <i className="bi bi-check-circle"></i>
                I Accept These Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProposalReview


