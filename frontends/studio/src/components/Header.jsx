import { Navbar, Nav, Container, Dropdown } from 'react-bootstrap'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '../styles/dashboard.css'
import XiaAssistant from './XiaAssistant'
import { XIA_DISABLED_PAGES } from '../context/XiaContext'

function Header({ onAskXiaClick }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userPhone, setUserPhone] = useState('')
  const [orgType, setOrgType] = useState('')
  const [dashboardPath, setDashboardPath] = useState('/dashboard')
  const [showXia, setShowXia] = useState(false)

  // Disable XIA on billing/payment pages
  const isXiaDisabled = XIA_DISABLED_PAGES.some(p => location.pathname.startsWith(p))

  const handleXiaClick = () => {
    if (onAskXiaClick) {
      onAskXiaClick()
    } else {
      setShowXia(!showXia)
    }
  }

  useEffect(() => {
    setUserName(localStorage.getItem('userName') || 'User')
    setUserEmail(localStorage.getItem('userEmail') || 'user@xigi.com')

    const storedPhone = localStorage.getItem('userPhone')
    if (storedPhone) {
      const formattedPhone = storedPhone.startsWith('+91') ? storedPhone : `+91 ${storedPhone}`
      setUserPhone(formattedPhone)
    } else {
      setUserPhone('No Phone Provided')
    }

    setOrgType(localStorage.getItem('orgType') || 'Advertiser')

    // Check if user has active campaigns → set dashboard path
    const token = localStorage.getItem('token')
    if (token) {
      axios.get('/api/studio/campaign/', { headers: { 'Authorization': `Bearer ${token}` }, _skipAuthRedirect: true })
        .then(res => {
          const campaigns = res.data?.data || []
          const hasActive = campaigns.some(c => c.status === 'active')
          setDashboardPath(hasActive ? '/active-dashboard-demo' : '/dashboard')
        })
        .catch(() => { })
    }
  }, [])

  const handleLogout = () => {
    // Clear all user-specific data to prevent cross-user contamination
    localStorage.removeItem('token')
    localStorage.removeItem('userName')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userId')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userPhone')
    localStorage.removeItem('orgType')
    localStorage.removeItem('xigi_campaign_draft')
    // Clear any deletedAssets_* keys
    Object.keys(localStorage)
      .filter(k => k.startsWith('deletedAssets_'))
      .forEach(k => localStorage.removeItem(k))
    // Clear all sessionStorage (holds, proposal/bundle sessions)
    sessionStorage.clear()
    navigate('/login')
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name[0].toUpperCase()
  }

  return (
    <Navbar expand="lg" className="header-navbar fixed-top">
      <Container fluid className="px-4">
        <Navbar.Brand className="d-flex align-items-center navbar-brand-custom" as={Link} to={dashboardPath}>
          <img src="/assets/logo1.png" alt="Xigi" className="header-logo-img" style={{ height: '40px', width: 'auto' }} />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-center">
          <Nav className="nav-pills-container">
            <Nav.Link
              as={Link}
              to={dashboardPath}
              className={location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/active-dashboard-demo' ? 'nav-pill nav-pill-active' : 'nav-pill'}
            >
              Dashboard
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/campaigns"
              onClick={() => localStorage.removeItem('xigi_campaign_draft')}
              className={
                location.pathname === '/campaigns'
                  ? 'nav-pill nav-pill-active'
                  : 'nav-pill'
              }
            >
              Campaign
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/billing"
              className={location.pathname === '/billing' || location.pathname === '/invoices' ? 'nav-pill nav-pill-active' : 'nav-pill'}
            >
              Billing
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
        <Nav className="d-flex align-items-center navbar-icons-right gap-3">
          <div className="d-flex align-items-center gap-2">

            {/* Ask XIA Button — hidden on billing/payment pages */}
            {!isXiaDisabled && (
              <button className="ask-xia-btn" onClick={handleXiaClick}>
                <i className="bi bi-stars"></i>
                Ask XIA
              </button>
            )}

            <Nav.Link className="icon-link position-relative ms-2">
              <i className="bi bi-bell"></i>
              <span className="notification-dot"></span>
            </Nav.Link>

            <div className="nav-separator"></div>

            <Dropdown align="end">
              <Dropdown.Toggle as="div" className="user-profile-dropdown-toggle">
                <div className="user-initials-circle">
                  {getInitials(userName)}
                </div>
                <i className="bi bi-chevron-down ms-1" style={{ fontSize: '0.75rem', color: '#6B7280' }}></i>
              </Dropdown.Toggle>

              <Dropdown.Menu className="user-profile-dropdown-menu shadow-sm">
                <div className="dropdown-profile-header">
                  <div className="profile-info-grid">
                    <div className="profile-avatar-wrapper">
                      <div className="profile-avatar-large">
                        {getInitials(userName)}
                      </div>
                      <div className="avatar-status-dot"></div>
                    </div>
                    <div className="profile-text-details">
                      <div className="profile-name">{userName}</div>
                      <div className="profile-org-badge">{orgType}</div>
                    </div>
                  </div>

                  <div className="profile-contact-card">
                    <div className="contact-row">
                      <div className="contact-icon-box email-bg">
                        <i className="bi bi-envelope-fill"></i>
                      </div>
                      <div className="contact-text">
                        <span className="contact-label">Email</span>
                        <span className="contact-value">{userEmail}</span>
                      </div>
                    </div>
                    <div className="contact-row">
                      <div className="contact-icon-box phone-bg">
                        <i className="bi bi-telephone-fill"></i>
                      </div>
                      <div className="contact-text">
                        <span className="contact-label">Phone</span>
                        <span className="contact-value">{userPhone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dropdown-divider-premium"></div>

                <div className="dropdown-actions-area">
                  <Dropdown.Item onClick={handleLogout} className="dropdown-logout-premium">
                    <i className="bi bi-box-arrow-right"></i>
                    <span>Sign Out</span>
                  </Dropdown.Item>
                </div>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Nav>
      </Container>
      {showXia && (
        <div style={{ position: 'fixed', top: '84px', right: 0, bottom: 0, zIndex: 1050, height: 'calc(100vh - 84px)' }}>
          <XiaAssistant onClose={() => setShowXia(false)} />
        </div>
      )}
    </Navbar>
  )
}

export default Header

