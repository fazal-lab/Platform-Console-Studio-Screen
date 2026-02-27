import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Monitor, Layers, Users, Activity, Clock, RefreshCw, CheckCircle,
    XCircle, Upload, ChevronRight, Loader2, MapPin, Eye, ShieldAlert,
    FileVideo, AlertTriangle, UserPlus, MoreVertical, Bell
} from 'lucide-react';
import api from '../utils/api';

const AdminDashboardPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        totalScreens: 0,
        activeCampaigns: 0,
        pendingReviews: 0,
        resubmitted: 0,
        submittedScreens: 0,
        totalUsers: 0,
    });
    const [pendingAssets, setPendingAssets] = useState([]);
    const [submittedScreens, setSubmittedScreens] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [resubmittedAssets, setResubmittedAssets] = useState([]);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [screensRes, assetsRes, usersRes, logsRes] = await Promise.all([
                api.get('screen-specs/'),
                api.get('campaign-assets/'),
                api.get('users/'),
                api.get('audit-logs/'),
            ]);

            const screens = Array.isArray(screensRes.data) ? screensRes.data : [];
            const assets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
            const users = Array.isArray(usersRes.data) ? usersRes.data : [];
            const logs = Array.isArray(logsRes.data) ? logsRes.data : [];

            // Metrics
            const submitted = screens.filter(s => s.status === 'SUBMITTED');
            const pending = assets.filter(a => a.status === 'uploaded' && !a.is_resubmission);
            const resub = assets.filter(a => a.is_resubmission && a.status === 'uploaded');
            const activeCampaigns = [...new Set(assets.filter(a => a.file).map(a => a.campaign_id))].length;

            setMetrics({
                totalScreens: screens.length,
                activeCampaigns,
                pendingReviews: pending.length,
                resubmitted: resub.length,
                submittedScreens: submitted.length,
                totalUsers: users.length,
            });

            setPendingAssets(pending.slice(0, 5));
            setSubmittedScreens(submitted.slice(0, 5));
            setResubmittedAssets(resub.slice(0, 5));

            // Map audit logs
            const mapped = logs.slice(0, 10).map(log => ({
                user: log.user_email || 'System',
                action: log.action,
                component: log.component || '—',
                time: new Date(log.timestamp).toLocaleString(),
                status: log.action.includes('FAILED') || log.action.includes('REJECTED') ? 'Failed' : 'Success'
            }));
            setRecentActivity(mapped);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const metricCards = [
        { title: 'Total Screens', value: metrics.totalScreens, icon: Monitor, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', onClick: () => navigate('/console/screens') },
        { title: 'Active Campaigns', value: metrics.activeCampaigns, icon: Layers, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', onClick: () => navigate('/console/campaigns') },
        { title: 'Pending Reviews', value: metrics.pendingReviews, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', highlight: metrics.pendingReviews > 0, onClick: () => navigate('/console/creative-validation') },
        { title: 'Resubmitted', value: metrics.resubmitted, icon: RefreshCw, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', highlight: metrics.resubmitted > 0, onClick: () => navigate('/console/creative-validation') },
        { title: 'Screen Submissions', value: metrics.submittedScreens, icon: Upload, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', highlight: metrics.submittedScreens > 0, onClick: () => navigate('/console/screens') },
        { title: 'System Users', value: metrics.totalUsers, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', onClick: () => navigate('/console/users-roles') },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 size={28} className="animate-spin text-slate-400" />
                <span className="ml-3 text-sm text-slate-500">Loading dashboard...</span>
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">Xigi Admin Dashboard</h1>
                    <p className="text-xs text-slate-500 mt-1">Internal overview of screens, campaigns, and system health.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/console/notifications')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-none text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                        <Bell size={14} /> Notifications
                    </button>
                    <button
                        onClick={fetchAll}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-none text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </header>

            {/* ═══ Metric Cards ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {metricCards.map((card, i) => (
                    <motion.div
                        key={card.title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={card.onClick}
                        className={`bg-white p-4 rounded-none shadow-sm border cursor-pointer hover:shadow-md transition-all group ${card.highlight ? `${card.border} border-2` : 'border-slate-100'}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.title}</p>
                            <div className={`p-1.5 rounded-none ${card.bg}`}>
                                <card.icon size={14} className={card.color} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">{card.value}</h3>
                        {card.highlight && (
                            <p className={`text-[10px] font-bold mt-1 ${card.color}`}>Needs attention</p>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* ═══ Action Items Row ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* Creatives Awaiting Review */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden"
                >
                    <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-50 rounded-none"><ShieldAlert size={14} className="text-amber-600" /></div>
                            <h3 className="text-xs font-bold text-slate-800">Creatives Awaiting Review</h3>
                        </div>
                        <button onClick={() => navigate('/console/creative-validation')} className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 hover:text-blue-800 cursor-pointer">
                            View All <ChevronRight size={10} />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {pendingAssets.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <CheckCircle size={24} className="mx-auto text-green-400 mb-2" />
                                <p className="text-xs text-slate-500 font-medium">All caught up! No pending reviews.</p>
                            </div>
                        ) : pendingAssets.map((asset, i) => (
                            <div key={asset.id} className="px-4 py-2.5 hover:bg-slate-50/50 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/console/creative-validation')}>
                                <div className="p-1.5 bg-amber-50 rounded-none shrink-0">
                                    <FileVideo size={12} className="text-amber-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate">{asset.campaign_id} • Slot {asset.slot_number}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{asset.screen_name || `Screen ${asset.screen_id}`} • {asset.original_filename || 'File uploaded'}</p>
                                </div>
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-200 shrink-0">Pending</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Resubmitted Creatives */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden"
                >
                    <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-50 rounded-none"><RefreshCw size={14} className="text-indigo-600" /></div>
                            <h3 className="text-xs font-bold text-slate-800">Resubmitted Creatives</h3>
                        </div>
                        <button onClick={() => navigate('/console/creative-validation')} className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 hover:text-blue-800 cursor-pointer">
                            View All <ChevronRight size={10} />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {resubmittedAssets.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <CheckCircle size={24} className="mx-auto text-green-400 mb-2" />
                                <p className="text-xs text-slate-500 font-medium">No resubmissions pending.</p>
                            </div>
                        ) : resubmittedAssets.map((asset, i) => (
                            <div key={asset.id} className="px-4 py-2.5 hover:bg-slate-50/50 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/console/creative-validation')}>
                                <div className="p-1.5 bg-indigo-50 rounded-none shrink-0">
                                    <RefreshCw size={12} className="text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate">{asset.campaign_id} • Slot {asset.slot_number}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{asset.screen_name || `Screen ${asset.screen_id}`} • Updated & resubmitted</p>
                                </div>
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200 shrink-0">Resubmitted</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Pending Screen Submissions */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                    className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden"
                >
                    <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-50 rounded-none"><Monitor size={14} className="text-emerald-600" /></div>
                            <h3 className="text-xs font-bold text-slate-800">New Screen Submissions</h3>
                        </div>
                        <button onClick={() => navigate('/console/screens')} className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 hover:text-blue-800 cursor-pointer">
                            View All <ChevronRight size={10} />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {submittedScreens.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <CheckCircle size={24} className="mx-auto text-green-400 mb-2" />
                                <p className="text-xs text-slate-500 font-medium">No pending screen submissions.</p>
                            </div>
                        ) : submittedScreens.map((screen, i) => (
                            <div key={screen.id} className="px-4 py-2.5 hover:bg-slate-50/50 flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/console/screens/unprofiled/${screen.id}`)}>
                                <div className="p-1.5 bg-emerald-50 rounded-none shrink-0">
                                    <Monitor size={12} className="text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate">{screen.screen_name || `Screen #${screen.id}`}</p>
                                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                        <MapPin size={8} /> {screen.city || '—'} • {screen.environment || ''} • by {screen.admin_name || 'Partner'}
                                    </p>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200 shrink-0">Submitted</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* ═══ Recent Activity ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden"
            >
                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800">Recent Activity</h3>
                    <button onClick={() => navigate('/console/system-logs')} className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 hover:text-blue-800 cursor-pointer">
                        View Full Logs <ChevronRight size={10} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-semibold text-[10px]">
                            <tr>
                                <th className="px-4 py-2.5 border-b border-slate-200">User</th>
                                <th className="px-4 py-2.5 border-b border-slate-200">Action</th>
                                <th className="px-4 py-2.5 border-b border-slate-200">Component</th>
                                <th className="px-4 py-2.5 border-b border-slate-200">Time</th>
                                <th className="px-4 py-2.5 border-b border-slate-200">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {recentActivity.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-10 text-center text-slate-400 italic text-xs">No recent activity found.</td>
                                </tr>
                            ) : recentActivity.map((act, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{act.user}</td>
                                    <td className="px-4 py-2.5 text-xs text-slate-600">{act.action}</td>
                                    <td className="px-4 py-2.5 text-xs text-slate-500">{act.component}</td>
                                    <td className="px-4 py-2.5 text-xs text-slate-500">{act.time}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${act.status === 'Success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                                            }`}>
                                            {act.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default AdminDashboardPage;
