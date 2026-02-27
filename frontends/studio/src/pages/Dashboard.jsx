import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Container, Card, Row, Col, Button, Table, Dropdown, Badge } from 'react-bootstrap'
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '../styles/dashboard.css'
import NewUserDashboard from '../components/Dashboard/NewUserDashboard'
import ActiveUserDashboard from '../components/Dashboard/ActiveUserDashboard'
import XiaAssistant from '../components/XiaAssistant'
import '../styles/xia-assistant.css'
import Header from '../components/Header'
import axios from 'axios'
import { API_BASE_URL } from '../config'
import { Spinner } from 'react-bootstrap'
import { useXiaContext } from '../context/XiaContext'

function Dashboard() {
  const navigate = useNavigate()
  const [selectedBrand, setSelectedBrand] = useState('All Brands')
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [graphFilter, setGraphFilter] = useState('Campaign') // Campaign, Location, Creative (Campaign is default for dropdown)
  const [graphDataFiltered, setGraphDataFiltered] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState('All Campaigns')
  const [campaignsList, setCampaignsList] = useState([])
  const [selectedScreen, setSelectedScreen] = useState('All Screens')
  const [screensList, setScreensList] = useState([])
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false);
  const [myCampaigns, setMyCampaigns] = useState([])
  const { setPageContext } = useXiaContext()

  // Publish live page data for XIA — complete dashboard data
  useEffect(() => {
    setPageContext({
      page: 'dashboard',
      page_label: 'Dashboard',
      summary: `User ${localStorage.getItem('userName') || 'User'} is on the dashboard. ${myCampaigns.length} campaigns, ${dashboardData?.total_active_screens || 0} active screens, ₹${dashboardData?.total_spend || 0} total spend.`,
      data: {
        user: localStorage.getItem('userName') || 'User',
        stats: dashboardData ? {
          total_booked_campaigns: dashboardData.total_booked_campaigns,
          total_spend: dashboardData.total_spend,
          active_screens: dashboardData.total_active_screens,
          active_campaigns: dashboardData.total_active_campaigns,
          total_impressions: dashboardData.total_impressions,
          total_reach: dashboardData.total_reach,
        } : null,
        campaigns: myCampaigns.map(c => ({
          name: c.campaign_name,
          status: c.status,
          id: c.campaign_id,
          city: c.city || c.location,
          budget: c.total_budget || c.budget,
          start_date: c.start_date,
          end_date: c.end_date,
          screens_count: c.screens_count || c.total_screens,
        })),
        graph_filter: graphFilter,
        selected_campaign_filter: selectedCampaign,
        selected_screen_filter: selectedScreen,
      }
    })
    return () => setPageContext(null)
  }, [dashboardData, myCampaigns, graphFilter, selectedCampaign, selectedScreen])

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await axios.get('/api/studio/dashboard/overview/', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.data && response.data.status === 'success') {
          setDashboardData(response.data.data)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  // Fetch user's campaigns from the Campaign table
  useEffect(() => {
    const fetchMyCampaigns = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await axios.get('/api/studio/campaign/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.data?.status === 'success') {
          setMyCampaigns(res.data.data || [])
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err)
      }
    }
    fetchMyCampaigns()
  }, [])

  // Use campaigns list from dashboard API
  useEffect(() => {
    if (dashboardData && dashboardData.campaigns_list) {
      const campaigns = dashboardData.campaigns_list || []
      setCampaignsList(campaigns)

      // Initialize to "All Campaigns" if not set
      if (selectedCampaign === 'Campaign' || !selectedCampaign) {
        setSelectedCampaign('All Campaigns')
      }

      // Only reset if current selection is invalid
      if (campaigns.length > 0 && selectedCampaign !== 'All Campaigns') {
        const isValid = campaigns.find(c => c.campaign_id == selectedCampaign)
        if (!isValid) {
          // Reset to "All Campaigns" if selected campaign no longer exists
          setSelectedCampaign('All Campaigns')
        }
      }
    }

    // Use screens list from dashboard API
    if (dashboardData && dashboardData.screens_list) {
      const screens = dashboardData.screens_list || []
      setScreensList(screens)

      // Initialize to "All Screens" if not set
      if (selectedScreen === 'Screen' || !selectedScreen) {
        setSelectedScreen('All Screens')
      }
    }
  }, [dashboardData])

  // Use graph data from backend based on selected campaign or screen
  useEffect(() => {
    if (graphFilter === 'Location') {
      // Handle Location filter - show screens
      if (!dashboardData || screensList.length === 0) {
        // Show empty graph if no data
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        setGraphDataFiltered(days.map(day => ({ day, value: 0 })))
        return
      }

      // Use graph_data from screens_list
      if (selectedScreen === 'All Screens' || !selectedScreen || selectedScreen === 'Screen') {
        // Calculate sum of all screens' graph_data for "All Screens"
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const allScreensGraphData = days.map(day => {
          const totalValue = screensList.reduce((sum, screen) => {
            const dayData = screen.graph_data?.find(d => d.day === day)
            return sum + (dayData?.value || 0)
          }, 0)
          return { day, value: totalValue }
        })
        setGraphDataFiltered(allScreensGraphData)
      } else {
        // Get graph_data from selected screen in screens_list
        const selectedScreenObj = screensList.find(s => s.screen_id == selectedScreen)

        if (selectedScreenObj && selectedScreenObj.graph_data) {
          setGraphDataFiltered(selectedScreenObj.graph_data)
        } else {
          // Fallback to sum of all screens if screen not found
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          const allScreensGraphData = days.map(day => {
            const totalValue = screensList.reduce((sum, screen) => {
              const dayData = screen.graph_data?.find(d => d.day === day)
              return sum + (dayData?.value || 0)
            }, 0)
            return { day, value: totalValue }
          })
          setGraphDataFiltered(allScreensGraphData)
        }
      }
      return
    }

    if (graphFilter !== 'Campaign') {
      // Use default dashboard data for other filters
      if (dashboardData && dashboardData.graph_data) {
        setGraphDataFiltered(dashboardData.graph_data)
      }
      return
    }

    if (!dashboardData || campaignsList.length === 0) {
      // Show empty graph if no data
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      setGraphDataFiltered(days.map(day => ({ day, value: 0 })))
      return
    }

    // Use graph_data from campaigns_list
    if (selectedCampaign === 'All Campaigns' || !selectedCampaign || selectedCampaign === 'Campaign') {
      // Calculate sum of all campaigns' graph_data for "All Campaigns"
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const allCampaignsGraphData = days.map(day => {
        const totalValue = campaignsList.reduce((sum, campaign) => {
          const dayData = campaign.graph_data?.find(d => d.day === day)
          return sum + (dayData?.value || 0)
        }, 0)
        return { day, value: totalValue }
      })
      setGraphDataFiltered(allCampaignsGraphData)
    } else {
      // Get graph_data from selected campaign in campaigns_list
      const selectedCampaignObj = campaignsList.find(c => c.campaign_id == selectedCampaign)

      if (selectedCampaignObj && selectedCampaignObj.graph_data) {
        setGraphDataFiltered(selectedCampaignObj.graph_data)
      } else {
        // Fallback to sum of all campaigns if campaign not found
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const allCampaignsGraphData = days.map(day => {
          const totalValue = campaignsList.reduce((sum, campaign) => {
            const dayData = campaign.graph_data?.find(d => d.day === day)
            return sum + (dayData?.value || 0)
          }, 0)
          return { day, value: totalValue }
        })
        setGraphDataFiltered(allCampaignsGraphData)
      }
    }
  }, [selectedCampaign, selectedScreen, graphFilter, dashboardData, campaignsList, screensList])

  // Use API data or fallback to defaults
  const userName = (dashboardData?.user_name && dashboardData.user_name.trim())
    ? dashboardData.user_name
    : (dashboardData?.full_name && dashboardData.full_name.trim())
      ? dashboardData.full_name
      : (localStorage.getItem('userName') || 'Guest')

  console.log('Dashboard Data:', dashboardData);
  console.log('Calculated UserName:', userName);

  const runningCampaigns = dashboardData?.running_campaigns_count || 0
  const metrics = dashboardData?.metrics || { live: 0, spend: '₹0', screens: 0, alerts: 0 }
  const graphData = graphDataFiltered.length > 0 ? graphDataFiltered : (dashboardData?.graph_data || [])
  const recentCampaigns = dashboardData?.recent_campaigns || []
  const topScreens = dashboardData?.top_screens || []
  const topCampaigns = dashboardData?.top_campaigns || []

  const getStatusBadge = (status) => {
    const variants = {
      'Live': 'success',
      'Draft': 'secondary',
      'Scheduled': 'warning',
      'Completed': 'info',
      'Paused': 'warning',
      'Cancelled': 'danger'
    }
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>
  }

  const deleteCampaign = async (e, campaignId) => {
    e.stopPropagation()
    if (!window.confirm('Delete this campaign?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`/api/studio/campaign/${campaignId}/delete/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setMyCampaigns(prev => prev.filter(c => c.campaign_id !== campaignId))
    } catch (err) {
      console.error('Error deleting campaign:', err)
      alert('Failed to delete campaign')
    }
  }

  return (
    <div className="app-container">
      <Header onAskXiaClick={() => setShowAssistant(!showAssistant)} />

      {/* Dashboard Layout Wrapper - Handles Scroll & Sidebar */}
      <div className="dashboard-layout-wrapper">
        {/* Main Content Area - Scrollable */}
        <div className={`dashboard-main-container ${showAssistant ? 'with-sidebar' : ''}`}>
          <Container fluid className="main-content">
            {loading ? (
              <div className="d-flex justify-content-center align-items-center" style={{ height: 'calc(100vh - 112px)' }}>
                <Spinner animation="border" variant="primary" />
              </div>
            ) : !dashboardData || dashboardData.campaigns_list?.length === 0 ? (
              <NewUserDashboard
                userName={userName}
                onExploreClick={() => setShowAssistant(true)}
              />
            ) : (
              <ActiveUserDashboard
                userName={userName}
                dashboardData={dashboardData}
                selectedBrand={selectedBrand}
                setSelectedBrand={setSelectedBrand}
                graphFilter={graphFilter}
                setGraphFilter={setGraphFilter}
                campaignsList={campaignsList}
                selectedCampaign={selectedCampaign}
                setSelectedCampaign={setSelectedCampaign}
                screensList={screensList}
                selectedScreen={selectedScreen}
                setSelectedScreen={setSelectedScreen}
                loadingGraph={loadingGraph}
                graphData={graphData}
                recentCampaigns={recentCampaigns}
                topScreens={topScreens}
                topCampaigns={topCampaigns}
                metrics={metrics}
                getStatusBadge={getStatusBadge}
                onExploreClick={() => setShowAssistant(true)}
              />
            )}


          </Container>
        </div>

        {/* Assistant Sidebar */}
        {showAssistant && <XiaAssistant onClose={() => setShowAssistant(false)} />}
      </div>
    </div>
  )
}

export default Dashboard

