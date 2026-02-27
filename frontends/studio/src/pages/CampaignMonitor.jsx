import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import '../styles/campaignMonitor.css';
import { useXiaContext } from '../context/XiaContext';

const CampaignMonitor = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { setPageContext } = useXiaContext();

    // Mock data for Live War Room based on image
    const monitorData = {
        campaignId: 'C-103',
        status: 'SYNCHRONIZED WITH EDGE',
        liveImpressions: '842,054',
        truthConfidence: '98.4%',
        incidents: [
            { type: 'INCIDENT', time: '12:42', name: 'Screen #04 (Central)', desc: 'Brief downtime detected (4 min)', class: 'incident' },
            { type: 'WARNING', time: '11:15', name: 'Screen #12 (Mall)', desc: 'High heat warning from controller', class: 'warning' }
        ],
        displays: [
            { id: 1, name: 'Central Hub Display #1', loc: 'T-Nagar, Cluster A', status: 'ONLINE', plays: '3916', confidence: '98.6%', type: 'online' },
            { id: 2, name: 'Central Hub Display #2', loc: 'T-Nagar, Cluster A', status: 'ONLINE', plays: '3278', confidence: '98.9%', type: 'online' },
            { id: 3, name: 'Central Hub Display #3', loc: 'T-Nagar, Cluster A', status: 'ONLINE', plays: '5972', confidence: '97.5%', type: 'online' },
            { id: 4, name: 'Central Hub Display #4', loc: 'T-Nagar, Cluster A', status: 'INCIDENT', plays: '1038', confidence: '95.0%', type: 'incident' },
            { id: 5, name: 'Central Hub Display #5', loc: 'T-Nagar, Cluster A', status: 'ONLINE', plays: '4300', confidence: '99.4%', type: 'online' },
            { id: 6, name: 'Central Hub Display #6', loc: 'T-Nagar, Cluster A', status: 'ONLINE', plays: '1719', confidence: '96.6%', type: 'online' },
            { id: 7, name: 'Central Hub Display #7', loc: 'T-Nagar, Cluster A', status: 'ONLINE', plays: '5280', confidence: '98.7%', type: 'online' },
            { id: 8, name: 'Central Hub Display #8', loc: 'T-Nagar, Cluster A', status: 'ONLINE', plays: '2800', confidence: '97.2%', type: 'online' },
            { id: 9, name: 'Central Hub Display #9', loc: 'T-Nagar, Cluster A', status: 'ONLINE', plays: '4120', confidence: '98.0%', type: 'online' }
        ],
        xiaMessage: "I am currently cross-referencing Proof-of-Play logs with device health signals. Screen #04 is recovering from a controller glitch. No budget was lost during the 4-minute incident as I've already re-balanced the impression target."
    };

    // Publish live page data for XIA — full per-display details
    useEffect(() => {
        setPageContext({
            page: 'campaign_monitor',
            page_label: 'Live War Room',
            summary: `Monitoring campaign ${monitorData.campaignId}. Status: ${monitorData.status}. ${monitorData.liveImpressions} live impressions. ${monitorData.incidents.length} active incidents. ${monitorData.displays.length} displays.`,
            data: {
                campaign_id: monitorData.campaignId,
                status: monitorData.status,
                live_impressions: monitorData.liveImpressions,
                truth_confidence: monitorData.truthConfidence,
                xia_analysis: monitorData.xiaMessage,
                incidents: monitorData.incidents.map(i => ({
                    type: i.type,
                    time: i.time,
                    screen_name: i.name,
                    description: i.desc,
                })),
                displays: monitorData.displays.map(d => ({
                    name: d.name,
                    location: d.loc,
                    status: d.status,
                    total_plays: d.plays,
                    confidence: d.confidence,
                })),
                displays_online: monitorData.displays.filter(d => d.type === 'online').length,
                displays_incident: monitorData.displays.filter(d => d.type === 'incident').length,
            }
        })
        return () => setPageContext(null)
    }, [])

    return (
        <div className="campaign-monitor-wrapper">
            <Header />

            <div className="campaign-monitor-container">

                {/* Monitor Header */}
                <div className="monitor-header">
                    <div className="monitor-id-section">
                        <button className="back-link border-0 bg-transparent mb-0 me-2" onClick={() => navigate(`/campaigns/${id}`)}>
                            <i className="bi bi-chevron-left" style={{ fontSize: '18px' }}></i>
                        </button>
                        <div>
                            <h1>Live War Room: {monitorData.campaignId}</h1>
                            <div className="sync-status">
                                <div className="sync-dot"></div>
                                {monitorData.status}
                            </div>
                        </div>
                    </div>

                    <div className="monitor-stats-header">
                        <div className="stat-header-item">
                            <div className="stat-header-label">LIVE IMPRESSIONS</div>
                            <div className="stat-header-value">{monitorData.liveImpressions}</div>
                        </div>
                        <div className="stat-header-item">
                            <div className="stat-header-label">TRUTH CONFIDENCE</div>
                            <div className="stat-header-value blue">{monitorData.truthConfidence}</div>
                        </div>
                        <button className="btn-action-report" onClick={() => navigate(`/campaigns/${id}/report`)}>
                            Action Report
                        </button>
                    </div>
                </div>

                {/* Dashboard Area */}
                <div className="monitor-grid">

                    {/* Sidebar Incidents */}
                    <div className="sidebar-incidents">
                        <div className="incidents-title">
                            <i className="bi bi-exclamation-triangle"></i>
                            Active Incidents
                        </div>

                        {monitorData.incidents.map((incident, idx) => (
                            <div className={`incident-mini-card ${incident.class}`} key={idx}>
                                <div className="mini-tag">
                                    <span className={incident.class === 'incident' ? 'text-incident' : 'text-warning'}>
                                        {incident.type}
                                    </span>
                                    <span className="text-time">{incident.time}</span>
                                </div>
                                <div className="mini-name">{incident.name}</div>
                                <div className="mini-desc">{incident.desc}</div>
                                <button className={`btn-dispute-mini ${incident.class}`}>
                                    Raise Dispute / Dispute Request
                                </button>
                            </div>
                        ))}

                        <button className="btn-ops-assist">
                            <i className="bi bi-globe"></i>
                            Request Ops Assist
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="main-monitor-content">

                        <div className="main-sync-card">
                            <div className="sync-card-header">
                                <div className="sync-card-title">
                                    <i className="bi bi-activity"></i>
                                    Real-World Broadcast Sync
                                </div>
                                <div className="sync-controls">
                                    <button className="control-btn"><i className="bi bi-arrow-clockwise"></i></button>
                                    <button className="control-btn"><i className="bi bi-three-dots-vertical"></i></button>
                                </div>
                            </div>

                            <div className="displays-grid">
                                {monitorData.displays.map((node) => (
                                    <div className="display-node-card" key={node.id}>
                                        <div className="node-header">
                                            <div className="node-icon">
                                                <i className="bi bi-display"></i>
                                            </div>
                                            <div className={`online-badge ${node.type === 'incident' ? 'incident' : ''}`}>
                                                {node.status}
                                            </div>
                                        </div>
                                        <div className="node-name">{node.name}</div>
                                        <div className="node-loc">{node.loc}</div>
                                        <div className="node-metrics">
                                            <div>
                                                <div className="n-met-label">PLAYS</div>
                                                <div className="n-met-value">{node.plays}</div>
                                            </div>
                                            <div>
                                                <div className="n-met-label">CONFIDENCE</div>
                                                <div className="n-met-value blue">{node.confidence}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bottom XIA monitoring card */}
                        <div className="xia-monitoring-card">
                            <div className="xia-mon-icon">
                                <i className="bi bi-stars"></i>
                            </div>
                            <div className="xia-mon-content">
                                <div className="xia-mon-title">XIA Real-Time Monitoring</div>
                                <p className="xia-mon-desc">"{monitorData.xiaMessage}"</p>
                                <button className="btn-evidence">
                                    Review Evidence Pack <i className="bi bi-box-arrow-up-right"></i>
                                </button>
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </div>
    );
};

export default CampaignMonitor;
