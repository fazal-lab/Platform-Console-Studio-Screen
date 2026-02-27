import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Container, Row, Col, Button, Table, Form, InputGroup, Dropdown, Spinner, Modal } from 'react-bootstrap'
import axios from 'axios'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '../styles/dashboard.css'
import '../styles/campaigns.css' // Import the new campaign styles
import Header from '../components/Header'
import { useXiaContext } from '../context/XiaContext'

const API_BASE_URL = ''

function Campaigns() {
  const [selectedBrand, setSelectedBrand] = useState('All Locations')
  const [selectedStatus, setSelectedStatus] = useState('All Status')
  const [searchQuery, setSearchQuery] = useState('')
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const { setPageContext } = useXiaContext()

  // Publish live page data for XIA — ALL campaigns with full details
  useEffect(() => {
    setPageContext({
      page: 'campaigns',
      page_label: 'Campaign List',
      summary: `User is viewing ${campaigns.length} campaigns. Filters: location=${selectedBrand}, status=${selectedStatus}, search="${searchQuery}".`,
      data: {
        total_campaigns: campaigns.length,
        filter_location: selectedBrand,
        filter_status: selectedStatus,
        search_query: searchQuery,
        campaigns: campaigns.map(c => ({
          name: c.campaign_name,
          status: c.status,
          id: c.campaign_id,
          city: c.city || c.location,
          budget: c.total_budget || c.budget,
          start_date: c.start_date,
          end_date: c.end_date,
          screens_count: c.screens_count || c.total_screens,
          created_at: c.created_at,
        })),
      }
    })
    return () => setPageContext(null)
  }, [campaigns, selectedBrand, selectedStatus, searchQuery])

  // Delete campaign handler
  const handleDeleteCampaign = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const token = localStorage.getItem('token')
      const apiUrl = import.meta.env.DEV
        ? `/api/studio/campaign/${deleteTarget.campaignId}/delete/`
        : `${API_BASE_URL}/api/studio/campaign/${deleteTarget.campaignId}/delete/`

      await axios.delete(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      // Remove from local state
      setCampaigns(prev => prev.filter(c => c.campaign_id !== deleteTarget.campaignId))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting campaign:', err)
      alert('Failed to delete campaign. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  // Fetch campaigns from API
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')

        if (!token) {
          setCampaigns([])
          setLoading(false)
          return
        }

        const apiUrl = import.meta.env.DEV
          ? `/api/studio/campaign/`
          : `${API_BASE_URL}/api/studio/campaign/`

        try {
          const response = await axios.get(apiUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params: {
              page: 1,
              page_size: 100 // Get all campaigns
            }
          })

          // Handle paginated response
          const campaignsData = response.data.results || response.data.data || response.data || []

          setCampaigns(campaignsData)
          setError(null)
        } catch (apiError) {
          console.error('API call failed:', apiError)
          setCampaigns([])
          setError('Failed to load campaigns.')
        }

      } catch (err) {
        console.error('Error fetching campaigns:', err)
        setCampaigns([])
      } finally {
        setLoading(false)
      }
    }

    fetchCampaigns()
  }, [])

  // Map API status to UI status
  const mapStatus = (apiStatus) => {
    const statusMap = {
      'active': 'Active',
      'live': 'Active',
      'pending': 'Draft',
      'completed': 'Completed',
      'paused': 'Paused',
      'draft': 'Draft'
    }
    return statusMap[apiStatus?.toLowerCase()] || 'Draft'
  }

  // Get status badge with professional neutral colors matching image
  const getStatusBadge = (status) => {
    const uiStatus = mapStatus(status)

    // Status styles matching the image
    let badgeClass = ''
    let style = {}

    switch (uiStatus) {
      case 'Active':
        style = { backgroundColor: '#ECFDF5', color: '#10B981', border: 'none' } // Light Green
        break
      case 'Draft':
        style = { backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none' } // Light Grey
        break
      case 'Completed':
        style = { backgroundColor: '#EFF6FF', color: '#3B82F6', border: 'none' } // Light Blue
        break
      case 'Paused':
        style = { backgroundColor: '#ZZ7ED9', color: '#F97316', border: 'none', backgroundColor: '#FFF7ED' } // Light Orange
        break
      default:
        style = { backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none' }
    }

    return (
      <span
        className="status-badge"
        style={{ ...style, fontFamily: "'Poppins', sans-serif" }}
      >
        {uiStatus}
      </span>
    )
  }

  // Format date range - "Jun 1 - Aug 31" format
  const formatDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return 'N/A'
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}`
  }

  // Format currency - "₹12,500" format
  const formatCurrency = (amount) => {
    // Check if amount is undefined or null, allow 0
    if (amount === undefined || amount === null) return '₹0'
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  // Get unique locations from campaigns
  const uniqueBrands = ['All Locations', ...new Set(campaigns.map(c => c.location || 'Unknown').filter(Boolean))]

  // Process campaigns for display
  const processedCampaigns = campaigns.map(campaign => {
    const bookedScreens = campaign.booked_screens || {}
    const screensCount = Object.keys(bookedScreens).length

    return {
      id: campaign.campaign_id,
      name: campaign.campaign_name || 'Unnamed Campaign',
      brand: campaign.location || 'Unknown',
      status: campaign.status || 'draft',
      budgetTotal: parseFloat(campaign.total_budget || 0),
      budgetUsed: 0, // No spend tracking yet
      screens: screensCount,
      duration: formatDateRange(campaign.start_date, campaign.end_date),
      campaignId: campaign.campaign_id,
      // Raw fields for draft → campaign-bundle navigation
      rawBookedScreens: bookedScreens,
      rawPriceSnapshot: campaign.price_snapshot || {},
      rawStartDate: campaign.start_date,
      rawEndDate: campaign.end_date,
      rawBudgetRange: parseFloat(campaign.budget_range || campaign.total_budget || 50000),
    }
  })

  // Filter campaigns based on search, brand, and status
  const filteredCampaigns = processedCampaigns.filter(campaign => {
    const matchesSearch = searchQuery === '' ||
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.id.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.brand.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesBrand = selectedBrand === 'All Locations' || campaign.brand === selectedBrand
    const matchesStatus = selectedStatus === 'All Status' || mapStatus(campaign.status) === selectedStatus

    return matchesSearch && matchesBrand && matchesStatus
  })

  return (
    <div className="app-container">
      <Header />

      <div className="dashboard-layout-wrapper">
        <div className="dashboard-main-container">
          {/* Main Content */}
          <Container fluid className="campaigns-main-content">
            {/* Header Section */}
            <div className="mb-2">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="campaigns-page-title">Campaigns</h2>
                  <p className="campaigns-page-subtitle">{campaigns.length > 0 ? `Manage ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} across all your brands.` : 'Create and manage your advertising campaigns.'}</p>
                </div>
                <Button
                  className="campaigns-create-btn"
                  onClick={() => {
                    localStorage.removeItem('xigi_campaign_draft')
                    navigate('/create-campaign')
                  }}
                >
                  + Create Campaign
                </Button>
              </div>
            </div>

            {/* Search and Filter Section - Single Box Design */}
            <div className="campaigns-search-filter-box">
              <div className="d-flex align-items-center flex-grow-1" style={{ maxWidth: '60%' }}>
                <i className="bi bi-search text-muted ms-3"></i>
                <Form.Control
                  type="text"
                  className="border-0 shadow-none bg-transparent ps-3"
                  placeholder="Search campaigns, IDs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontSize: '14px', color: '#4B5563' }}
                />
              </div>

              <div className="d-flex gap-3 pe-2">
                <Dropdown>
                  <Dropdown.Toggle
                    variant="light"
                    id="brand-dropdown"
                    className="campaigns-filter-btn-inline bg-light border text-muted d-flex align-items-center justify-content-between"
                    style={{ minWidth: '140px', fontSize: '14px', fontWeight: '500' }}
                  >
                    {selectedBrand}
                  </Dropdown.Toggle>
                  <Dropdown.Menu align="end">
                    {uniqueBrands.map(brand => (
                      <Dropdown.Item
                        key={brand}
                        onClick={() => setSelectedBrand(brand)}
                        active={selectedBrand === brand}
                      >
                        {brand}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>

                <Dropdown>
                  <Dropdown.Toggle
                    variant="light"
                    id="status-dropdown"
                    className="campaigns-filter-btn-inline bg-light border text-muted d-flex align-items-center justify-content-between"
                    style={{ minWidth: '140px', fontSize: '14px', fontWeight: '500' }}
                  >
                    {selectedStatus}
                  </Dropdown.Toggle>
                  <Dropdown.Menu align="end">
                    <Dropdown.Item onClick={() => setSelectedStatus('All Status')}>All Status</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSelectedStatus('Live')}>Live</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSelectedStatus('Draft')}>Draft</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSelectedStatus('Completed')}>Completed</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSelectedStatus('Paused')}>Paused</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </div>

            {/* Campaigns Table */}
            <div className="campaigns-table-container">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-3 text-muted">Loading campaigns...</p>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="text-center py-5">
                  <p className="text-muted">No campaigns found.</p>
                  <Link to="/create-campaign" className="btn btn-primary mt-3">
                    + Create Campaign
                  </Link>
                </div>
              ) : (
                <Table className="campaigns-table" hover>
                  <thead>
                    <tr>
                      <th className="ps-4">CAMPAIGN</th>
                      <th>LOCATION</th>
                      <th>ID</th>
                      <th>STATUS</th>
                      <th>BUDGET USED</th>
                      <th>SCREENS</th>
                      <th>DURATION</th>
                      <th className="pe-4 text-end">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((campaign) => (
                      <tr key={campaign.campaignId || campaign.id}>
                        <td className="ps-4 campaign-name-cell">{campaign.name}</td>
                        <td className="campaign-brand-cell">{campaign.brand}</td>
                        <td className="campaign-id-cell">{campaign.id}</td>
                        <td className="campaign-status-cell">{getStatusBadge(campaign.status)}</td>
                        <td className="campaign-budget-cell">
                          <span className="budget-used">{formatCurrency(campaign.budgetUsed)}</span>
                          <span className="budget-separator"> / </span>
                          <span className="budget-total">{formatCurrency(campaign.budgetTotal)}</span>
                        </td>
                        <td className="campaign-screens-cell">{campaign.screens}</td>
                        <td className="campaign-duration-cell">{campaign.duration}</td>
                        <td className="pe-4 text-end campaign-action-cell">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="action-btn-view"
                            onClick={() => {
                              const rawStatus = (campaign.status || '').toLowerCase()
                              if (rawStatus === 'draft') {
                                navigate('/campaign-bundle', {
                                  state: {
                                    fromDashboard: true,
                                    campaignName: campaign.name,
                                    campaignId: campaign.campaignId,
                                    bookedScreens: campaign.rawBookedScreens || {},
                                    priceSnapshot: campaign.rawPriceSnapshot || {},
                                    city: campaign.brand,
                                    startDate: campaign.rawStartDate,
                                    endDate: campaign.rawEndDate,
                                    budgetRange: campaign.rawBudgetRange || 50000,
                                  }
                                })
                              } else if (rawStatus === 'active' || rawStatus === 'live') {
                                // Build selectedScreens array from booked_screens keys for ScreenSpecReview
                                const selectedScreens = Object.keys(campaign.rawBookedScreens || {}).map(id => ({
                                  id: Number(id),
                                  name: `Screen ${id}`,
                                  location: campaign.brand,
                                }))
                                navigate('/screen-spec-review', {
                                  state: {
                                    campaignId: campaign.campaignId,
                                    selectedScreens,
                                    slotCount: campaign.rawBookedScreens || {},
                                  }
                                })
                              } else {
                                navigate(`/campaigns/${campaign.campaignId}`)
                              }
                            }}
                          >
                            View
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="ms-2"
                            title="Delete campaign"
                            onClick={() => setDeleteTarget(campaign)}
                            style={{ padding: '4px 8px' }}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </Container>

          {/* Delete Confirmation Modal */}
          <Modal show={!!deleteTarget} onHide={() => !deleting && setDeleteTarget(null)} centered>
            <Modal.Header closeButton style={{ border: 'none', paddingBottom: 0 }}>
              <Modal.Title style={{ fontSize: '18px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                Delete Campaign
              </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px', color: '#4B5563' }}>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone and all associated data will be permanently removed.
            </Modal.Body>
            <Modal.Footer style={{ border: 'none' }}>
              <Button
                variant="light"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ fontSize: '13px', fontWeight: 500 }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteCampaign}
                disabled={deleting}
                style={{ fontSize: '13px', fontWeight: 500 }}
              >
                {deleting ? <><Spinner size="sm" className="me-2" />Deleting...</> : 'Yes, Delete'}
              </Button>
            </Modal.Footer>
          </Modal>
        </div>
      </div>
    </div>
  )
}

export default Campaigns
