import { useState, useEffect } from 'react'
import { Container, Table, Spinner } from 'react-bootstrap'
import axios from 'axios'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '../styles/billing.css'
import Header from '../components/Header'

function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch invoices from API
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')

        if (!token) {
          setInvoices([])
          setLoading(false)
          return
        }

        const response = await axios.get(`/api/studio/invoices/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        const invoicesData = response.data.results || response.data.data || response.data || []
        setInvoices(Array.isArray(invoicesData) ? invoicesData : [])
      } catch (err) {
        console.error('Error fetching invoices:', err)
        setInvoices([])
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [])

  // Compute stats from real data
  const totalBilled = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0)
  const outstanding = invoices.reduce((sum, inv) => sum + parseFloat(inv.outstanding || 0), 0)

  const stats = [
    { label: 'Total Billed', value: formatCurrency(totalBilled), class: '' },
    { label: 'Outstanding', value: formatCurrency(outstanding), class: outstanding === 0 ? 'green' : 'orange' },
    { label: 'Credit Limit', value: '₹50,000.00', class: '' },
    { label: 'Invoices', value: invoices.length.toString(), class: '' }
  ]

  function formatCurrency(amount) {
    return `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const handleDownload = (invoiceId) => {
    console.log(`Downloading invoice: ${invoiceId}`)
  }

  const handleDownloadAll = () => {
    console.log('Downloading all invoices')
  }

  return (
    <div className="billing-wrapper">
      <Header />

      <div className="billing-container">
        {/* Header Row */}
        <div className="billing-header">
          <div className="billing-title-section">
            <h1>Billing & Invoices</h1>
            <div className="billing-subtitle">Manage your payments and download past statements.</div>
          </div>
          {invoices.length > 0 && (
            <div className="billing-actions">
              <button className="btn-download-all" onClick={handleDownloadAll}>
                <i className="bi bi-download"></i> Download All
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Loading...</p>
          </div>
        ) : invoices.length === 0 ? (
          /* Completely empty state for new users */
          <div className="text-center" style={{ padding: '100px 20px' }}>
            <i className="bi bi-receipt" style={{ fontSize: '64px', color: '#CBD5E1' }}></i>
            <h4 className="mt-4" style={{ color: '#64748B', fontWeight: '600' }}>No billing history yet</h4>
            <p className="text-muted" style={{ fontSize: '14px', maxWidth: '400px', margin: '8px auto 0' }}>
              Your invoices and payment details will appear here once you run a campaign.
            </p>
          </div>
        ) : (
          <>
            {/* Billing Stats Row */}
            <div className="billing-stats-row">
              {stats.map((stat, idx) => (
                <div className="billing-stat-card" key={idx}>
                  <div className="stat-card-label">{stat.label}</div>
                  <div className={`stat-card-value ${stat.class}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="billing-grid">

              {/* Left: Invoices Table */}
              <div className="invoices-card">
                <div className="invoices-card-header">
                  <h3>Billing History</h3>
                  <div className="text-muted" style={{ fontSize: '13px' }}>Showing last 12 months</div>
                </div>

                <div className="table-responsive">
                  <Table className="invoices-table">
                    <thead>
                      <tr>
                        <th>INVOICE ID</th>
                        <th>DATE</th>
                        <th>CAMPAIGN / BRAND</th>
                        <th>TOTAL AMOUNT</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>
                            <div className="invoice-id-cell">
                              <div className="invoice-icon-box">
                                <i className="bi bi-file-earmark-text"></i>
                              </div>
                              <span style={{ fontWeight: '700' }}>{invoice.id}</span>
                            </div>
                          </td>
                          <td style={{ color: '#64748B' }}>{invoice.date}</td>
                          <td>
                            <div className="invoice-brand">{invoice.brand}</div>
                            <div className="invoice-campaign">{invoice.campaign}</div>
                          </td>
                          <td>
                            <div className="invoice-amount">{formatCurrency(invoice.amount)}</div>
                          </td>
                          <td>
                            <button className="btn-download-invoice" onClick={() => handleDownload(invoice.id)}>
                              <i className="bi bi-download me-1"></i> Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>

              {/* Right: Sidebar */}
              <div className="sidebar-billing">
                <div className="payment-method-card">
                  <div className="sidebar-title">
                    <i className="bi bi-credit-card"></i> Payment Methods
                  </div>
                  <button className="btn-add-method">
                    + Add New Payment Method
                  </button>
                </div>
              </div>

            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default Invoices
