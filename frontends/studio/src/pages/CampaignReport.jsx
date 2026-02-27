import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import '../styles/campaignReport.css';
import { useXiaContext } from '../context/XiaContext';

const CampaignReport = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    // Mock data based on the provided report image
    const reportData = {
        campaignName: 'Campaign Performance Pack',
        subtitle: 'Deterministic ROI Report for C-103',
        metrics: [
            { label: 'VERIFIED REACH', value: '1.24M', trend: '+14%', icon: 'bi-people', trendClass: 'trend-up' },
            { label: 'ACTUAL IMPRESSIONS', value: '3.12M', trend: '+2%', icon: 'bi-graph-up', trendClass: 'trend-positive' },
            { label: 'EDGE CONFIDENCE', value: '99.2%', trend: 'Excellent', icon: 'bi-shield-check', trendClass: 'trend-gray' },
            { label: 'AVG DWELL TIME', value: '6.4s', trend: '+0.8s', icon: 'bi-clock', trendClass: 'trend-positive' }
        ],
        intelligence: {
            title: 'Post-Campaign Intelligence',
            notes: 'All insights are derived from verified PoP and Footfall heatmaps.',
            insights: [
                {
                    title: 'Growth Opportunity',
                    icon: 'bi-graph-up-arrow',
                    desc: 'Creative Variant B (Portrait) drove 22% higher engagement at Kiosk locations compared to the landscape baseline. I suggest a 90/10 split for the next Q3 cycle.'
                },
                {
                    title: 'Cluster Win',
                    icon: 'bi-map',
                    desc: 'Your Brand-to-Location match was highest in the OMR Tech Corridor. Audience dwell time averaged 9.2s during morning transit peaks.'
                }
            ]
        },
        financial: {
            desc: 'Deterministic billing records are available via Xigi One Bridge.',
            invoiceId: '#INV-24-001',
            total: '12,500.00'
        },
        compliance: {
            title: 'Compliance Cleared',
            desc: 'All playback verified by blockchain PoP logs. This report is ready for agency audit.'
        }
    };

    // Publish live page data for XIA — full report with insights, trends, compliance
    const { setPageContext } = useXiaContext();
    useEffect(() => {
        setPageContext({
            page: 'campaign_report',
            page_label: 'Campaign Performance Report',
            summary: `Report for ${reportData.subtitle}. Reach: ${reportData.metrics[0].value}, Impressions: ${reportData.metrics[1].value}, Confidence: ${reportData.metrics[2].value}, Dwell: ${reportData.metrics[3].value}.`,
            data: {
                campaign_name: reportData.campaignName,
                subtitle: reportData.subtitle,
                metrics: reportData.metrics.map(m => ({
                    label: m.label,
                    value: m.value,
                    trend: m.trend,
                    trend_direction: m.trendClass,
                })),
                intelligence: {
                    title: reportData.intelligence.title,
                    notes: reportData.intelligence.notes,
                    insights: reportData.intelligence.insights.map(i => ({
                        title: i.title,
                        description: i.desc,
                    })),
                },
                financial: reportData.financial,
                compliance: reportData.compliance,
            }
        })
        return () => setPageContext(null)
    }, [])

    return (
        <div className="campaign-report-wrapper">
            <Header />

            <div className="campaign-report-container">
                {/* Header Row */}
                <div className="report-header">
                    <div className="report-title-section">
                        <button className="back-link border-0 bg-transparent mb-0 me-3" onClick={() => navigate(`/campaigns/${id}`)}>
                            <i className="bi bi-chevron-left" style={{ fontSize: '20px' }}></i>
                        </button>
                        <div>
                            <h1>{reportData.campaignName}</h1>
                            <div className="report-subtitle">{reportData.subtitle}</div>
                        </div>
                    </div>

                    <div className="report-actions">
                        <button className="btn-export-csv">
                            <i className="bi bi-download"></i> Export CSV
                        </button>
                        <button className="btn-export-pdf">
                            <i className="bi bi-download"></i> Export PDF
                        </button>
                    </div>
                </div>

                {/* Metrics Row */}
                <div className="metrics-row">
                    {reportData.metrics.map((metric, idx) => (
                        <div className="metric-card" key={idx}>
                            <div className={`metric-trend ${metric.trendClass}`}>{metric.trend}</div>
                            <div className="metric-icon-box">
                                <i className={`bi ${metric.icon}`}></i>
                            </div>
                            <div className="metric-label">{metric.label}</div>
                            <div className="metric-value">{metric.value}</div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="report-main-grid">

                    {/* Dark Intelligence Card */}
                    <div className="intel-card-large">
                        <div className="intel-header">
                            <div className="intel-icon-large">
                                <i className="bi bi-stars"></i>
                            </div>
                            <h2>{reportData.intelligence.title}</h2>
                        </div>

                        <div className="intel-grid">
                            {reportData.intelligence.insights.map((insight, idx) => (
                                <div className="intel-sub-card" key={idx}>
                                    <div className="intel-sub-header">
                                        <i className={`bi ${insight.icon}`}></i>
                                        <h3>{insight.title}</h3>
                                    </div>
                                    <p className="intel-sub-desc">{insight.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="intel-footer">
                            <div className="intel-footer-note">
                                {reportData.intelligence.notes}
                            </div>
                            <button className="btn-apply-insights">
                                Apply Insights to New Plan
                            </button>
                        </div>
                    </div>

                    {/* Sidebar Area */}
                    <div className="report-sidebar">

                        <div className="sidebar-card">
                            <div className="sidebar-card-header">
                                <i className="bi bi-file-earmark-text"></i>
                                <h3>Financial Bridge</h3>
                            </div>
                            <p className="sidebar-card-desc">{reportData.financial.desc}</p>

                            <div className="invoice-box">
                                <div className="invoice-info">
                                    <div className="label">INVOICE {reportData.financial.invoiceId}</div>
                                    <div className="value">Total: ₹{reportData.financial.total}</div>
                                </div>
                                <a href="#" className="invoice-link">
                                    <i className="bi bi-box-arrow-up-right"></i>
                                </a>
                            </div>

                            <button className="btn-download-pack">
                                Download Full Evidence Pack
                            </button>
                        </div>

                        <div className="compliance-card">
                            <div className="compliance-icon">
                                <i className="bi bi-check-circle-fill"></i>
                            </div>
                            <div className="compliance-info">
                                <h3>{reportData.compliance.title}</h3>
                                <p>{reportData.compliance.desc}</p>
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </div>
    );
};

export default CampaignReport;
