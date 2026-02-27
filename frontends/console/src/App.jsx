import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

// Layouts and Components
import Consolelogin from "./pages/Login";
import XigiAdminShell from "./components/XigiAdminShell";

// Pages
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdvertisersBrands from "./pages/AdvertisersBrands";
import PartnerManagement from "./pages/PartnerManagement";
import PartnerRecords from "./pages/PartnerRecords";
import AddPartnerPage from "./pages/AddPartnerPage";
import SystemLogsPage from "./pages/SystemLogsPage";
import UsersRolesPage from "./pages/UsersRolesPage";
import ScreensListPage from "./pages/ScreensListPage";
import ScreenProfiled from "./pages/ScreenProfiled";
import ScreenUnprofiled from "./pages/ScreenUnprofiled";
import ScreenOnboardingPage from "./pages/ScreenOnboardingPage";
import ScreenProfilingPage from "./pages/ScreenProfilingPage";
import CampaignsListPage from "./pages/CampaignsListPage";
import CampaignDetailPage from "./pages/CampaignDetailPage";
import CreativeValidationPage from "./pages/CreativeValidationPage";
import CampaignLivePage from "./pages/CampaignLivePage";
import PlaybackMonitoringPage from "./pages/PlaybackMonitoringPage";
import DisputesListPage from "./pages/DisputesListPage";
import CmsSyncMonitor from "./pages/CmsSyncMonitor";
import CmsPayloadInspector from "./pages/CmsPayloadInspector";
import ScreenSyncTimeline from "./pages/ScreenSyncTimeline";
import CampaignIntelligenceDashboard from "./pages/CampaignIntelligenceDashboard";
import TicketsPage from "./pages/TicketsPage";
import IncidentLogPage from "./pages/IncidentLogPage";
import NotificationsPage from "./pages/NotificationsPage";

function App() {
    return (
        <Router>
            <Routes>
                {/* 🔐 Authentication Pages */}
                <Route path="/" element={<Consolelogin />} />
                <Route path="/console-login" element={<Consolelogin />} />

                {/* Console Routes with Layout (Header + Sidebar, No Footer) */}
                <Route path="/console" element={<XigiAdminShell />}>
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route path="hub" element={<div className="p-8 text-center">Console Hub (Placeholder)</div>} />
                    <Route path="advertisers-brands" element={<AdvertisersBrands />} />
                    <Route path="partner-management" element={<PartnerManagement />} />
                    <Route path="partner-records" element={<PartnerRecords />} />
                    <Route path="partner-records/add" element={<AddPartnerPage />} />
                    <Route path="partner-records/edit/:id" element={<AddPartnerPage />} />
                    <Route path="system-logs" element={<SystemLogsPage />} />
                    <Route path="users-roles" element={<UsersRolesPage />} />
                    <Route path="screens" element={<ScreensListPage />} />
                    <Route path="screens/onboard" element={<ScreenOnboardingPage />} />
                    <Route path="screens/unprofiled/:id" element={<ScreenUnprofiled />} />
                    <Route path="screens/profiled/:id" element={<ScreenProfiled />} />
                    <Route path="campaigns" element={<CampaignsListPage />} />
                    <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
                    <Route path="profiling" element={<ScreenProfilingPage />} />
                    <Route path="creative-validation" element={<CreativeValidationPage />} />
                    <Route path="campaign-live" element={<CampaignLivePage />} />
                    <Route path="monitoring" element={<PlaybackMonitoringPage />} />
                    <Route path="disputes" element={<DisputesListPage />} />
                    <Route path="tickets" element={<TicketsPage />} />
                    <Route path="incidents" element={<IncidentLogPage />} />
                    <Route path="campaign-intelligence" element={<CampaignIntelligenceDashboard />} />

                    {/* Placeholders */}
                    <Route path="heatmap" element={<div className="p-8">Heatmap Module</div>} />
                    <Route path="ab-testing" element={<div className="p-8">A/B Testing Module</div>} />
                    <Route path="playback-confidence" element={<div className="p-8">Playback Confidence Module</div>} />
                    <Route path="partner-analytics" element={<div className="p-8">Partner Analytics Module</div>} />
                    <Route path="cms-sync" element={<CmsSyncMonitor />} />
                    <Route path="payload-inspector" element={<CmsPayloadInspector />} />
                    <Route path="sync-timeline" element={<ScreenSyncTimeline />} />
                    <Route path="ai-insights" element={<div className="p-8">AI Insights Module</div>} />
                    <Route path="diagnostics" element={<div className="p-8">AI Diagnostics Module</div>} />
                    <Route path="events" element={<div className="p-8">Events & Alerts Module</div>} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="settings" element={<div className="p-8">Settings Page</div>} />
                </Route>

                <Route path="*" element={<h1>404 - Page Not Found</h1>} />
            </Routes>
        </Router>
    );
}

export default App;
