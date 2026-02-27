import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, RefreshCw, CheckCircle, XCircle, Upload, Monitor, FileVideo,
    Loader2, ChevronRight, Clock, Search
} from 'lucide-react';
import api from '../utils/api';
import axios from 'axios';

const NotificationsPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('screens');
    const [searchTerm, setSearchTerm] = useState('');

    // Data
    const [screenNotifs, setScreenNotifs] = useState([]);
    const [creativeNotifs, setCreativeNotifs] = useState([]);

    // Sub-filter within each tab
    const [screenSubFilter, setScreenSubFilter] = useState('all'); // all | new | resubmitted
    const [creativeSubFilter, setCreativeSubFilter] = useState('all'); // all | new | resubmitted

    useEffect(() => { fetchNotifications(); }, []);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            // ── Screens ──
            const screensRes = await axios.get('http://192.168.31.226:8000/api/console/screens/external-submit/');
            const allScreens = screensRes.data.screens || [];
            const screens = allScreens
                .filter(s => ['PENDING', 'SUBMITTED', 'RESUBMITTED'].includes(s.status))
                .map(s => ({
                    id: s.id,
                    type: s.status === 'RESUBMITTED' ? 'resubmitted' : 'new',
                    status: s.status,
                    title: s.status === 'RESUBMITTED'
                        ? 'Screen Resubmitted for Re-Verification'
                        : 'New Screen Submitted for Verification',
                    name: s.screen_name || `Screen #${s.id}`,
                    city: s.city || '—',
                    partner: s.company_name || s.admin_name || 'Partner',
                    timestamp: s.updated_at || s.created_at,
                    link: `/console/screens`,
                    linkState: { activeTab: s.status === 'RESUBMITTED' ? 'resubmitted' : 'pending' },
                }))
                .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

            setScreenNotifs(screens);

            // ── Creatives ──
            try {
                const assetsRes = await api.get('campaign-assets/');
                const assets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
                const creatives = assets
                    .filter(a => a.status === 'uploaded' || a.validation_status === 'failed')
                    .map(a => ({
                        id: a.id,
                        type: a.is_resubmission ? 'resubmitted' : 'new',
                        status: a.status,
                        title: a.is_resubmission
                            ? 'Creative Resubmitted for Review'
                            : 'New Creative Awaiting Review',
                        campaign: a.campaign_id || '—',
                        screen: a.screen_name || `Screen ${a.screen_id}`,
                        slot: a.slot_number || '—',
                        file: a.original_filename || 'Uploaded file',
                        timestamp: a.updated_at,
                        link: '/console/creative-validation',
                    }))
                    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

                setCreativeNotifs(creatives);
            } catch (e) {
                setCreativeNotifs([]);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Filtered screens
    const filteredScreens = useMemo(() => {
        let list = screenNotifs;
        if (screenSubFilter !== 'all') list = list.filter(s => s.type === screenSubFilter);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.city.toLowerCase().includes(q) ||
                s.partner.toLowerCase().includes(q)
            );
        }
        return list;
    }, [screenNotifs, screenSubFilter, searchTerm]);

    // Filtered creatives
    const filteredCreatives = useMemo(() => {
        let list = creativeNotifs;
        if (creativeSubFilter !== 'all') list = list.filter(c => c.type === creativeSubFilter);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(c =>
                c.campaign.toLowerCase().includes(q) ||
                c.screen.toLowerCase().includes(q)
            );
        }
        return list;
    }, [creativeNotifs, creativeSubFilter, searchTerm]);

    const screenNewCount = screenNotifs.filter(s => s.type === 'new').length;
    const screenResubCount = screenNotifs.filter(s => s.type === 'resubmitted').length;
    const creativeNewCount = creativeNotifs.filter(c => c.type === 'new').length;
    const creativeResubCount = creativeNotifs.filter(c => c.type === 'resubmitted').length;

    const TABS = [
        { key: 'screens', label: 'Screen Submissions', icon: Monitor, count: screenNotifs.length },
        { key: 'creatives', label: 'Creatives', icon: FileVideo, count: creativeNotifs.length },
    ];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">
            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <Bell size={20} className="text-slate-600" /> Notifications
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        {screenNotifs.length + creativeNotifs.length} pending actions requiring attention
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 text-xs rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 bg-white w-44 transition-all"
                        />
                    </div>
                    <button
                        onClick={fetchNotifications}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-none text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>
            </header>

            {/* Main Tabs */}
            <div className="flex border-b border-slate-200 gap-1">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setSearchTerm(''); }}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-all cursor-pointer ${activeTab === tab.key
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Icon size={15} />
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={28} className="animate-spin text-slate-400" />
                    <span className="ml-3 text-sm text-slate-500">Loading...</span>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {/* ── SCREENS TAB ── */}
                    {activeTab === 'screens' && (
                        <motion.div
                            key="screens"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4"
                        >
                            {/* Sub-filter chips */}
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { key: 'all', label: `All (${screenNotifs.length})` },
                                    { key: 'new', label: `New Submissions (${screenNewCount})`, color: 'bg-amber-100 text-amber-700 border-amber-200' },
                                    { key: 'resubmitted', label: `Resubmitted (${screenResubCount})`, color: 'bg-violet-100 text-violet-700 border-violet-200' },
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setScreenSubFilter(opt.key)}
                                        className={`px-3 py-1.5 text-[10px] font-bold rounded-none border cursor-pointer transition-all ${screenSubFilter === opt.key
                                                ? opt.color || 'bg-slate-800 text-white border-slate-800'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {filteredScreens.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-none border border-slate-100">
                                    <Monitor size={36} className="mx-auto text-slate-200 mb-3" />
                                    <p className="text-sm text-slate-500 font-medium">No screen notifications</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                                    {filteredScreens.map((s, idx) => (
                                        <motion.div
                                            key={s.id}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                                            onClick={() => navigate(s.link, { state: s.linkState })}
                                            className="px-5 py-4 hover:bg-slate-50 cursor-pointer flex items-start gap-4 group transition-colors"
                                        >
                                            <div className={`p-2 rounded-none shrink-0 mt-0.5 ${s.type === 'resubmitted' ? 'bg-violet-50' : 'bg-amber-50'}`}>
                                                {s.type === 'resubmitted'
                                                    ? <RefreshCw size={14} className="text-violet-600" />
                                                    : <Monitor size={14} className="text-amber-600" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-none border ${s.type === 'resubmitted'
                                                            ? 'bg-violet-100 text-violet-700 border-violet-200'
                                                            : 'bg-amber-100 text-amber-700 border-amber-200'
                                                        }`}>
                                                        {s.type === 'resubmitted' ? 'Resubmitted' : 'New Submission'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Clock size={9} /> {formatTimeAgo(s.timestamp)}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{s.name}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{s.city} • {s.partner}</p>
                                            </div>
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 shrink-0 mt-1 group-hover:translate-x-0.5 transition-all" />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── CREATIVES TAB ── */}
                    {activeTab === 'creatives' && (
                        <motion.div
                            key="creatives"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4"
                        >
                            {/* Sub-filter chips */}
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { key: 'all', label: `All (${creativeNotifs.length})` },
                                    { key: 'new', label: `New (${creativeNewCount})`, color: 'bg-amber-100 text-amber-700 border-amber-200' },
                                    { key: 'resubmitted', label: `Resubmitted (${creativeResubCount})`, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setCreativeSubFilter(opt.key)}
                                        className={`px-3 py-1.5 text-[10px] font-bold rounded-none border cursor-pointer transition-all ${creativeSubFilter === opt.key
                                                ? opt.color || 'bg-slate-800 text-white border-slate-800'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {filteredCreatives.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-none border border-slate-100">
                                    <FileVideo size={36} className="mx-auto text-slate-200 mb-3" />
                                    <p className="text-sm text-slate-500 font-medium">No creative notifications</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                                    {filteredCreatives.map((c, idx) => (
                                        <motion.div
                                            key={c.id}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                                            onClick={() => navigate(c.link)}
                                            className="px-5 py-4 hover:bg-slate-50 cursor-pointer flex items-start gap-4 group transition-colors"
                                        >
                                            <div className={`p-2 rounded-none shrink-0 mt-0.5 ${c.type === 'resubmitted' ? 'bg-indigo-50' : 'bg-amber-50'}`}>
                                                {c.type === 'resubmitted'
                                                    ? <RefreshCw size={14} className="text-indigo-600" />
                                                    : <Upload size={14} className="text-amber-600" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-none border ${c.type === 'resubmitted'
                                                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                                            : 'bg-amber-100 text-amber-700 border-amber-200'
                                                        }`}>
                                                        {c.type === 'resubmitted' ? 'Resubmitted' : 'New Creative'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Clock size={9} /> {formatTimeAgo(c.timestamp)}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{c.campaign}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{c.screen} • Slot {c.slot}</p>
                                                {c.file && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{c.file}</p>}
                                            </div>
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 shrink-0 mt-1 group-hover:translate-x-0.5 transition-all" />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </motion.div>
    );
};

export default NotificationsPage;
