import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/dashboard-active-user.css';

const ActiveUserDashboard = ({ userName, campaigns = [], onExploreClick }) => {
    // Compute live metrics from campaigns
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const totalBudget = campaigns.reduce((sum, c) => sum + (parseFloat(c.total_budget) || 0), 0);
    const totalScreens = campaigns.reduce((sum, c) => {
        const screens = c.booked_screens || {};
        return sum + Object.keys(screens).length;
    }, 0);

    const formatBudget = (val) => {
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
        return `₹${val.toFixed(0)}`;
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'active': return 'au-status-live';
            case 'draft': return 'au-status-draft';
            case 'completed': return 'au-status-completed';
            case 'cancelled': return 'au-status-cancelled';
            default: return 'au-status-scheduled';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'active': return 'Active';
            case 'draft': return 'Draft';
            case 'completed': return 'Completed';
            case 'cancelled': return 'Cancelled';
            default: return status;
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="active-user-dashboard">
            {/* Header */}
            <div className="au-header-section">
                <h1 className="au-hero-title">Welcome back, {userName}.</h1>
                <div className="au-hero-subtitle">
                    Dashboard Intelligence
                </div>
            </div>

            {/* Top Cards Row */}
            <div className="au-top-cards-row">
                {/* XIA Intelligence Card */}
                <div className="au-card-intelligence">
                    <div>
                        <div className="au-icon-square">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0000FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                        </div>
                        <h3 className="au-card-title">XIA Intelligence</h3>
                        <p className="au-card-desc">
                            {activeCampaigns > 0
                                ? `You have ${activeCampaigns} active campaign${activeCampaigns > 1 ? 's' : ''} running across ${totalScreens} screen${totalScreens !== 1 ? 's' : ''}.`
                                : 'Start a new campaign to get personalized insights from XIA.'}
                        </p>
                    </div>
                    <a
                        href="#"
                        className="au-link-btn"
                        onClick={(e) => {
                            e.preventDefault();
                            onExploreClick();
                        }}
                    >
                        Explore availability →
                    </a>
                </div>

                {/* Launch Campaign Card */}
                <div className="au-card-launch">
                    <div>
                        <div className="au-icon-square dark-bg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 19 2 12 11 5 11 19"></polygon>
                                <polygon points="22 19 13 12 22 5 22 19"></polygon>
                            </svg>
                        </div>
                        <h3 className="au-card-title">Launch a new campaign?</h3>
                        <p className="au-card-desc">
                            Go live in under 60 seconds with XIA.
                        </p>
                    </div>
                    <button
                        className="au-primary-btn"
                        onClick={() => {
                            localStorage.removeItem('xigi_campaign_draft');
                            window.location.href = '/create-campaign';
                        }}
                    >Start new campaign</button>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="au-metrics-row">
                <div className="au-metric-card">
                    <div className="au-metric-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0000FF" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                        Campaigns
                    </div>
                    <div className="au-metric-value">
                        {totalCampaigns} <span className="au-metric-subtext">Total</span>
                    </div>
                </div>

                <div className="au-metric-card">
                    <div className="au-metric-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34A853" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        Active
                    </div>
                    <div className="au-metric-value">
                        {activeCampaigns} <span className="au-metric-subtext">Live Now</span>
                    </div>
                </div>

                <div className="au-metric-card">
                    <div className="au-metric-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        Budget
                    </div>
                    <div className="au-metric-value">
                        {formatBudget(totalBudget)} <span className="au-metric-subtext">Total Spend</span>
                    </div>
                </div>

                <div className="au-metric-card">
                    <div className="au-metric-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        Screens
                    </div>
                    <div className="au-metric-value">
                        {totalScreens} <span className="au-metric-subtext">Booked</span>
                    </div>
                </div>
            </div>

            {/* Main Grid: Recent Campaigns & Alerts */}
            <div className="au-main-content-grid">
                {/* Recent Campaigns */}
                <div className="au-section-card">
                    <div className="au-section-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0000FF" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        <h3 className="au-section-title">Your Campaigns</h3>
                    </div>

                    {campaigns.length === 0 ? (
                        <div className="au-empty-state">
                            <p>No campaigns yet. Start your first campaign to see it here.</p>
                            <Link to="/create-campaign" className="au-primary-btn">Create Campaign</Link>
                        </div>
                    ) : (
                        campaigns.map((campaign) => (
                            <div className="au-campaign-item" key={campaign.campaign_id}>
                                <div className="au-campaign-info">
                                    <h4>
                                        {campaign.campaign_name}
                                        <span className={`au-status-badge ${getStatusClass(campaign.status)}`}>
                                            {getStatusLabel(campaign.status)}
                                        </span>
                                    </h4>
                                    <p>
                                        {campaign.location}
                                        {campaign.start_date && ` • ${formatDate(campaign.start_date)} – ${formatDate(campaign.end_date)}`}
                                        {` • ${Object.keys(campaign.booked_screens || {}).length} screen${Object.keys(campaign.booked_screens || {}).length !== 1 ? 's' : ''}`}
                                        {campaign.total_budget > 0 && ` • ${formatBudget(parseFloat(campaign.total_budget))}`}
                                    </p>
                                </div>
                                {(() => {
                                    const s = (campaign.status || '').toLowerCase()
                                    if (s === 'active' || s === 'live') {
                                        const screens = Object.keys(campaign.booked_screens || {}).map(id => ({
                                            id: Number(id),
                                            name: `Screen ${id}`,
                                            location: campaign.location,
                                        }))
                                        return (
                                            <Link
                                                to="/screen-spec-review"
                                                state={{
                                                    campaignId: campaign.campaign_id,
                                                    selectedScreens: screens,
                                                    slotCount: campaign.booked_screens || {},
                                                }}
                                                className="au-view-link"
                                            >View ›</Link>
                                        )
                                    }
                                    return <Link to={`/campaigns/${campaign.campaign_id}`} className="au-view-link">View ›</Link>
                                })()}
                            </div>
                        ))
                    )}
                </div>

                {/* Operational Alerts */}
                <div className="au-section-card au-alerts-card">
                    <div className="au-section-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <h3 className="au-section-title au-alert-header-text">Operational Alerts</h3>
                    </div>

                    {activeCampaigns > 0 ? (
                        <>
                            <div className="au-alert-item">
                                <div className="au-alert-content">
                                    <h5>Upload creatives for your active campaigns</h5>
                                    <p>action needed</p>
                                </div>
                                <div className="au-alert-action">Upload Now ›</div>
                            </div>
                            <div className="au-alert-item">
                                <div className="au-alert-content">
                                    <h5>Schedule your campaigns to go live</h5>
                                    <p>pending</p>
                                </div>
                                <div className="au-alert-action">Schedule ›</div>
                            </div>
                        </>
                    ) : (
                        <div className="au-alert-item">
                            <div className="au-alert-content">
                                <h5>No active alerts</h5>
                                <p>All clear — start a campaign to see operational alerts here.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActiveUserDashboard;
