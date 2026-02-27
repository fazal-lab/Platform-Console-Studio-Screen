import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
    Megaphone,
    TrendingUp,
    Users,
    Eye,
    Activity,
    Zap,
    Clock,
    CheckCircle,
    AlertTriangle,
    ArrowRight,
    FileText,
    BarChart2,
    Calendar,
    Monitor
} from 'lucide-react';

const CampaignIntelligenceDashboard = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState('');
    const [activeCampaign, setActiveCampaign] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('campaigns/');
            const mapped = response.data.map(c => ({
                id: c.id.toString(),
                numericId: c.id,
                name: c.name,
                advertiser: c.company_name || 'N/A',
                status: c.status === 'live' ? 'Live' : 'Planned',
                dateRange: `${new Date(c.start_date || Date.now()).toLocaleDateString()} - ${new Date(c.end_date || Date.now()).toLocaleDateString()}`,
                totalScreens: 0,
                estimates: {
                    plays: 100000,
                    impressions: '1.2M',
                    reach: '450K',
                    confidenceScore: 92,
                    riskLevel: 'Low'
                },
                confidenceBreakdown: {
                    high: { count: 16, percent: 68, range: '92-100%' },
                    medium: { count: 6, percent: 24, range: '75-91%' },
                    low: { count: 2, percent: 8, range: '<75%' }
                },
                pacing: {
                    deliveredPlays: 0,
                    pacingPercentage: 0,
                    status: 'Active'
                },
                recommendations: []
            }));
            setCampaigns(mapped);
            if (mapped.length > 0) {
                setSelectedId(mapped[0].id);
                setActiveCampaign(mapped[0]);
            }
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            setError('Failed to load campaigns. Please check your backend connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedId) {
            const camp = campaigns.find(c => c.id === selectedId);
            if (camp) setActiveCampaign(camp);
        }
    }, [selectedId, campaigns]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-slate-500 font-medium animate-pulse">Fetching intelligence data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 bg-red-50 rounded-xl border border-red-100">
                <AlertTriangle size={48} className="text-red-500" />
                <h3 className="text-lg font-bold text-red-800">Connection Error</h3>
                <p className="text-red-600 text-center max-w-md">{error}</p>
                <button
                    onClick={fetchCampaigns}
                    className="mt-2 px-6 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition-colors"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    if (campaigns.length === 0 || !activeCampaign) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <Megaphone size={64} className="text-slate-300" />
                <h3 className="text-xl font-bold text-slate-700">No Active Campaigns Found</h3>
                <p className="text-slate-500 text-center max-w-sm">
                    You haven't created any campaigns yet. Once you onboard campaigns, their intelligence and delivery data will appear here.
                </p>
            </div>
        );
    }

    // Helper for pacing bar width
    const pacingProgress = Math.min((activeCampaign.pacing.deliveredPlays / activeCampaign.estimates.plays) * 100, 100);

    return (
        <div className="space-y-8 pb-20">

            {/* 1. Campaign Header (Context) */}
            <header className="bg-white p-6 rounded-none border-b border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{activeCampaign.name}</h1>
                            <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${activeCampaign.status === 'Live' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {activeCampaign.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-6 mt-2 text-sm text-slate-500 font-medium">
                            <span className="flex items-center gap-1"><Users size={16} /> {activeCampaign.advertiser}</span>
                            <span className="flex items-center gap-1"><Calendar size={16} /> {activeCampaign.dateRange}</span>
                            <span className="flex items-center gap-1"><Monitor size={16} /> {activeCampaign.totalScreens} Screens</span>
                        </div>
                    </div>

                    {/* Campaign Selector */}
                    <div className="relative">
                        <select
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold py-2 pl-4 pr-8 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                        >
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                        </div>
                    </div>
                </div>
            </header>

            {/* 2. Plan-Time Estimates */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Zap size={20} className="text-slate-400" />
                    <h2 className="text-lg font-bold text-slate-700 tracking-wide">Plan-Time Estimates</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-sm font-bold text-slate-800">Estimated Plays</p>
                        <p className="text-2xl font-bold text-slate-900 mt-2">{activeCampaign.estimates.plays.toLocaleString()}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Based on scope</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-sm font-bold text-slate-800">Est. Impressions</p>
                        <p className="text-2xl font-bold text-blue-600 mt-2">{activeCampaign.estimates.impressions}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Projected reach</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-sm font-bold text-slate-800">Expected Confidence</p>
                        <p className="text-2xl font-bold text-green-600 mt-2">{activeCampaign.estimates.confidenceScore}%</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Network health</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-sm font-bold text-slate-800">Risk Level</p>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold mt-2 ${activeCampaign.estimates.riskLevel === 'Low' ? 'bg-green-100 text-green-700' :
                            activeCampaign.estimates.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {activeCampaign.estimates.riskLevel === 'Low' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                            {activeCampaign.estimates.riskLevel}
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-1">AI Assessed</p>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 3. Confidence Band Breakdown */}
                <section className="bg-white p-6 border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-blue-500" />
                        Confidence Band Breakdown
                    </h3>
                    <div className="space-y-6">
                        {[
                            { label: 'High Confidence', data: activeCampaign.confidenceBreakdown.high, color: 'bg-green-500', text: 'text-green-700' },
                            { label: 'Medium Confidence', data: activeCampaign.confidenceBreakdown.medium, color: 'bg-blue-500', text: 'text-blue-700' },
                            { label: 'Low Confidence', data: activeCampaign.confidenceBreakdown.low, color: 'bg-amber-500', text: 'text-amber-700' },
                        ].map((band, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className={`text-sm font-bold ${band.text}`}>{band.label}</p>
                                        <p className="text-xs text-slate-400">Range: {band.data.range}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-bold text-slate-800">{band.data.count}</span>
                                        <span className="text-sm text-slate-500 ml-1">screens ({band.data.percent}%)</span>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                    <div className={`h-full ${band.color}`} style={{ width: `${band.data.percent}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. Live Pacing Insights */}
                <section className="bg-white p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Clock size={20} className="text-purple-500" />
                        Live Pacing Insights
                    </h3>

                    <div className="mb-8">
                        <div className="flex justify-between text-sm mb-2 font-medium">
                            <span className="text-slate-500">Delivered Plays</span>
                            <span className="text-slate-800 font-bold">{activeCampaign.pacing.deliveredPlays.toLocaleString()} / {activeCampaign.estimates.plays.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden relative">
                            <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${pacingProgress}%` }}></div>
                        </div>
                        <div className="flex justify-end mt-2">
                            <span className={`text-sm font-bold ${activeCampaign.pacing.pacingPercentage < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {activeCampaign.pacing.pacingPercentage > 0 ? '+' : ''}{activeCampaign.pacing.pacingPercentage}% {activeCampaign.pacing.status}
                            </span>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Expected Shortfall</p>
                        <p className="text-slate-700 text-sm">
                            {activeCampaign.pacing.pacingPercentage < -10
                                ? "Currently projecting a 5-8% shortfall. Consider activating backup screens."
                                : "On track to meet delivery targets within acceptable variance."}
                        </p>
                    </div>
                </section>
            </div>

            {/* 5. Recommendation Log */}
            <section className="bg-white border border-slate-200 shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={20} className="text-slate-500" />
                        Recommendation Log
                    </h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Brain Log</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Timestamp</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">AI Recommendation</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Reason</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {activeCampaign.recommendations.map((rec) => (
                                <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-slate-500 whitespace-nowrap">{rec.timestamp}</td>
                                    <td className="p-4 font-medium text-slate-800">{rec.message}</td>
                                    <td className="p-4 text-slate-600">{rec.reason}</td>
                                    <td className="p-4 text-right">
                                        <span className={`inline-block px-2 py-1 text-xs font-bold bg-opacity-10 rounded-md ${rec.status === 'Accepted' ? 'bg-green-500 text-green-700' :
                                            rec.status === 'Ignored' ? 'bg-slate-500 text-slate-600' :
                                                'bg-amber-500 text-amber-700'
                                            }`}>
                                            {rec.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {activeCampaign.recommendations.length === 0 && (
                        <div className="p-8 text-center text-slate-400 italic">No recommendations logged yet.</div>
                    )}
                </div>
            </section>

            {/* 6. Actions */}
            <section className="flex flex-col md:flex-row gap-4 justify-end pt-4 border-t border-slate-200">
                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded hover:bg-slate-50 transition-colors">
                    <BarChart2 size={18} />
                    Compare Estimates vs Delivered
                </button>
                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors shadow-sm">
                    <FileText size={18} />
                    View Intelligence Pack
                </button>
            </section>

        </div>
    );
};

export default CampaignIntelligenceDashboard;
