import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, CheckCircle, XCircle, Radio, Monitor, MapPin,
    ChevronRight, Loader2, RefreshCw, User, Calendar, Hash,
    ArrowLeft, Layers, Eye, Clock, Zap, Signal, Play,
    Pause, AlertTriangle, FileVideo, FileImage, ExternalLink, Download
} from 'lucide-react';
import api from '../utils/api';
import axios from 'axios';

// ─── Dashboard API (Platform backend - Studio routes) ───
const dashboardApi = axios.create({
    baseURL: '/api/studio/',
    headers: { 'Content-Type': 'application/json' },
});

const CampaignLivePage = () => {
    // ─── STATE ───
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Drill-down levels
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [selectedScreen, setSelectedScreen] = useState(null);
    const [screenSpecs, setScreenSpecs] = useState({});
    const [assets, setAssets] = useState([]);
    const [loadingScreens, setLoadingScreens] = useState(false);
    const [loadingAssets, setLoadingAssets] = useState(false);

    // Toast
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');

    // ─── FETCH CAMPAIGNS ───
    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const res = await dashboardApi.get('dashboard/overview/');
            const allCampaigns = res.data?.data?.campaigns || [];
            setCampaigns(allCampaigns);
        } catch (err) {
            console.error('Failed to fetch campaigns', err);
        } finally {
            setLoading(false);
        }
    };

    // ─── FETCH SCREEN SPECS ───
    const fetchScreenSpecs = async (campaign) => {
        setLoadingScreens(true);
        const screenIds = Object.keys(campaign.booked_screens || {});
        const specsMap = {};
        for (const sid of screenIds) {
            try {
                const res = await api.get(`/screen-specs/${sid}/`);
                specsMap[sid] = res.data;
            } catch { specsMap[sid] = {}; }
        }
        setScreenSpecs(specsMap);
        setLoadingScreens(false);
    };

    // ─── FETCH ASSETS ───
    const fetchAssets = async (campaignId) => {
        setLoadingAssets(true);
        try {
            const res = await api.get(`/campaign-assets/?campaign_id=${campaignId}`);
            setAssets(res.data?.results || res.data || []);
        } catch (err) {
            console.error('Failed to fetch assets', err);
            setAssets([]);
        } finally {
            setLoadingAssets(false);
        }
    };

    // ─── HELPERS ───
    const showToast = (msg, type = 'success') => {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(''), 3000);
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '—';
        if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / 1024).toFixed(0)} KB`;
    };

    // ─── DRILL-DOWN ───
    const selectCampaign = (campaign) => {
        setSelectedCampaign(campaign);
        setSelectedScreen(null);
        fetchScreenSpecs(campaign);
        fetchAssets(campaign.campaign_id);
    };

    const drillIntoScreen = (screenId, spec) => {
        setSelectedScreen({ id: screenId, ...spec });
    };

    const goBackToCampaigns = () => {
        setSelectedCampaign(null);
        setSelectedScreen(null);
        setAssets([]);
    };

    const goBackToScreens = () => {
        setSelectedScreen(null);
    };

    // ─── FILTER: Only campaigns with approved assets on xigi/franchise screens ───
    const liveCampaigns = useMemo(() => {
        const q = searchTerm.toLowerCase();
        return campaigns.filter(c =>
            c.status !== 'draft' && (
                !q ||
                c.campaign_id?.toLowerCase().includes(q) ||
                c.campaign_name?.toLowerCase().includes(q) ||
                c.location?.toLowerCase().includes(q)
            )
        );
    }, [campaigns, searchTerm]);

    // Group campaigns by user
    const groupedCampaigns = useMemo(() => {
        const groups = {};
        liveCampaigns.forEach(c => {
            const uid = c.user || 'unknown';
            if (!groups[uid]) groups[uid] = [];
            groups[uid].push(c);
        });
        return groups;
    }, [liveCampaigns]);

    const getUserInfo = (userCampaigns) => {
        const info = userCampaigns?.[0]?.user_info;
        return info || { name: 'Unknown', company: '—', email: '—' };
    };

    // ─── Screen-level stats ───
    const getScreenAssets = (screenId) => {
        return assets.filter(a => String(a.screen_id) === String(screenId));
    };

    const getScreenLiveStats = (screenId) => {
        const screenAssets = getScreenAssets(screenId);
        const approved = screenAssets.filter(a => a.status === 'approved');
        const live = screenAssets.filter(a => a.status === 'live');
        const total = screenAssets.length;
        return { approved: approved.length, live: live.length, total, pending: total - approved.length - live.length };
    };

    // ─── Handle Go Live ───
    const handleGoLive = async (asset) => {
        try {
            await api.patch(`/campaign-assets/?asset_id=${asset.id}`, { status: 'live' });
            showToast(`Asset #${asset.id} is now LIVE!`);
            // Refresh assets
            if (selectedCampaign) {
                fetchAssets(selectedCampaign.campaign_id);
            }
        } catch (err) {
            showToast('Failed to push live', 'error');
            console.error(err);
        }
    };

    // ───────────────────────────────────────────────
    // RENDER
    // ───────────────────────────────────────────────
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20 relative">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className={`fixed top-24 left-1/2 px-6 py-3 rounded-none shadow-xl z-[100] flex items-center gap-3 font-medium text-sm ${toastType === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}
                    >
                        {toastType === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} className="text-green-400" />}
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════ */}
            {/* LEVEL 1 — CAMPAIGN LIST                    */}
            {/* ═══════════════════════════════════════════ */}
            {!selectedCampaign && (
                <>
                    <header className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Radio size={22} className="text-violet-600" />
                                Campaign Live
                            </h1>
                            <p className="text-xs text-slate-500 mt-1">Push approved creatives live on Xigi & Franchise screens</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search campaigns..."
                                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-none text-xs bg-white focus:outline-none focus:border-violet-500 w-64"
                                />
                            </div>
                            <button onClick={fetchCampaigns} className="p-2 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors rounded-none">
                                <RefreshCw size={14} className="text-slate-500" />
                            </button>
                        </div>
                    </header>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-slate-400" />
                            <span className="ml-3 text-sm text-slate-500">Loading campaigns...</span>
                        </div>
                    ) : Object.keys(groupedCampaigns).length === 0 ? (
                        <div className="text-center py-20">
                            <Radio size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500">No campaigns found</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedCampaigns).map(([userId, userCampaigns]) => {
                                const uInfo = getUserInfo(userCampaigns);
                                return (
                                    <div key={userId}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-7 h-7 bg-violet-100 rounded-none flex items-center justify-center">
                                                <User size={14} className="text-violet-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">{uInfo.name}</p>
                                                <p className="text-[10px] text-slate-400">{uInfo.company}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {userCampaigns.map(campaign => (
                                                <motion.div
                                                    key={campaign.campaign_id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    onClick={() => selectCampaign(campaign)}
                                                    className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md hover:border-violet-200 transition-all group"
                                                >
                                                    <div className="p-5">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <h3 className="font-bold text-slate-800 text-sm group-hover:text-violet-700 transition-colors">{campaign.campaign_name}</h3>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">{campaign.campaign_id}</p>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-2 py-1 border ${campaign.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                                {campaign.status}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-3 text-xs text-slate-500 mt-3">
                                                            <div>
                                                                <p className="text-[10px] text-slate-400">Location</p>
                                                                <p className="font-bold text-slate-700 text-xs">{campaign.location || '—'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-slate-400">Screens</p>
                                                                <p className="font-bold text-slate-700 text-xs">{Object.keys(campaign.booked_screens || {}).length}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-slate-400">Dates</p>
                                                                <p className="font-bold text-slate-700 text-[10px]">{campaign.start_date} → {campaign.end_date}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                                                        <span className="text-[10px] font-bold text-violet-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                                                            View Screens <ChevronRight size={12} />
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* LEVEL 2 — SCREENS IN CAMPAIGN              */}
            {/* ═══════════════════════════════════════════ */}
            {selectedCampaign && !selectedScreen && (
                <>
                    <header>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={goBackToCampaigns}
                                className="p-2 bg-white border border-slate-200 rounded-none hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                                <ArrowLeft size={16} className="text-slate-600" />
                            </button>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                                    <span className="cursor-pointer hover:text-violet-600" onClick={goBackToCampaigns}>Campaign Live</span>
                                    <ChevronRight size={10} />
                                    <span className="text-slate-600 font-bold">{selectedCampaign.campaign_id}</span>
                                </div>
                                <h1 className="text-lg font-bold text-slate-800">{selectedCampaign.campaign_name}</h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {selectedCampaign.user_info?.name || `User ${selectedCampaign.user}`} · {selectedCampaign.user_info?.company || ''} · {selectedCampaign.location} · {selectedCampaign.start_date} → {selectedCampaign.end_date}
                                </p>
                            </div>
                        </div>
                    </header>

                    {loadingScreens ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-slate-400" />
                            <span className="ml-3 text-sm text-slate-500">Loading screens...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {Object.entries(selectedCampaign.booked_screens || {}).map(([screenId, slotCount], idx) => {
                                const spec = screenSpecs[screenId] || {};
                                const price = selectedCampaign.price_snapshot?.[screenId];
                                const liveStats = getScreenLiveStats(screenId);
                                const isXigiOrFranchise = spec.role === 'xigi' || spec.role === 'franchise';

                                return (
                                    <motion.div
                                        key={screenId}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.08 }}
                                        onClick={() => drillIntoScreen(screenId, spec)}
                                        className={`bg-white rounded-none shadow-sm border overflow-hidden cursor-pointer hover:shadow-md transition-all group ${isXigiOrFranchise ? 'border-violet-100 hover:border-violet-300' : 'border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className="p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-none flex items-center justify-center ${isXigiOrFranchise ? 'bg-violet-50' : 'bg-blue-50'}`}>
                                                        <Monitor size={18} className={isXigiOrFranchise ? 'text-violet-600' : 'text-blue-600'} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-800 text-sm group-hover:text-violet-700 transition-colors">{spec.screen_name || `Screen ${screenId}`}</h3>
                                                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <MapPin size={10} /> {spec.city || '—'} · {spec.environment || ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {spec.role && (
                                                        <span className={`text-[10px] font-bold px-2 py-1 border ${spec.role === 'xigi' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                                                            spec.role === 'franchise' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                'bg-blue-50 text-blue-700 border-blue-200'
                                                            }`}>
                                                            {spec.role === 'xigi' ? 'Xigi' : spec.role === 'partner' ? 'Partner' : 'Franchise'}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 border border-slate-100">ID: {screenId}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 text-xs text-slate-500 mb-3">
                                                <div>
                                                    <p className="text-[10px] text-slate-400">Slots Booked</p>
                                                    <p className="font-bold text-slate-700">{slotCount}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400">Resolution</p>
                                                    <p className="font-bold text-slate-700">
                                                        {spec.resolution_width && spec.resolution_height ? `${spec.resolution_width}×${spec.resolution_height}` : '—'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400">Price/Slot</p>
                                                    <p className="font-bold text-slate-700">{price ? `₹${price}` : '—'}</p>
                                                </div>
                                            </div>

                                            {/* Live Status */}
                                            {liveStats.total > 0 && (
                                                <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-100">
                                                    {liveStats.live > 0 && (
                                                        <span className="text-[10px] font-bold text-violet-700 flex items-center gap-1">
                                                            <Radio size={10} className="text-violet-500" /> {liveStats.live} Live
                                                        </span>
                                                    )}
                                                    {liveStats.approved > 0 && (
                                                        <span className="text-[10px] font-bold text-green-700 flex items-center gap-1">
                                                            <CheckCircle size={10} className="text-green-500" /> {liveStats.approved} Approved
                                                        </span>
                                                    )}
                                                    {liveStats.pending > 0 && (
                                                        <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                                                            <Clock size={10} className="text-amber-500" /> {liveStats.pending} Pending
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {!isXigiOrFranchise && (
                                                <div className="mt-3 p-2 bg-blue-50 border border-blue-100 text-center">
                                                    <p className="text-[10px] text-blue-600 font-medium">Partner screen — managed by partner</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                                            <span className="text-[10px] font-bold text-violet-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                                                View Slots <ChevronRight size={12} />
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* LEVEL 3 — ASSETS / SLOTS FOR A SCREEN      */}
            {/* ═══════════════════════════════════════════ */}
            {selectedCampaign && selectedScreen && (
                <>
                    <header>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={goBackToScreens}
                                className="p-2 bg-white border border-slate-200 rounded-none hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                                <ArrowLeft size={16} className="text-slate-600" />
                            </button>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                                    <span className="cursor-pointer hover:text-violet-600" onClick={goBackToCampaigns}>Campaign Live</span>
                                    <ChevronRight size={10} />
                                    <span className="cursor-pointer hover:text-violet-600" onClick={goBackToScreens}>{selectedCampaign.campaign_id}</span>
                                    <ChevronRight size={10} />
                                    <span className="text-slate-600 font-bold">{selectedScreen.screen_name || `Screen ${selectedScreen.id}`}</span>
                                </div>
                                <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    {selectedScreen.screen_name || `Screen ${selectedScreen.id}`}
                                    {selectedScreen.role && (
                                        <span className={`text-[10px] font-bold px-2 py-1 border ${selectedScreen.role === 'xigi' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                                            selectedScreen.role === 'franchise' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                            {selectedScreen.role === 'xigi' ? 'Xigi' : selectedScreen.role === 'partner' ? 'Partner' : 'Franchise'}
                                        </span>
                                    )}
                                </h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    <MapPin size={10} className="inline" /> {selectedScreen.city || '—'} · {selectedScreen.environment || ''}
                                </p>
                            </div>
                        </div>
                    </header>

                    {loadingAssets ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-slate-400" />
                            <span className="ml-3 text-sm text-slate-500">Loading assets...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {getScreenAssets(selectedScreen.id).map((asset, idx) => {
                                const hasFile = !!asset.file;
                                const isApproved = asset.status === 'approved';
                                const isLive = asset.status === 'live';
                                const isXigiOrFranchise = selectedScreen.role === 'xigi' || selectedScreen.role === 'franchise';
                                const isVideo = asset.file_type?.startsWith('video');

                                return (
                                    <motion.div
                                        key={asset.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.06 }}
                                        className={`bg-white rounded-none shadow-sm border overflow-hidden ${isLive ? 'border-violet-300 ring-1 ring-violet-100' :
                                            isApproved ? 'border-green-200' :
                                                'border-slate-100'
                                            }`}
                                    >
                                        {/* Asset Preview */}
                                        <div className="aspect-video bg-slate-900 relative overflow-hidden">
                                            {hasFile ? (
                                                isVideo ? (
                                                    <video src={asset.file} className="w-full h-full object-cover" muted />
                                                ) : (
                                                    <img src={asset.file} alt="" className="w-full h-full object-cover" />
                                                )
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                                                    <FileImage size={24} className="mb-1" />
                                                    <span className="text-[10px]">No file uploaded</span>
                                                </div>
                                            )}

                                            {/* Status Badge */}
                                            <div className="absolute top-2 left-2">
                                                {isLive ? (
                                                    <span className="text-[10px] font-bold px-2.5 py-1 bg-violet-600 text-white flex items-center gap-1 shadow-lg">
                                                        <Radio size={10} className="animate-pulse" /> LIVE
                                                    </span>
                                                ) : isApproved ? (
                                                    <span className="text-[10px] font-bold px-2.5 py-1 bg-green-600 text-white flex items-center gap-1">
                                                        <CheckCircle size={10} /> Approved
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold px-2.5 py-1 bg-amber-500 text-white flex items-center gap-1">
                                                        <Clock size={10} /> Pending
                                                    </span>
                                                )}
                                            </div>

                                            {/* Slot Badge */}
                                            <div className="absolute top-2 right-2">
                                                <span className="text-[10px] font-bold px-2 py-1 bg-black/60 text-white backdrop-blur-sm">
                                                    Slot {asset.slot_number}
                                                </span>
                                            </div>

                                            {/* File info */}
                                            {hasFile && (
                                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 backdrop-blur-md font-medium">
                                                    {asset.file_extension?.toUpperCase() || '—'} · {formatFileSize(asset.file_size_bytes)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Asset Info */}
                                        <div className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">Asset #{asset.id}</p>
                                                    <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{asset.original_filename || 'No file'}</p>
                                                </div>
                                                {asset.detected_width && asset.detected_height && (
                                                    <span className="text-[10px] text-slate-500 font-mono">{asset.detected_width}×{asset.detected_height}</span>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            {isXigiOrFranchise ? (
                                                <div className="flex gap-2">
                                                    {isLive ? (
                                                        <div className="flex-1 py-2.5 font-bold text-xs rounded-none flex items-center justify-center gap-2 bg-violet-600 text-white">
                                                            <Radio size={14} className="animate-pulse" /> Currently Live
                                                        </div>
                                                    ) : isApproved ? (
                                                        <button
                                                            onClick={() => handleGoLive(asset)}
                                                            className="flex-1 py-2.5 font-bold text-xs rounded-none flex items-center justify-center gap-2 bg-violet-600 text-white hover:bg-violet-700 cursor-pointer transition-all shadow-lg shadow-violet-500/20"
                                                        >
                                                            <Radio size={14} /> Go to Live
                                                        </button>
                                                    ) : (
                                                        <div className="flex-1 py-2.5 font-bold text-xs rounded-none flex items-center justify-center gap-2 bg-slate-100 text-slate-400">
                                                            <Clock size={14} /> Awaiting Approval
                                                        </div>
                                                    )}
                                                    {hasFile && (
                                                        <a
                                                            href={asset.file}
                                                            download={asset.original_filename || 'download'}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-4 py-2.5 font-bold text-xs rounded-none flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-900 cursor-pointer transition-all"
                                                        >
                                                            <Download size={14} />
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-full py-2.5 font-bold text-xs rounded-none flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border border-blue-200">
                                                    <Signal size={14} /> Partner Managed
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loadingAssets && getScreenAssets(selectedScreen.id).length === 0 && (
                        <div className="text-center py-20">
                            <Layers size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500">No assets found for this screen</p>
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
};

export default CampaignLivePage;
