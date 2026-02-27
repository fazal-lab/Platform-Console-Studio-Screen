import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import CreateCampaign from './pages/CreateCampaign'
import CampaignBundle from './pages/CampaignBundle'
import ProposalReview from './pages/ProposalReview'
import PaymentCheckout from './pages/PaymentCheckout'
import Invoices from './pages/Invoices'
import ScreenSpecReview from './pages/ScreenSpecReview'
import CreativeManifestBuilder from './pages/CreativeManifestBuilder'
import ScreenBundlePage from './pages/ScreenBundlePage'
import CampaignDetail from './pages/CampaignDetail'
import CampaignReport from './pages/CampaignReport'
import CampaignMonitor from './pages/CampaignMonitor'
import { Container } from 'react-bootstrap'

// 🧩 Home Page Components
import NavBarComponent from "./components/Home/Navbar";
import Home from "./components/Home";
import Contact from "./components/Home/Contact";
import FooterSection from "./components/Home/footer";

// 🔐 Auth Pages
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import ForgotPassword from "./components/Auth/ForgotPassword";
import VerifyCode from "./components/Auth/VerifyCode";
import ResetPassword from "./components/Auth/ResetPassword";
import OrganizationSetup from "./components/Auth/OrganizationSetup";
import ActiveUserDashboard from "./components/Dashboard/ActiveUserDashboard";
import Header from "./components/Header";
import XiaAssistant from "./components/XiaAssistant";
import { XiaContextProvider } from './context/XiaContext';
import './styles/xia-assistant.css';

// Demo Component Wrapper to handle Assistant State
const DemoActiveDashboard = () => {
  const [showAssistant, setShowAssistant] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const userName = localStorage.getItem('userName') || 'User';
  const { setPageContext } = useXiaContext();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get('/api/studio/campaign/', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => setCampaigns(res.data?.data || []))
        .catch(() => { });
    }
  }, []);

  // Publish page context for XIA — full campaign data
  useEffect(() => {
    setPageContext({
      page: 'dashboard',
      page_label: 'Dashboard',
      summary: `User ${userName} is on the active dashboard. ${campaigns.length} campaigns.`,
      data: {
        user: userName,
        total_campaigns: campaigns.length,
        active_campaigns: campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'active').length,
        campaigns: campaigns.map(c => ({
          name: c.campaign_name,
          status: c.status,
          id: c.campaign_id,
          city: c.city || c.location,
          budget: c.total_budget || c.budget,
          start_date: c.start_date,
          end_date: c.end_date,
          screens_count: c.screens_count || c.total_screens,
        })),
      }
    })
    return () => setPageContext(null)
  }, [campaigns, userName])

  return (
    <div className="app-container">
      <Header onAskXiaClick={() => setShowAssistant(!showAssistant)} />

      <div className="dashboard-layout-wrapper">
        <div className={`dashboard-main-container ${showAssistant ? 'with-sidebar' : ''}`}>
          <Container fluid className="main-content">
            <ActiveUserDashboard
              userName={userName}
              campaigns={campaigns}
              onExploreClick={() => setShowAssistant(true)}
            />
          </Container>
        </div>

        {/* Assistant Sidebar */}
        {showAssistant && <XiaAssistant onClose={() => setShowAssistant(false)} />}
      </div>
    </div>
  );
};

function AppWrapper() {
  const location = useLocation();

  // List of paths where NavBarComponent should NOT appear
  const hideNavbarRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/verify-code',
    '/reset-password',
    '/dashboard',
    '/campaigns',
    '/create-campaign',
    '/campaign-bundle',
    '/proposal-review',
    '/secure-checkout',
    '/billing',
    '/invoices',
    '/organization-setup',
    '/active-dashboard-demo',
    '/screen-spec-review',
    '/creative-manifest-builder',
    '/screen-bundle',
    '/campaigns'
  ];

  // Check if current path should hide navbar
  const shouldHideNav = hideNavbarRoutes.some(route => {
    return location.pathname.startsWith(route);
  });

  return (
    <>
      {/* Show Home Navbar only on home and contact pages */}
      {!shouldHideNav && <NavBarComponent />}

      <Routes>
        {/* 🏠 Homepage - Default Route */}
        <Route
          path="/"
          element={
            <>
              <Home />
              <FooterSection />
            </>
          }
        />

        {/* 🔐 Authentication Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-code" element={<VerifyCode />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/organization-setup" element={<OrganizationSetup />} />

        {/* 🧪 Demo Route for Active Dashboard */}
        <Route path="/active-dashboard-demo" element={<DemoActiveDashboard />} />

        {/* Dashboard and other routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/campaigns/:id/report" element={<CampaignReport />} />
        <Route path="/campaigns/:id/monitor" element={<CampaignMonitor />} />
        <Route path="/create-campaign" element={<CreateCampaign />} />
        <Route path="/campaign-bundle" element={<CampaignBundle />} />
        <Route path="/proposal-review" element={<ProposalReview />} />
        <Route path="/secure-checkout" element={<PaymentCheckout />} />
        <Route path="/billing" element={<Invoices />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/screen-spec-review" element={<ScreenSpecReview />} />
        <Route path="/creative-manifest-builder" element={<CreativeManifestBuilder />} />
        <Route path="/screen-bundle" element={<ScreenBundlePage />} />

        {/* 📄 Static or Misc Pages */}
        <Route
          path="/contact"
          element={
            <>
              <Contact />
              <FooterSection />
            </>
          }
        />
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <XiaContextProvider>
        <AppWrapper />
      </XiaContextProvider>
    </Router>
  );
}

export default App
