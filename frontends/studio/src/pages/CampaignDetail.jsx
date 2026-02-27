import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import XiaAssistant from '../components/XiaAssistant';
import '../styles/campaignDetail.css';
import '../styles/xia-assistant.css';
import { useXiaContext } from '../context/XiaContext';

const CampaignDetail = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [brief, setBrief] = useState(null);
    const [plan, setPlan] = useState(null);
    const [statusData, setStatusData] = useState(null);
    // Auto-open XIA if session_id is in URL (coming from gateway completion)
    const urlSessionId = searchParams.get('session_id');
    const [showXia, setShowXia] = useState(!!urlSessionId);
    const { setPageContext } = useXiaContext();

    // Publish live data for XIA — include full campaign details
    useEffect(() => {
        if (!data) return;
        setPageContext({
            page: 'campaign_detail',
            page_label: 'Campaign Detail',
            summary: `Viewing campaign "${data.campaign_name}". Status: ${data.status}. ID: ${id}. Budget: ₹${data.total_budget || 'N/A'}. ${data.screens?.length || 0} screens.`,
            data: {
                campaign_id: id,
                campaign_name: data.campaign_name,
                status: data.status,
                budget: data.total_budget,
                location: data.location,
                city: data.city,
                start_date: data.start_date,
                end_date: data.end_date,
                screens: data.screens?.map(s => ({
                    name: s.screen_name || s.name,
                    location: s.location || s.city,
                    media_type: s.media_type,
                    slots: s.slot_count || s.slots,
                })) || [],
                brief: brief ? {
                    objective: brief.objective,
                    target_audience: brief.target_audience,
                    content_theme: brief.content_theme,
                } : null,
                plan: plan ? {
                    total_impressions: plan.total_impressions,
                    total_reach: plan.total_reach,
                } : null,
                gate_status: statusData?.gate?.gate_status,
                gate_checks: statusData?.gate?.checks,
            }
        })
        return () => setPageContext(null)
    }, [data, brief, plan, statusData])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const [campRes, briefRes, planRes, statusRes] = await Promise.all([
                    axios.get(`/api/studio/campaign/${id}/`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    axios.get(`/api/studio/campaign/${id}/brief/`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ data: null })),
                    axios.get(`/api/studio/campaign/${id}/plan/`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ data: null })),
                    axios.get(`/api/studio/campaign/${id}/status/`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ data: null }))
                ]);

                setData(campRes.data);
                setBrief(briefRes.data);
                setPlan(planRes.data);
                setStatusData(statusRes.data?.data);
            } catch (err) {
                console.error('Error fetching campaign details:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="campaign-detail-wrapper">
                <Header />
                <div className="campaign-detail-container" style={{ textAlign: 'center', marginTop: '100px' }}>
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <div className="mt-3">Loading campaign performance data...</div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="campaign-detail-wrapper">
                <Header />
                <div className="campaign-detail-container" style={{ textAlign: 'center', marginTop: '50px' }}>
                    <h2>Campaign not found</h2>
                    <p className="text-muted">The requested campaign does not exist or you do not have permission to view it.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/campaigns')}>Back to Campaigns</button>
                </div>
            </div>
        );
    }

    // Map backend data to UI format
    const campaign = {
        name: data.bundle_name || 'Untitled Campaign',
        brand: statusData?.gate?.intent || 'MY BRAND',
        status: (data.status || 'DRAFT').replace(/_/g, ' ').toUpperCase(),
        id: `C-${data.id}`,
        budgetTotal: data.total_budget || 0,
        budgetPacing: 0, // Mock for now
        pacingPercent: 0, // Mock for now
        popSummary: {
            signals: '0',
            desc: 'Hardware-level logs confirming broadcast truth.'
        },
        playbackConfidence: {
            score: '0%',
            desc: 'Aggregate score of network stability and delivery sync.'
        },
        gateInputs: {
            window: statusData?.gate ? `${statusData.gate.start_date} — ${statusData.gate.end_date}` : 'N/A',
            location: statusData?.gate?.location || 'N/A',
            budget: statusData?.gate?.budget_range ? `₹${Number(statusData.gate.budget_range).toLocaleString('en-IN')}` : 'N/A'
        },
        brief: {
            objective: brief?.objective || 'N/A',
            category: brief?.category || 'N/A',
            totalScreens: `${data.total_screens || 0} Nodes`,
            cta: brief?.cta_type || 'N/A'
        },
        clusters: plan?.plan_data?.screens?.map(s => ({
            name: s.name || `Screen ${s.id || s.screen_id || ''}`,
            sub: `${s.city_name || ''} · ${s.district_name || ''}`,
            slot: `Slot x${s.slots || 1}`
        })) || [],
        timeline: [
            { title: 'Gate Cleared', date: statusData?.gate?.gate_status === 'complete' ? 'Completed' : 'Pending', status: statusData?.gate?.gate_status === 'complete' ? 'completed' : 'upcoming' },
            { title: 'Brief Saved', date: statusData?.has_brief ? 'Completed' : 'Pending', status: statusData?.has_brief ? 'completed' : 'upcoming' },
            { title: 'Plan Ready', date: statusData?.has_plan ? 'Completed' : 'Pending', status: statusData?.has_plan ? 'completed' : 'upcoming' },
            { title: 'Proposal Locked', date: statusData?.has_proposal ? 'Completed' : 'Pending', status: statusData?.has_proposal ? 'completed' : 'upcoming' },
            { title: 'Broadcast Live', date: data.status === 'booked' ? 'Live' : 'Pending', status: data.status === 'booked' ? 'active' : 'upcoming' },
        ]
    };

    return (
        <div className="campaign-detail-wrapper">
            <Header onAskXiaClick={() => setShowXia(!showXia)} />

            <div className="dashboard-layout-wrapper" style={{ paddingTop: '84px' }}>
                <div className={`dashboard-main-container`}>
                    <div className="campaign-detail-container">
                        {/* Top Navigation Row */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <button className="back-link border-0 bg-transparent" onClick={() => navigate('/campaigns')}>
                                <i className="bi bi-chevron-left"></i>
                                Back to Campaigns
                            </button>

                            <div className="header-actions">
                                <button className="btn-open-monitor" onClick={() => navigate(`/campaigns/${id}/monitor`)}>
                                    <i className="bi bi-crosshair"></i>
                                    Open Monitor
                                </button>
                                <button className="btn-open-report" onClick={() => navigate(`/campaigns/${id}/report`)}>
                                    <i className="bi bi-bar-chart"></i>
                                    Open Report
                                </button>
                            </div>
                        </div>

                        {/* Main Summary Card */}
                        <div className="campaign-summary-card">
                            <div className="campaign-main-info">
                                <div className="brand-logo-initial">{campaign.brand.charAt(0)}</div>
                                <div className="campaign-title-section">
                                    <h1>{campaign.name}</h1>
                                    <div className="campaign-meta">
                                        <span>{campaign.brand}</span>
                                        <span className="dot">•</span>
                                        <span className={`badge-${campaign.status === 'BOOKED' ? 'live' : 'draft'}`}>{campaign.status}</span>
                                        <span className="dot">•</span>
                                        <span>{campaign.id}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="budget-stats">
                                <div className="stat-item">
                                    <div className="stat-label">BUDGET TOTAL</div>
                                    <div className="stat-value">₹{Number(campaign.budgetTotal).toLocaleString('en-IN')}</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-label">BUDGET PACING</div>
                                    <div className="stat-value blue">₹{campaign.budgetPacing.toLocaleString('en-IN')} <span className="stat-sub">({campaign.pacingPercent}%)</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Grid Layout for Detail Modules */}
                        <div className="campaign-grid">

                            {/* Proof-of-Play area */}
                            <div className="detail-card area-pop">
                                <div className="card-header-with-icon">
                                    <div className="icon-box icon-blue">
                                        <i className="bi bi-shield-check"></i>
                                    </div>
                                    <div className="card-tag tag-gray">VERIFIED POP</div>
                                </div>
                                <h3 className="card-title">Proof-of-Play Summary</h3>
                                <p className="card-subtitle">{campaign.popSummary.desc}</p>
                                <div className="large-value">{campaign.popSummary.signals} <span>SIGNALS</span></div>
                            </div>

                            {/* Playback Confidence area */}
                            <div className="detail-card area-confidence">
                                <div className="card-header-with-icon">
                                    <div className="icon-box icon-orange">
                                        <i className="bi bi-lightning-charge"></i>
                                    </div>
                                    <div className="card-tag tag-green">Excellent</div>
                                </div>
                                <h3 className="card-title">Playback Confidence</h3>
                                <p className="card-subtitle">{campaign.playbackConfidence.desc}</p>
                                <div className="large-value">{campaign.playbackConfidence.score} <span>SCORE</span></div>
                            </div>

                            {/* Gate Inputs Summary area */}
                            <div className="detail-card area-gate">
                                <h3 className="card-title" style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <i className="bi bi-lock me-2"></i> Gate Inputs Summary
                                </h3>

                                <div className="gate-item mt-4">
                                    <div className="gate-icon"><i className="bi bi-calendar3"></i></div>
                                    <div>
                                        <div className="gate-label">WINDOW</div>
                                        <div className="gate-value">{campaign.gateInputs.window}</div>
                                    </div>
                                </div>

                                <div className="gate-item">
                                    <div className="gate-icon"><i className="bi bi-geo-alt"></i></div>
                                    <div>
                                        <div className="gate-label">TARGET LOCATION</div>
                                        <div className="gate-value">{campaign.gateInputs.location}</div>
                                    </div>
                                </div>

                                <div className="gate-item">
                                    <div className="gate-icon"><i className="bi bi-currency-rupee"></i></div>
                                    <div>
                                        <div className="gate-label">BUDGET LOCKED</div>
                                        <div className="gate-value">{campaign.gateInputs.budget}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Brief & Multi-Slot area */}
                            <div className="detail-card area-brief">
                                <div className="brief-header">
                                    <h3 className="card-title" style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <i className="bi bi-grid me-2"></i> Brief & Multi-Slot Plan Summary
                                    </h3>
                                    <button className="view-original-btn">View Original Brief</button>
                                </div>

                                <div className="brief-stats-row">
                                    <div className="brief-stat-block">
                                        <div className="label">OBJECTIVE</div>
                                        <div className="value">{campaign.brief.objective}</div>
                                    </div>
                                    <div className="brief-stat-block">
                                        <div className="label">CATEGORY</div>
                                        <div className="value">{campaign.brief.category}</div>
                                    </div>
                                    <div className="brief-stat-block">
                                        <div className="label">TOTAL SCREENS</div>
                                        <div className="value">{campaign.brief.totalScreens}</div>
                                    </div>
                                    <div className="brief-stat-block">
                                        <div className="label">CTA METHOD</div>
                                        <div className="value">{campaign.brief.cta}</div>
                                    </div>
                                </div>

                                <h3 className="card-title" style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                                    <i className="bi bi-layers me-2"></i> Selected Screen Clusters & Slot Allocation
                                </h3>

                                {campaign.clusters.length > 0 ? campaign.clusters.map((cluster, idx) => (
                                    <div className="cluster-item" key={idx}>
                                        <div className="cluster-icon">
                                            <i className="bi bi-display"></i>
                                        </div>
                                        <div className="cluster-info">
                                            <div className="cluster-name">{cluster.name}</div>
                                            <div className="cluster-sub">{cluster.sub}</div>
                                        </div>
                                        <div className="cluster-assigned">
                                            <div className="assigned-label">ASSIGNED SLOT</div>
                                            <div className="assigned-slot">{cluster.slot}</div>
                                        </div>
                                        <button className="arrow-btn"><i className="bi bi-chevron-right"></i></button>
                                    </div>
                                )) : (
                                    <div className="text-muted p-3">No screen clusters associated with this plan.</div>
                                )}
                            </div>

                            {/* Timeline area */}
                            <div className="detail-card area-timeline">
                                <h3 className="card-title" style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px' }}>
                                    <i className="bi bi-clock me-2"></i> Status Timeline
                                </h3>

                                <div className="timeline-container">
                                    {campaign.timeline.map((item, idx) => (
                                        <div className={`timeline-item ${item.status === 'completed' ? 'completed' : item.status === 'active' ? 'active' : ''}`} key={idx}>
                                            <div className="timeline-line"></div>
                                            <div className="timeline-icon">
                                                {item.status === 'completed' ? <i className="bi bi-check"></i> :
                                                    item.status === 'active' ? <i className="bi bi-broadcast"></i> : null}
                                            </div>
                                            <div className={`timeline-content ${item.status === 'upcoming' ? 'muted' : ''}`}>
                                                <div className="title">{item.title}</div>
                                                <div className="date">{item.date}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* XIA Intelligence area */}
                            <div className="area-xia xia-card">
                                <div className="xia-icon-box">
                                    <i className="bi bi-stars"></i>
                                </div>
                                <div className="xia-content">
                                    <h3 className="xia-title">XIA Performance Intelligence</h3>
                                    <p className="xia-desc">
                                        "Campaign metrics are syncing. Based on your {campaign.brief.objective} objective,
                                        I recommend monitoring the performance of screens in {campaign.gateInputs.location}
                                        during the launch week."
                                    </p>
                                    <div className="xia-actions">
                                        <button className="btn-roi">View Full ROI Report <i className="bi bi-arrow-right ms-2"></i></button>
                                        <button className="btn-reallocate">Ask for Re-allocation</button>
                                    </div>
                                </div>
                            </div>

                            {/* Incidents Summary area */}
                            <div className="detail-card area-incidents">
                                <h3 className="card-title" style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <i className="bi bi-exclamation-triangle me-2"></i> Incidents Summary
                                </h3>

                                <div className="incident-card">
                                    <div className="incident-header">
                                        <div className="incident-icon" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}><i className="bi bi-shield-check"></i></div>
                                        <div>
                                            <div className="incident-name">System Status</div>
                                            <div className="incident-time">LIVE MONITORING</div>
                                        </div>
                                    </div>
                                    <div className="incident-desc">No critical hardware incidents detected in the last 24 hours.</div>
                                    <button className="btn-dispute" disabled style={{ opacity: 0.5 }}>
                                        <i className="bi bi-hand-thumbs-down"></i> Raise Dispute
                                    </button>
                                </div>

                                <div className="ops-assist-banner">
                                    <i className="bi bi-globe"></i> 24/7 Ops Assist
                                </div>
                            </div>

                        </div>{/* end campaign-grid */}
                    </div>{/* end campaign-detail-container */}
                </div>{/* end dashboard-main-container */}

                {/* XIA Chat Sidebar — auto-opens when redirected from gateway completion */}
                {showXia && (
                    <div style={{ position: 'fixed', top: '84px', right: 0, bottom: 0, zIndex: 1050, height: 'calc(100vh - 84px)' }}>
                        <XiaAssistant
                            onClose={() => setShowXia(false)}
                            initialSessionId={urlSessionId}
                        />
                    </div>
                )}
            </div>{/* end dashboard-layout-wrapper */}
        </div>
    );
};

export default CampaignDetail;
