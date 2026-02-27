import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search, X, MapPin, Activity, ChevronRight, Plus,
    CheckCircle2, AlertCircle, Clock, FileText,
    MoreHorizontal, Filter, ArrowUpRight, Check, X as CloseIcon, Trash2
} from 'lucide-react';
import axios from 'axios';
import api from '../utils/api';

const ScreensListPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'all');
    const [screens, setScreens] = useState([]);
    const [pendingScreens, setPendingScreens] = useState([]);
    const [draftScreens, setDraftScreens] = useState([]);
    const [blockedScreens, setBlockedScreens] = useState([]);
    const [resubmittedScreens, setResubmittedScreens] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Using axios directly for hardcoded IP to avoid api.js interceptors/baseURL
            const response = await axios.get('/api/console/screens/external-submit/');
            const allScreens = response.data.screens || [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const mapScreen = (s, defStatus) => {
                let rawStatus = s.status || defStatus;

                // Auto-flip SCHEDULED_BLOCK → Blocked if date has passed
                if (rawStatus === 'SCHEDULED_BLOCK' && s.scheduled_block_date) {
                    const blockDate = new Date(s.scheduled_block_date);
                    if (blockDate <= today) rawStatus = 'BLOCKED';
                }

                let displayStatus = rawStatus;
                if (displayStatus === 'SUBMITTED') displayStatus = 'Review Pending';
                if (displayStatus === 'DRAFT') displayStatus = 'Draft';
                if (displayStatus === 'VERIFIED') displayStatus = 'Verified';
                if (displayStatus === 'PENDING') displayStatus = 'Pending';
                if (displayStatus === 'REJECTED') displayStatus = 'Rejected';
                if (displayStatus === 'RESUBMITTED') displayStatus = 'Resubmitted';
                if (displayStatus === 'SCHEDULED_BLOCK') displayStatus = 'Scheduled Block';
                if (displayStatus === 'BLOCKED') displayStatus = 'Blocked';

                return {
                    id: s.id,
                    displayId: s.screen_id || `SCR-${s.id}`,
                    name: s.screen_name || 'Unnamed Screen',
                    city: s.city || '-',
                    ownership: s.company_name || s.role,
                    status: displayStatus,
                    rawStatus,
                    source: s.source || 'INTERNAL',
                    profile: s.profile_status === 'PROFILED' ? 'Profiled' : (s.profile_status === 'REPROFILE' ? 'Reprofile' : 'UnProfiled'),
                    scheduledBlockDate: s.scheduled_block_date || null,
                    addedAt: s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'
                };
            };

            setScreens(allScreens.filter(s => s.status === 'VERIFIED').map(s => mapScreen(s, 'Verified')));
            setPendingScreens([
                ...allScreens.filter(s => s.status === 'SUBMITTED').map(s => mapScreen(s, 'Review Pending')),
                ...allScreens.filter(s => s.status === 'PENDING').map(s => mapScreen(s, 'Pending'))
            ]);
            setResubmittedScreens(allScreens.filter(s => s.status === 'RESUBMITTED').map(s => mapScreen(s, 'Resubmitted')));
            setDraftScreens(allScreens.filter(s => s.status === 'DRAFT' || s.status === 'REJECTED').map(s => mapScreen(s, 'Draft')));
            setBlockedScreens(allScreens.filter(s => s.status === 'BLOCKED' || s.status === 'SCHEDULED_BLOCK').map(s => mapScreen(s)));
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const total = screens.length + pendingScreens.length + draftScreens.length + blockedScreens.length + resubmittedScreens.length;
        const verified = screens.length;
        const pending = pendingScreens.length;
        const blocked = blockedScreens.length;
        const profiled = [...screens, ...pendingScreens, ...draftScreens, ...blockedScreens, ...resubmittedScreens].filter(s => s.profile === 'Profiled').length;

        return [
            { label: 'Total Screens', value: total, color: 'text-blue-600' },
            { label: 'Review Pending', value: pending, color: 'text-orange-500' },
            { label: 'Resubmitted', value: resubmittedScreens.length, color: 'text-violet-600' },
            { label: 'Verified', value: verified, color: 'text-emerald-600' },
            { label: 'Profiled', value: profiled, color: 'text-green-500' },
            { label: 'Blocked', value: blocked, color: 'text-red-600' },
        ];
    }, [screens, pendingScreens, draftScreens, blockedScreens, resubmittedScreens]);

    const filteredScreens = useMemo(() => {
        let source = [...screens, ...pendingScreens, ...draftScreens, ...blockedScreens, ...resubmittedScreens];
        if (activeTab === 'pending') source = pendingScreens;
        if (activeTab === 'draft') source = draftScreens;
        if (activeTab === 'blocked') source = blockedScreens;
        if (activeTab === 'resubmitted') source = resubmittedScreens;

        return source.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.displayId || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = !filterStatus ||
                s.status.toLowerCase() === filterStatus.toLowerCase() ||
                s.profile.toLowerCase() === filterStatus.toLowerCase();

            return matchesSearch && matchesStatus;
        });
    }, [searchTerm, filterStatus, activeTab, screens, pendingScreens, draftScreens, blockedScreens]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Verified':
            case 'VERIFIED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Review Pending':
            case 'SUBMITTED': return 'bg-orange-50 text-orange-600 border-orange-100';
            case 'Pending':
            case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'Resubmitted':
            case 'RESUBMITTED': return 'bg-violet-50 text-violet-700 border-violet-200';
            case 'Rejected':
            case 'REJECTED': return 'bg-red-50 text-red-600 border-red-200';
            case 'Draft':
            case 'DRAFT': return 'bg-slate-50 text-slate-500 border-slate-100';
            case 'Scheduled Block':
            case 'SCHEDULED_BLOCK': return 'bg-orange-100 text-orange-700 border-orange-300';
            case 'Blocked':
            case 'BLOCKED': return 'bg-red-50 text-red-700 border-red-200';
            default: return 'bg-blue-50 text-blue-600 border-blue-100';
        }
    };

    const TABS = [
        { key: 'all', label: 'All', count: screens.length + pendingScreens.length + draftScreens.length + blockedScreens.length + resubmittedScreens.length },
        { key: 'pending', label: 'Pending Review', count: pendingScreens.length },
        { key: 'resubmitted', label: 'Resubmitted', count: resubmittedScreens.length, highlight: true },
        { key: 'draft', label: 'Draft', count: draftScreens.length },
        { key: 'blocked', label: 'Blocked', count: blockedScreens.length },
    ];

    return (
        <div className="p-2 sm:p-4 md:p-6 space-y-8 bg-white min-h-screen">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Screen Inventory</h1>
                    <p className="text-sm font-bold text-slate-500 mt-1">Manage and profile all screens in your network</p>
                </div>
                <button
                    onClick={() => navigate('/console/screens/onboard')}
                    className="bg-blue-600 text-white px-5 py-2 text-sm font-bold cursor-pointer flex items-center gap-2"
                >
                    Add Screen
                </button>
            </header>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white border border-slate-100 p-5 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-transform hover:scale-[1.02]">
                        <p className="text-[14px] font-bold mb-3">{stat.label}</p>
                        <p className={`text-3xl mt-2 font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-100">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${activeTab === tab.key
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${tab.highlight && tab.count > 0
                                ? 'bg-violet-100 text-violet-700'
                                : activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                } ${tab.key === 'blocked' && tab.count > 0 ? 'bg-red-100 text-red-700' : ''}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search Screens"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 text-sm font-bold text-slate-700 shadow-sm transition-all"
                    />
                </div>
                <div className="relative min-w-[180px]">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl focus:outline-none focus:border-blue-500 text-sm font-bold text-slate-600 appearance-none cursor-pointer shadow-sm shadow-slate-100"
                    >
                        <option value="">All Status</option>
                        <option value="Verified">Verified</option>
                        <option value="Review Pending">Review Pending</option>
                        <option value="Pending">Pending</option>
                        <option value="Resubmitted">Resubmitted</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Draft">Draft</option>
                        <option value="Blocked">Blocked</option>
                        <option value="Scheduled Block">Scheduled Block</option>
                        <option value="Profiled">Profiled</option>
                        <option value="Reprofile">Reprofile</option>
                        <option value="UnProfiled">UnProfiled</option>
                    </select>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                </div>
            </div>

            {/* Inventory Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="px-6 py-4 text-[11px]">Id <span className="ml-1 text-[8px]">⇅</span></th>
                            <th className="px-6 py-4 text-[11px]">Screen <span className="ml-1 text-[8px]">⇅</span></th>
                            <th className="px-6 py-4 text-[11px]">City <span className="ml-1 text-[8px]">⇅</span></th>
                            <th className="px-6 py-4 text-[11px]">Ownership <span className="ml-1 text-[8px]">⇅</span></th>
                            <th className="px-6 py-4 text-[11px] text-center">Status <span className="ml-1 text-[8px]">⇅</span></th>
                            <th className="px-6 py-4 text-[11px] text-center">Profile <span className="ml-1 text-[8px]">⇅</span></th>
                            <th className="px-6 py-4 text-[11px]">Block Date <span className="ml-1 text-[8px]">⇅</span></th>
                            <th className="px-6 py-4 text-[11px]">Added at <span className="ml-1 text-[8px]">⇅</span></th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={9} className="px-6 py-6 border-b border-slate-50 bg-slate-50/20"></td>
                                </tr>
                            ))
                        ) : filteredScreens.length > 0 ? (
                            filteredScreens.map((screen) => (
                                <tr
                                    key={screen.id}
                                    onClick={() => {
                                        if (screen.status === 'Draft') {
                                            navigate('/console/screens/onboard', { state: { draftData: { id: screen.id } } });
                                        } else if (screen.profile === 'Profiled' || screen.profile === 'Reprofile') {
                                            navigate(`/console/screens/profiled/${screen.id}`);
                                        } else {
                                            navigate(`/console/screens/unprofiled/${screen.id}`);
                                        }
                                    }}
                                    className={`group hover:bg-slate-50/50 transition-all cursor-pointer border-b border-slate-50 ${screen.status === 'Blocked' ? 'bg-red-50/30' :
                                        screen.status === 'Scheduled Block' ? 'bg-orange-50/30' : ''
                                        }`}
                                >
                                    <td className="px-6 py-6">
                                        <p className="text-xs font-bold text-slate-800 tracking-tight leading-none uppercase">{screen.displayId}</p>
                                    </td>
                                    <td className="px-6 py-6">
                                        <p className="text-sm font-bold text-slate-700 leading-tight">{screen.name}</p>
                                    </td>
                                    <td className="px-6 py-6">
                                        <p className="text-sm font-bold text-slate-800">{screen.city}</p>
                                    </td>
                                    <td className="px-6 py-6 font-bold text-slate-600 text-sm">
                                        {screen.ownership}
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold border ${getStatusStyle(screen.status)}`}>
                                            {screen.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className={`flex items-center justify-center gap-1.5 text-[9px] font-black ${screen.profile === 'Profiled' ? 'text-green-600' :
                                            screen.profile === 'Reprofile' ? 'text-amber-500' :
                                                'text-red-500'
                                            }`}>
                                            {screen.profile === 'Profiled' ? <Check size={12} strokeWidth={3} /> :
                                                screen.profile === 'Reprofile' ? <AlertCircle size={12} /> :
                                                    <span className="text-sm">×</span>}
                                            {screen.profile}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        {screen.scheduledBlockDate ? (
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                                {new Date(screen.scheduledBlockDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-6">
                                        <p className="text-sm font-bold text-slate-800">{screen.addedAt}</p>
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {screen.status === 'Draft' && (
                                                <button
                                                    title="Delete Draft"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Delete draft "${screen.name}"? This cannot be undone.`)) {
                                                            axios.delete(`/api/console/screens/external-submit/${screen.id}/`)
                                                                .then(() => fetchData())
                                                                .catch(err => {
                                                                    console.error('Delete failed:', err);
                                                                    alert('Failed to delete draft.');
                                                                });
                                                        }
                                                    }}
                                                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            <ChevronRight size={18} strokeWidth={1.5} className="text-slate-300 group-hover:text-blue-500 transition-colors inline-block" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={9} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="bg-slate-50 p-4 rounded-full text-slate-300">
                                            <Activity size={32} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-400">No matching screens found</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ScreensListPage;
