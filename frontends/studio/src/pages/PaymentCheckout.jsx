import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'
import AlertModal from '../components/Common/AlertModal'
import '../styles/dashboard.css'
import '../styles/paymentCheckout.css'
import '../styles/createCampaign.css'

function formatMoney(n) {
  const num = Number(n || 0)
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PaymentCheckout() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const campaignName = state?.campaignName || 'Untitled Campaign'
  const screens = state?.selectedScreens || []
  const slotCount = state?.slotCount || {}
  const city = state?.city || ''
  const startDate = state?.startDate || ''
  const endDate = state?.endDate || ''
  const objective = state?.objective || ''
  const proposalId = state?.proposalId || null
  const campaignId = state?.campaignId || null

  // Server-driven guard: check if campaign is already paid
  useEffect(() => {
    if (!campaignId) return
    axios.get(`/api/console/slot-bookings/status/?campaign_id=${campaignId}`)
      .then(res => {
        if (res.data?.payment_status === 'PAID') {
          window.location.replace('/active-dashboard-demo')
        }
      })
      .catch(() => { }) // silent fail
  }, [campaignId])

  // User must explicitly choose a method first
  const [paymentMethod, setPaymentMethod] = useState(null) // 'card' | 'upi' | null
  const [cardDetails, setCardDetails] = useState({ number: '', name: '', expiry: '', cvv: '' })
  const [paymentId, setPaymentId] = useState(null)
  const [paying, setPaying] = useState(false)
  const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error' })

  // Create payment record on mount
  useEffect(() => {
    const createPayment = async () => {
      if (!proposalId) return
      try {
        const token = localStorage.getItem('token')
        const res = await axios.post(`/api/studio/proposal/${proposalId}/pay/`, {
          payment_method: 'card'
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.data?.data?.id) {
          setPaymentId(res.data.data.id)
        }
      } catch (err) {
        console.error('Payment creation failed:', err)
      }
    }
    createPayment()
  }, [proposalId])

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0
    const s = new Date(startDate)
    const e = new Date(endDate)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0
    return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1)
  }, [startDate, endDate])

  const totals = useMemo(() => {
    const selectedSlots = screens.reduce((sum, sc) => sum + (slotCount?.[sc.id] || 0), 0)
    const costPerDay = screens.reduce((sum, sc) => {
      const slots = slotCount?.[sc.id] || 0
      const price = Number(sc.price_per_day || sc.price_info?.adjusted_avg_price || 0)
      return sum + price * slots
    }, 0)
    const total = costPerDay * (days || 1)
    // temporary impressions estimate
    const impressions = Math.round(screens.length * 90000 + selectedSlots * 5000)
    return { selectedSlots, costPerDay, total, impressions }
  }, [screens, slotCount, days])

  const grouped = useMemo(() => {
    // simple grouping by city (or fallback)
    const groups = new Map()
    screens.forEach((sc) => {
      const key = sc.city_name || city || 'Selected Group'
      const prev = groups.get(key) || { name: key, total: 0 }
      const slots = slotCount?.[sc.id] || 0
      const price = Number(sc.price_per_day || sc.price_info?.adjusted_avg_price || 0)
      prev.total += price * slots * (days || 1)
      groups.set(key, prev)
    })
    return Array.from(groups.values())
  }, [screens, slotCount, city, days])

  const handlePay = async () => {
    if (!paymentMethod) {
      setAlert({ show: true, title: 'Payment Method Required', message: 'Please select a payment method to continue.', type: 'error' })
      return
    }
    if (paymentMethod === 'card') {
      if (!cardDetails.number || !cardDetails.name || !cardDetails.expiry || !cardDetails.cvv) {
        setAlert({ show: true, title: 'Card Details Missing', message: 'Please enter all card details to proceed.', type: 'error' })
        return
      }
    }

    setPaying(true)
    try {
      // 1. Activate slot bookings via payment API
      const slotPayRes = await axios.post(
        '/api/console/slot-bookings/payment/',
        {
          campaign_id: campaignId || '',
          payment: 'PAID'
        },
        { headers: { 'Content-Type': 'application/json' } }
      )
      console.log('Slot bookings activated:', slotPayRes.data)

      // 2. Update payment record in Studio backend (if exists)
      if (paymentId) {
        const token = localStorage.getItem('token')
        await axios.patch(`/api/studio/payment/${paymentId}/`, {
          payment_status: 'completed',
          payment_method: paymentMethod,
          payment_reference: `PAY-${Date.now()}`
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      }

      // 3. Update campaign status to 'active' in Studio backend
      if (campaignId) {
        const token = localStorage.getItem('token')
        await axios.patch(`/api/studio/campaign/${campaignId}/status/`, {
          status: 'active'
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(err => console.warn('Campaign status update failed:', err))
      }

      // Clear campaign session data — server is now source of truth for paid status
      sessionStorage.removeItem('xigi_bundle_session')
      sessionStorage.removeItem('xigi_proposal_session')
      sessionStorage.removeItem(`hold_${campaignId}`)
      localStorage.removeItem('xigi_campaign_draft')

      // Hard redirect — clears SPA history so back button can't return
      window.location.replace('/active-dashboard-demo')
    } catch (err) {
      console.error('Payment failed:', err)
      if (err.response?.status === 410) {
        // All bookings expired — payment window passed
        setAlert({
          show: true,
          title: 'Payment Window Expired',
          message: err.response.data?.message || 'All bookings have expired. The 10-minute hold period has passed. Please go back and re-select your screens.',
          type: 'error'
        })
      } else {
        setAlert({
          show: true,
          title: 'Payment Failed',
          message: 'Something went wrong while processing your payment. Please try again.',
          type: 'error'
        })
      }
    } finally {
      setPaying(false)
    }
  }



  return (
    <div className="pay-page">
      <Header />

      <div className="pay-layout">
        {/* Left: Order Breakdown */}
        <div className="pay-left">
          <div className="pay-left-card">
            <div className="pay-left-title">Order Breakdown</div>

            <div className="pay-kv">
              <div className="pay-k">Screens</div>
              <div className="pay-v">{screens.length}</div>
            </div>
            <div className="pay-kv">
              <div className="pay-k">Duration</div>
              <div className="pay-v">{days} Days</div>
            </div>
            <div className="pay-kv">
              <div className="pay-k">Impressions</div>
              <div className="pay-v">{(totals.impressions / 1000000).toFixed(1)}M</div>
            </div>

            <div className="pay-divider" />

            <div className="pay-left-subtitle">Selected Groups</div>
            <div className="pay-groups">
              {grouped.map((g) => (
                <div key={g.name} className="pay-group-row">
                  <div className="pay-group-name">{g.name}</div>
                  <div className="pay-group-amt">₹{Math.round(g.total).toLocaleString('en-IN')}</div>
                </div>
              ))}
              {grouped.length === 0 && (
                <div className="pay-empty">No selections</div>
              )}
            </div>

            <div className="pay-total">
              <div className="pay-total-label">Total (Inc. GST)</div>
              <div className="pay-total-value">₹{Math.round(totals.total).toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>

        {/* Center: Secure Checkout */}
        <div className="pay-center">
          <div className="pay-center-shell">
            <div className="pay-center-header">
              <div className="pay-center-title">Secure Checkout</div>
              <div className="pay-center-sub">Complete the transaction to secure your campaign inventory.</div>
            </div>

            <div className="pay-center-body">
              <div className="pay-center-inner">
                <div className="pay-note">
                  <strong>XIA Note:</strong> I've applied a bundle discount of 5% because you selected screens in both Chennai and Bangalore.
                </div>

                <div className="pay-method-title">Select Payment Method</div>

                <button
                  type="button"
                  className={`pay-method-card ${paymentMethod === 'card' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('card')}
                >
                  <div className="pay-method-icon">
                    <i className="bi bi-credit-card"></i>
                  </div>
                  <div className="pay-method-text">
                    <div className="pay-method-name">Credit / Debit Card</div>
                    <div className="pay-method-sub">Visa, Mastercard, Amex</div>
                  </div>
                  <div className="pay-method-check">
                    <i className={`bi ${paymentMethod === 'card' ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                  </div>
                </button>

                {paymentMethod === 'card' && (
                  <div className="pay-method-details">
                    <div className="pay-details-title">Card Details</div>
                    <div className="pay-form">
                      <div className="pay-field">
                        <label>Card Number</label>
                        <input
                          value={cardDetails.number}
                          onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                          placeholder="1234 5678 9012 3456"
                        />
                      </div>
                      <div className="pay-field">
                        <label>Name on Card</label>
                        <input
                          value={cardDetails.name}
                          onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                          placeholder="Tamil"
                        />
                      </div>
                      <div className="pay-row">
                        <div className="pay-field">
                          <label>Expiry</label>
                          <input
                            value={cardDetails.expiry}
                            onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                            placeholder="MM/YY"
                          />
                        </div>
                        <div className="pay-field">
                          <label>CVV</label>
                          <input
                            value={cardDetails.cvv}
                            onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                            placeholder="123"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className={`pay-method-card ${paymentMethod === 'upi' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('upi')}
                >
                  <div className="pay-method-icon">
                    <i className="bi bi-phone"></i>
                  </div>
                  <div className="pay-method-text">
                    <div className="pay-method-name">UPI / QR Code</div>
                    <div className="pay-method-sub">GPay, PhonePe, Paytm</div>
                  </div>
                  <div className="pay-method-check">
                    <i className={`bi ${paymentMethod === 'upi' ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                  </div>
                </button>

                {paymentMethod === 'upi' && (
                  <div className="pay-method-details">
                    <div className="pay-details-title">Scan QR to Pay</div>
                    <div className="upi-wrap">
                      <div className="upi-qr" aria-label="UPI QR code placeholder" />
                      <div className="upi-meta">
                        <div className="upi-id-label">UPI ID</div>
                        <div className="upi-id">xigi.pay@upi</div>
                        <div className="upi-hint">Open any UPI app and scan the QR</div>
                      </div>
                    </div>
                  </div>
                )}

                <button type="button" className="pay-now-btn" onClick={handlePay} disabled={paying}>
                  {paying ? 'Processing...' : `Pay ₹${formatMoney(totals.total)}`}
                </button>
              </div>
            </div>
          </div>
        </div>


      </div>
      <AlertModal
        isOpen={alert.show}
        onClose={() => setAlert({ ...alert, show: false })}
        title={alert.title}
        message={alert.message}
        type={alert.type}
      />
    </div>
  )
}

export default PaymentCheckout
