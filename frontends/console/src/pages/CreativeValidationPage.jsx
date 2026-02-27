import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, CheckCircle, XCircle, AlertTriangle, Eye, Clock,
    FileVideo, FileImage, X, Check, ShieldCheck,
    ShieldAlert, Monitor, MapPin, Tag, ChevronRight, ChevronLeft,
    AlertOctagon, Loader2, RefreshCw, User, Layers, DollarSign,
    Calendar, Hash, ArrowLeft, Upload, Radio, Download
} from 'lucide-react';
import api from '../utils/api';
import axios from 'axios';
import { generateDeploymentPdf } from '../utils/generateDeploymentPdf';

// ─── Dashboard API (Platform backend - Studio routes) ───
const dashboardApi = axios.create({
    baseURL: '/api/studio/',
    timeout: 10000,
});

// ─── Build dynamic policy checks from screen tags ───
const buildPolicyChecks = (screenData) => {
    const checks = [];
    const restricted = screenData?.restricted_categories_json || [];
    const sensitive = screenData?.sensitive_zone_flags_json || [];

    restricted.forEach(cat => {
        checks.push({
            key: `restricted:${cat}`,
            type: 'restricted',
            label: cat,
            desc: `This ad does NOT contain ${cat.toLowerCase()} content`,
        });
    });

    sensitive.forEach(zone => {
        checks.push({
            key: `sensitive:${zone}`,
            type: 'sensitive',
            label: zone,
            desc: `This ad is suitable to play near ${zone.toLowerCase()}`,
        });
    });

    return checks;
};

// ─── Helper: format bytes ───
const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

// ─── Helper: file icon ───
const getFileIcon = (ext) => {
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
    return videoExts.includes(ext?.toLowerCase()) ? FileVideo : FileImage;
};

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
const CreativeValidationQueue = () => {
    const navigate = useNavigate();
    // View state: 'campaigns' | 'screens' | 'assets'
    const [view, setView] = useState('campaigns');

    // Data
    const [campaigns, setCampaigns] = useState([]);

    const [loading, setLoading] = useState(true);
    const [assetStats, setAssetStats] = useState({}); // { campaign_id: { pending, approved, rejected, total } }
    const [screenStats, setScreenStats] = useState({}); // { 'campaign_id:screen_id': { pending, approved, rejected, total } }
    const [searchTerm, setSearchTerm] = useState('');

    // Drill-down context
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [screenSpecs, setScreenSpecs] = useState({});
    const [loadingScreens, setLoadingScreens] = useState(false);

    const [selectedScreen, setSelectedScreen] = useState(null);
    const [assets, setAssets] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(false);

    // Policy drawer
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null); // all assets in the group
    const [policyChecks, setPolicyChecks] = useState({});
    const [policyNote, setPolicyNote] = useState('');
    const [dynamicChecks, setDynamicChecks] = useState([]);
    const [approving, setApproving] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    // Toast
    const [toast, setToast] = useState(null);
    const [toastType, setToastType] = useState('success');

    const showToast = (msg, type = 'success') => {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(null), 3500);
    };

    // ─── Fetch campaigns + users on mount ───
    useEffect(() => { fetchCampaigns(); }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const [dashRes, assetsRes] = await Promise.all([
                dashboardApi.get('dashboard/overview/'),
                api.get('campaign-assets/'),
            ]);

            const campaignData = dashRes.data?.data?.campaigns || [];
            setCampaigns(campaignData);

            // Build per-campaign and per-screen validation stats
            const stats = {};
            const sStats = {};
            const allAssets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
            allAssets.forEach(a => {
                const cid = a.campaign_id;
                const sid = a.screen_id;
                const isResub = a.is_resubmission && a.status === 'uploaded';
                // Per-campaign
                if (!stats[cid]) stats[cid] = { pending: 0, approved: 0, rejected: 0, resubmitted: 0, total: 0, noFile: 0 };
                stats[cid].total++;
                if (a.status === 'approved') stats[cid].approved++;
                else if (a.validation_status === 'failed') stats[cid].rejected++;
                else if (!a.file) stats[cid].noFile++;
                else if (isResub) stats[cid].resubmitted++;
                else stats[cid].pending++;
                // Per-screen
                const key = `${cid}:${sid}`;
                if (!sStats[key]) sStats[key] = { pending: 0, approved: 0, rejected: 0, resubmitted: 0, total: 0, noFile: 0 };
                sStats[key].total++;
                if (a.status === 'approved') sStats[key].approved++;
                else if (a.validation_status === 'failed') sStats[key].rejected++;
                else if (!a.file) sStats[key].noFile++;
                else if (isResub) sStats[key].resubmitted++;
                else sStats[key].pending++;
            });
            setAssetStats(stats);
            setScreenStats(sStats);
        } catch (err) {
            console.error('Error fetching campaigns:', err);
            showToast('Failed to load campaigns', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ─── Drill into campaign → fetch screen specs ───
    const drillIntoCampaign = async (campaign) => {
        setSelectedCampaign(campaign);
        setView('screens');
        setSearchTerm('');
        setLoadingScreens(true);

        const screenIds = Object.keys(campaign.booked_screens || {});
        const specs = {};

        try {
            // Fetch each screen spec
            const requests = screenIds.map(id =>
                api.get(`screen-specs/${id}/`).then(res => {
                    specs[id] = res.data;
                }).catch(() => {
                    specs[id] = { id, screen_name: `Screen ${id}`, city: '—' };
                })
            );
            await Promise.all(requests);
        } catch (err) {
            console.error('Error fetching screen specs:', err);
        }

        setScreenSpecs(specs);
        setLoadingScreens(false);
    };

    // ─── Drill into screen → fetch assets ───
    const drillIntoScreen = async (screenId, screenData) => {
        setSelectedScreen({ id: screenId, ...screenData });
        setView('assets');
        setSearchTerm('');
        setLoadingAssets(true);

        try {
            const res = await api.get(`campaign-assets/?campaign_id=${selectedCampaign.campaign_id}&screen_id=${screenId}`);
            setAssets(res.data);
        } catch (err) {
            console.error('Error fetching assets:', err);
            showToast('Failed to load assets', 'error');
        } finally {
            setLoadingAssets(false);
        }
    };

    // ─── Navigate back ───
    const goBackToScreens = () => {
        setView('screens');
        setSelectedScreen(null);
        setAssets([]);
        setSearchTerm('');
    };

    const goBackToCampaigns = () => {
        setView('campaigns');
        setSelectedCampaign(null);
        setScreenSpecs({});
        setSelectedScreen(null);
        setAssets([]);
        setSearchTerm('');
    };

    // ─── Policy review drawer ───
    const openPolicyDrawer = (group) => {
        // group = { assets: [...], slots: [...], representative: asset }
        const asset = group.representative;
        setSelectedAsset(asset);
        setSelectedGroup(group);
        // Build dynamic checks from screen data
        const checks = buildPolicyChecks(selectedScreen);
        setDynamicChecks(checks);

        const checkState = {};
        if (asset.status === 'approved') {
            checks.forEach(c => { checkState[c.key] = true; });
        } else if (asset.validation_status === 'failed' && asset.validation_errors?.policy_failures) {
            const failures = asset.validation_errors.policy_failures;
            checks.forEach(c => {
                checkState[c.key] = failures.includes(c.label) ? false : null;
            });
        } else {
            checks.forEach(c => { checkState[c.key] = null; });
        }
        setPolicyChecks(checkState);
        setPolicyNote(asset.validation_errors?.note || '');
    };

    const closePolicyDrawer = () => {
        setSelectedAsset(null);
        setSelectedGroup(null);
        setPolicyChecks({});
        setPolicyNote('');
    };

    const isAlreadyReviewed = selectedAsset?.status === 'approved' || selectedAsset?.validation_status === 'failed';

    const allChecksReviewed = Object.values(policyChecks).every(v => v !== null);
    const allChecksPassed = Object.values(policyChecks).every(v => v === true);
    const hasFailedChecks = Object.values(policyChecks).some(v => v === false);

    const handleApprove = async () => {
        if (!selectedGroup) return;
        setApproving(true);
        try {
            // Approve ALL assets in the group (same video across slots)
            await Promise.all(selectedGroup.assets.map(a =>
                api.patch('campaign-assets/', {
                    asset_id: a.id,
                    status: 'approved',
                    validation_status: 'passed',
                    validation_errors: null,
                })
            ));
            const slotLabel = selectedGroup.slots.join(', ');
            showToast(`Slots ${slotLabel} approved — pushed to live`);
            drillIntoScreen(selectedScreen.id, selectedScreen);
            closePolicyDrawer();
        } catch (err) {
            showToast('Failed to approve', 'error');
        } finally {
            setApproving(false);
        }
    };

    const handleReject = async () => {
        if (!selectedGroup) return;
        setRejecting(true);
        const failedChecks = dynamicChecks.filter(c => policyChecks[c.key] === false).map(c => c.label);
        try {
            // Reject ALL assets in the group
            await Promise.all(selectedGroup.assets.map(a =>
                api.patch('campaign-assets/', {
                    asset_id: a.id,
                    status: 'validated',
                    validation_status: 'failed',
                    validation_errors: { policy_failures: failedChecks, note: policyNote || null },
                })
            ));
            const slotLabel = selectedGroup.slots.join(', ');
            showToast(`Slots ${slotLabel} rejected`, 'error');
            drillIntoScreen(selectedScreen.id, selectedScreen);
            closePolicyDrawer();
        } catch (err) {
            showToast('Failed to reject', 'error');
        } finally {
            setRejecting(false);
        }
    };

    // ─── Group assets by file (same video = one card) ───
    const groupedAssets = useMemo(() => {
        const groups = {};
        assets.forEach(a => {
            // Group key: same original filename + same file size = same video
            // Assets with no file get their own individual card
            const key = a.file ? `${a.original_filename}::${a.file_size_bytes}` : `nofile_${a.id}`;
            if (!groups[key]) {
                groups[key] = { representative: a, assets: [], slots: [] };
            }
            groups[key].assets.push(a);
            groups[key].slots.push(a.slot_number);
        });
        // Sort slots within each group
        Object.values(groups).forEach(g => g.slots.sort((a, b) => a - b));
        return Object.values(groups);
    }, [assets]);

    // ─── Grouped campaigns by user ───
    const groupedCampaigns = useMemo(() => {
        const q = searchTerm.toLowerCase();
        const filtered = campaigns.filter(c =>
            c.status !== 'draft' && (
                !q ||
                c.campaign_id?.toLowerCase().includes(q) ||
                c.campaign_name?.toLowerCase().includes(q) ||
                c.location?.toLowerCase().includes(q)
            )
        );

        const groups = {};
        filtered.forEach(c => {
            const uid = c.user || 'unknown';
            if (!groups[uid]) groups[uid] = [];
            groups[uid].push(c);
        });
        return groups;
    }, [campaigns, searchTerm]);

    // Extract user_info from the first campaign in the group
    const getUserInfo = (userCampaigns) => {
        const info = userCampaigns?.[0]?.user_info;
        return info || { name: 'Unknown', company: '—', email: '—' };
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 border-green-200';
            case 'draft': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-amber-100 text-amber-700 border-amber-200';
        }
    };

    const getAssetBadge = (asset) => {
        if (asset.status === 'approved') return { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-200' };
        if (asset.validation_status === 'failed') return { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200' };
        if (asset.is_resubmission && asset.status === 'uploaded') return { label: 'Resubmitted for Review', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
        if (asset.status === 'uploaded') return { label: 'Pending Review', color: 'bg-amber-100 text-amber-700 border-amber-200' };
        if (asset.status === 'validated') return { label: 'Validated', color: 'bg-blue-100 text-blue-700 border-blue-200' };
        return { label: asset.status || 'Pending', color: 'bg-slate-100 text-slate-600 border-slate-200' };
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
            {/* LEVEL 1: CAMPAIGNS (grouped by advertiser)  */}
            {/* ═══════════════════════════════════════════ */}
            {view === 'campaigns' && (
                <>
                    <header className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Creative Policy Validation</h1>
                                <p className="text-xs text-slate-500 mt-1">Select a campaign to review uploaded ads for policy compliance.</p>
                            </div>
                            <button
                                onClick={fetchCampaigns}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-none text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                            >
                                <RefreshCw size={14} /> Refresh
                            </button>
                        </div>

                        {/* Search */}
                        <div className="bg-white p-3 rounded-none shadow-sm border border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search by campaign name, ID, or location..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-all"
                                />
                            </div>
                        </div>
                    </header>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-slate-400" />
                            <span className="ml-3 text-sm text-slate-500">Loading campaigns...</span>
                        </div>
                    ) : Object.keys(groupedCampaigns).length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-none border border-slate-100 shadow-sm">
                            <Layers size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500 font-medium">No campaigns found</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedCampaigns).map(([userId, userCampaigns]) => (
                                <div key={userId}>
                                    {/* Advertiser Header */}
                                    {(() => {
                                        const info = getUserInfo(userCampaigns);
                                        return (
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-9 h-9 bg-slate-800 rounded-none flex items-center justify-center">
                                                    <User size={16} className="text-white" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h2 className="text-sm font-bold text-slate-800">{info.name}</h2>
                                                        <span className="text-[10px] text-slate-400">·</span>
                                                        <span className="text-[10px] text-slate-500 font-medium">{info.company}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400">{info.email} · {userCampaigns.length} campaign{userCampaigns.length > 1 ? 's' : ''}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Campaign Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {userCampaigns.map((campaign, idx) => {
                                            const screenCount = Object.keys(campaign.booked_screens || {}).length;
                                            const stats = assetStats[campaign.campaign_id] || { pending: 0, approved: 0, rejected: 0, resubmitted: 0, total: 0, noFile: 0 };
                                            const needsAttention = stats.pending > 0 || stats.rejected > 0 || stats.resubmitted > 0;
                                            return (
                                                <motion.div
                                                    key={campaign.campaign_id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    onClick={() => drillIntoCampaign(campaign)}
                                                    className={`bg-white rounded-none shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all group ${needsAttention ? 'border-amber-200 hover:border-amber-300' : 'border-slate-100 hover:border-slate-200'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{campaign.campaign_name}</h3>
                                                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{campaign.campaign_id}</p>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${getStatusColor(campaign.status)}`}>
                                                            {campaign.status}
                                                        </span>
                                                    </div>

                                                    {/* Location */}
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                                                        <MapPin size={12} className="text-slate-400 shrink-0" />
                                                        <span className="truncate">{campaign.location}</span>
                                                    </div>

                                                    {/* Date Range */}
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                                                        <Calendar size={12} className="text-slate-400 shrink-0" />
                                                        <span>{campaign.start_date} → {campaign.end_date}</span>
                                                    </div>

                                                    {/* Screens, Slots & Budget Row */}
                                                    <div className="grid grid-cols-3 gap-2 mb-3 py-2.5 px-3 bg-slate-50 border border-slate-100">
                                                        <div className="text-center">
                                                            <p className="text-[10px] text-slate-400">Screens</p>
                                                            <p className="text-sm font-bold text-slate-700">{screenCount}</p>
                                                        </div>
                                                        <div className="text-center border-x border-slate-200">
                                                            <p className="text-[10px] text-slate-400">Slots</p>
                                                            <p className="text-sm font-bold text-slate-700">{campaign.total_slots_booked}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[10px] text-slate-400">Budget</p>
                                                            <p className="text-sm font-bold text-slate-700">₹{Number(campaign.total_budget).toLocaleString()}</p>
                                                        </div>
                                                    </div>

                                                    {/* Validation Status Bar */}
                                                    {stats.total > 0 ? (
                                                        <div className="flex items-center gap-2 mb-3 py-2 px-3 bg-slate-50 border border-slate-100">
                                                            {stats.pending > 0 && (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                                                    <Clock size={10} /> {stats.pending} Validation Pending
                                                                </span>
                                                            )}
                                                            {stats.approved > 0 && (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                                                                    <CheckCircle size={10} /> {stats.approved} approved
                                                                </span>
                                                            )}
                                                            {stats.resubmitted > 0 && (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600">
                                                                    <RefreshCw size={10} /> {stats.resubmitted} Resubmitted
                                                                </span>
                                                            )}
                                                            {stats.rejected > 0 && (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
                                                                    <XCircle size={10} /> {stats.rejected} rejected
                                                                </span>
                                                            )}
                                                            {stats.noFile > 0 && (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                                    <Upload size={10} /> {stats.noFile} no file
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 mb-3 py-2 px-3 bg-slate-50 border border-slate-100">
                                                            <span className="text-[10px] font-bold text-slate-400">No assets uploaded yet</span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                                                        <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                                            Review Screens <ChevronRight size={12} />
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* LEVEL 2: SCREENS (within a campaign)        */}
            {/* ═══════════════════════════════════════════ */}
            {view === 'screens' && selectedCampaign && (
                <>
                    <header className="space-y-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={goBackToCampaigns}
                                className="p-2 bg-white border border-slate-200 rounded-none hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                                <ArrowLeft size={16} className="text-slate-600" />
                            </button>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                                    <span className="cursor-pointer hover:text-blue-600" onClick={goBackToCampaigns}>Campaigns</span>
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
                                const sKey = `${selectedCampaign.campaign_id}:${screenId}`;
                                const sStat = screenStats[sKey] || { pending: 0, approved: 0, rejected: 0, resubmitted: 0, total: 0, noFile: 0 };
                                const needsAttention = sStat.pending > 0 || sStat.rejected > 0 || sStat.resubmitted > 0;

                                return (
                                    <motion.div
                                        key={screenId}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.08 }}
                                        onClick={() => drillIntoScreen(screenId, spec)}
                                        className={`bg-white rounded-none shadow-sm border overflow-hidden cursor-pointer hover:shadow-md transition-all group ${needsAttention ? 'border-amber-200 hover:border-amber-300' : 'border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        {/* Screen Header */}
                                        <div className="p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-50 rounded-none flex items-center justify-center">
                                                        <Monitor size={18} className="text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{spec.screen_name || `Screen ${screenId}`}</h3>
                                                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <MapPin size={10} /> {spec.city || '—'} · {spec.environment || ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {spec.role && (
                                                        <span className={`text-[10px] font-bold px-2 py-1 border ${spec.role === 'xigi' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                                                            spec.role === 'partner' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                'bg-amber-50 text-amber-700 border-amber-200'
                                                            }`}>
                                                            {spec.role === 'xigi' ? 'Xigi' : spec.role === 'partner' ? 'Partner' : 'Franchise'}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 border border-slate-100">ID: {screenId}</span>
                                                </div>
                                            </div>

                                            {/* Screen details */}
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

                                            {/* Validation Status */}
                                            {sStat.total > 0 ? (
                                                <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 border border-slate-100">
                                                    {sStat.pending > 0 && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                                            <Clock size={10} /> {sStat.pending} Validation Pending
                                                        </span>
                                                    )}
                                                    {sStat.approved > 0 && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                                                            <CheckCircle size={10} /> {sStat.approved} Approved
                                                        </span>
                                                    )}
                                                    {sStat.resubmitted > 0 && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600">
                                                            <RefreshCw size={10} /> {sStat.resubmitted} Resubmitted
                                                        </span>
                                                    )}
                                                    {sStat.rejected > 0 && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
                                                            <XCircle size={10} /> {sStat.rejected} Rejected
                                                        </span>
                                                    )}
                                                    {sStat.noFile > 0 && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                            <Upload size={10} /> {sStat.noFile} No File
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 border border-slate-100">
                                                    <span className="text-[10px] font-bold text-slate-400">No assets uploaded yet</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                                            <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
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
            {/* LEVEL 3: SLOTS & ASSETS (per screen)       */}
            {/* ═══════════════════════════════════════════ */}
            {view === 'assets' && selectedCampaign && selectedScreen && (
                <>
                    <header className="space-y-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={goBackToScreens}
                                className="p-2 bg-white border border-slate-200 rounded-none hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                                <ArrowLeft size={16} className="text-slate-600" />
                            </button>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                                    <span className="cursor-pointer hover:text-blue-600" onClick={goBackToCampaigns}>Campaigns</span>
                                    <ChevronRight size={10} />
                                    <span className="cursor-pointer hover:text-blue-600" onClick={goBackToScreens}>{selectedCampaign.campaign_id}</span>
                                    <ChevronRight size={10} />
                                    <span className="text-slate-600 font-bold">{selectedScreen.screen_name || `Screen ${selectedScreen.id}`}</span>
                                </div>
                                <h1 className="text-lg font-bold text-slate-800">
                                    {selectedScreen.screen_name || `Screen ${selectedScreen.id}`}
                                </h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {selectedCampaign.campaign_name} · {selectedScreen.city || '—'} · {selectedScreen.environment || '—'}
                                </p>
                            </div>
                        </div>

                        {/* Policy rules banner */}
                        {(selectedScreen.restricted_categories_json?.length > 0 || selectedScreen.sensitive_zone_flags_json?.length > 0) && (
                            <div className="bg-white p-4 rounded-none shadow-sm border border-slate-100">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Screen Policy Rules</h3>
                                <div className="flex flex-wrap gap-2">
                                    {(selectedScreen.restricted_categories_json || []).map((cat, i) => (
                                        <span key={`r-${i}`} className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold border border-red-100 flex items-center gap-1">
                                            <AlertOctagon size={10} /> {cat}
                                        </span>
                                    ))}
                                    {(selectedScreen.sensitive_zone_flags_json || []).map((flag, i) => (
                                        <span key={`s-${i}`} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100 flex items-center gap-1">
                                            <AlertTriangle size={10} /> {flag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </header>

                    {loadingAssets ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-slate-400" />
                            <span className="ml-3 text-sm text-slate-500">Loading slots...</span>
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-none border border-slate-100 shadow-sm">
                            <Upload size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500 font-medium">No assets uploaded for this screen yet</p>
                            <p className="text-xs text-slate-400 mt-1">Advertiser needs to upload creatives for these slots.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupedAssets.map((group, idx) => {
                                const asset = group.representative;
                                const badge = getAssetBadge(asset);
                                const FileIcon = getFileIcon(asset.file_extension);
                                const hasFile = !!asset.file;
                                const slotLabel = group.slots.length > 1
                                    ? `Slots ${group.slots.join(', ')}`
                                    : `Slot ${group.slots[0]}`;

                                return (
                                    <motion.div
                                        key={group.slots.join('-')}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden"
                                    >
                                        {/* Asset Preview */}
                                        <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
                                            {hasFile ? (
                                                asset.file_extension && ['mp4', 'avi', 'mov', 'webm'].includes(asset.file_extension.toLowerCase()) ? (
                                                    <video
                                                        src={`http://localhost:8000${asset.file}`}
                                                        className="w-full h-full object-contain"
                                                        muted
                                                    />
                                                ) : (
                                                    <img
                                                        src={`http://localhost:8000${asset.file}`}
                                                        alt="Asset"
                                                        className="w-full h-full object-contain"
                                                    />
                                                )
                                            ) : (
                                                <div className="text-center">
                                                    <FileIcon size={36} className="text-slate-600 mx-auto mb-1" />
                                                    <p className="text-[10px] text-slate-500">No file uploaded</p>
                                                </div>
                                            )}

                                            <div className="absolute top-3 left-3 flex items-center gap-1.5">
                                                <span className="bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 backdrop-blur-sm">
                                                    {slotLabel}
                                                </span>
                                                {group.slots.length > 1 && (
                                                    <span className="bg-blue-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 backdrop-blur-sm">
                                                        ×{group.slots.length}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="absolute top-3 right-3">
                                                <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border shadow-sm ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            {hasFile && (
                                                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] px-2 py-0.5 backdrop-blur-md font-medium">
                                                    {asset.file_extension?.toUpperCase()} · {formatFileSize(asset.file_size_bytes)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Asset Info */}
                                        <div className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">{slotLabel}</p>
                                                    <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{asset.original_filename || 'No file'}</p>
                                                </div>
                                                {asset.detected_width && asset.detected_height && (
                                                    <span className="text-[10px] text-slate-500 font-mono">{asset.detected_width}×{asset.detected_height}</span>
                                                )}
                                            </div>


                                            <div className={`flex ${(selectedScreen?.role === 'xigi' || selectedScreen?.role === 'franchise') ? 'gap-2' : ''}`}>
                                                <button
                                                    onClick={() => openPolicyDrawer(group)}
                                                    disabled={!hasFile}
                                                    className={`${(selectedScreen?.role === 'xigi' || selectedScreen?.role === 'franchise') ? 'flex-1' : 'w-full'} py-2.5 font-bold text-xs rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer ${!hasFile
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : asset.status === 'approved'
                                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                                            : asset.validation_status === 'failed'
                                                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                                                : 'bg-slate-900 text-white hover:bg-slate-800'
                                                        }`}
                                                >
                                                    {asset.status === 'approved' ? (
                                                        <><CheckCircle size={14} /> Approved ✓</>
                                                    ) : asset.validation_status === 'failed' ? (
                                                        <><XCircle size={14} /> View Rejection</>
                                                    ) : (
                                                        <><ShieldAlert size={14} /> Policy Review</>
                                                    )}
                                                </button>
                                                {(selectedScreen?.role === 'xigi' || selectedScreen?.role === 'franchise') && (
                                                    <button
                                                        disabled={asset.status !== 'approved'}
                                                        onClick={() => asset.status === 'approved' && navigate('/console/campaign-live')}
                                                        className={`flex-1 py-2.5 font-bold text-xs rounded-none flex items-center justify-center gap-2 transition-all ${asset.status === 'approved'
                                                            ? 'bg-violet-600 text-white hover:bg-violet-700 cursor-pointer shadow-lg shadow-violet-500/20'
                                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <Radio size={14} /> Go to Live
                                                    </button>
                                                )}
                                                {hasFile && (
                                                    <button
                                                        onClick={() => generateDeploymentPdf({
                                                            campaign: selectedCampaign,
                                                            screen: selectedScreen,
                                                            asset,
                                                        })}
                                                        title="Download Deployment PDF"
                                                        className="px-4 py-2.5 font-bold text-xs rounded-none flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-900 cursor-pointer transition-all"
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* POLICY REVIEW DRAWER                        */}
            {/* ═══════════════════════════════════════════ */}
            <AnimatePresence>
                {selectedAsset && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closePolicyDrawer}
                            className="fixed inset-0 mb-0 bg-slate-900/30 backdrop-blur-sm z-[60]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed top-0 right-0 h-full w-[520px] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100"
                        >
                            {/* Drawer Header */}
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        {selectedAsset.status === 'approved' ? (
                                            <CheckCircle size={18} className="text-green-500" />
                                        ) : selectedAsset.validation_status === 'failed' ? (
                                            <XCircle size={18} className="text-red-500" />
                                        ) : selectedAsset.is_resubmission ? (
                                            <RefreshCw size={18} className="text-indigo-500" />
                                        ) : (
                                            <ShieldAlert size={18} className="text-amber-500" />
                                        )}
                                        {selectedAsset.status === 'approved' ? 'Approved' : selectedAsset.validation_status === 'failed' ? 'Rejected' : selectedAsset.is_resubmission ? 'Resubmitted for Review' : 'Policy Review'} — {selectedGroup?.slots?.length > 1 ? `Slots ${selectedGroup.slots.join(', ')}` : `Slot ${selectedAsset.slot_number}`}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedCampaign?.campaign_name} → {selectedScreen?.screen_name || `Screen ${selectedScreen?.id}`}
                                    </p>
                                </div>
                                <button onClick={closePolicyDrawer} className="p-2 rounded-none hover:bg-slate-200 text-slate-500 cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Status Banner */}
                            {selectedAsset.status === 'approved' && (
                                <div className="mx-5 mt-4 p-3 bg-green-50 border border-green-200 flex items-center gap-2">
                                    <CheckCircle size={16} className="text-green-600" />
                                    <div>
                                        <p className="text-xs font-bold text-green-700">This asset has been approved and pushed live</p>
                                        {selectedAsset.validated_at && (
                                            <p className="text-[10px] text-green-600 mt-0.5">Reviewed on {new Date(selectedAsset.validated_at).toLocaleString()}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            {selectedAsset.validation_status === 'failed' && (
                                <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 flex items-center gap-2">
                                    <XCircle size={16} className="text-red-600" />
                                    <div>
                                        <p className="text-xs font-bold text-red-700">This asset was rejected</p>
                                        {selectedAsset.validated_at && (
                                            <p className="text-[10px] text-red-600 mt-0.5">Rejected on {new Date(selectedAsset.validated_at).toLocaleString()}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            {selectedAsset.is_resubmission && selectedAsset.status === 'uploaded' && (
                                <div className="mx-5 mt-4 p-3 bg-indigo-50 border border-indigo-200 flex items-center gap-2">
                                    <RefreshCw size={16} className="text-indigo-600" />
                                    <div>
                                        <p className="text-xs font-bold text-indigo-700">Updated & Resubmitted</p>
                                        <p className="text-[10px] text-indigo-600 mt-0.5">This creative was previously rejected and has been resubmitted with a new file for your review.</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                {/* Asset Preview */}
                                <div className="aspect-video bg-slate-900 rounded-none overflow-hidden relative">
                                    {selectedAsset.file ? (
                                        selectedAsset.file_extension && ['mp4', 'mov', 'webm'].includes(selectedAsset.file_extension.toLowerCase()) ? (
                                            <video src={`http://localhost:8000${selectedAsset.file}`} controls className="w-full h-full object-contain" />
                                        ) : selectedAsset.file_extension && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(selectedAsset.file_extension.toLowerCase()) ? (
                                            <img src={`http://localhost:8000${selectedAsset.file}`} alt="Preview" className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-2">
                                                <FileImage size={40} className="text-slate-500" />
                                                <p className="text-xs text-slate-400 font-medium">{selectedAsset.original_filename || 'File'}</p>
                                                <p className="text-[10px] text-slate-500">Preview not available for .{selectedAsset.file_extension?.toUpperCase()} files</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <FileImage size={48} className="text-slate-600" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 backdrop-blur-md font-medium">
                                        {selectedAsset.file_extension?.toUpperCase() || '—'} · {formatFileSize(selectedAsset.file_size_bytes)}
                                    </div>
                                </div>

                                {/* File Details */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">File Details</h3>
                                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-none border border-slate-100">
                                        <div>
                                            <p className="text-[10px] text-slate-400">Filename</p>
                                            <p className="font-semibold text-slate-700 text-xs truncate">{selectedAsset.original_filename || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400">Resolution</p>
                                            <p className="font-semibold text-slate-700 text-xs">
                                                {selectedAsset.detected_width && selectedAsset.detected_height
                                                    ? `${selectedAsset.detected_width}×${selectedAsset.detected_height}` : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400">Duration</p>
                                            <p className="font-semibold text-slate-700 text-xs">{selectedAsset.detected_duration_sec ? `${selectedAsset.detected_duration_sec}s` : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Policy Checklist — Dynamic from screen tags */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Policy Checklist</h3>
                                    <p className="text-[10px] text-slate-500 mb-3">Review the ad content against this screen's policy rules.</p>

                                    {/* Restricted Categories Section */}
                                    {dynamicChecks.filter(c => c.type === 'restricted').length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <AlertOctagon size={12} className="text-red-500" />
                                                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Restricted Categories</span>
                                            </div>
                                            <div className="space-y-2">
                                                {dynamicChecks.filter(c => c.type === 'restricted').map((check) => {
                                                    const val = policyChecks[check.key];
                                                    return (
                                                        <div
                                                            key={check.key}
                                                            className={`p-3 rounded-none border transition-all ${val === true ? 'bg-green-50 border-green-200' :
                                                                val === false ? 'bg-red-50 border-red-200' :
                                                                    'bg-white border-slate-200'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1 mr-3">
                                                                    <p className="text-xs font-bold text-slate-700">{check.label}</p>
                                                                    <p className="text-[10px] text-slate-500 mt-0.5">{check.desc}</p>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        onClick={() => setPolicyChecks(prev => ({ ...prev, [check.key]: true }))}
                                                                        disabled={isAlreadyReviewed}
                                                                        className={`w-8 h-8 rounded-none border-2 flex items-center justify-center transition-all ${isAlreadyReviewed ? 'cursor-default opacity-70' : 'cursor-pointer'} ${val === true
                                                                            ? 'bg-green-600 border-green-600 text-white shadow-md'
                                                                            : 'bg-green-50 border-green-300 text-green-400 hover:bg-green-100 hover:border-green-500'
                                                                            }`}
                                                                        title="Pass"
                                                                    >
                                                                        <Check size={16} strokeWidth={3} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setPolicyChecks(prev => ({ ...prev, [check.key]: false }))}
                                                                        disabled={isAlreadyReviewed}
                                                                        className={`w-8 h-8 rounded-none border-2 flex items-center justify-center transition-all ${isAlreadyReviewed ? 'cursor-default opacity-70' : 'cursor-pointer'} ${val === false
                                                                            ? 'bg-red-600 border-red-600 text-white shadow-md'
                                                                            : 'bg-red-50 border-red-300 text-red-400 hover:bg-red-100 hover:border-red-500'
                                                                            }`}
                                                                        title="Fail"
                                                                    >
                                                                        <X size={16} strokeWidth={3} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Sensitive Zone Section */}
                                    {dynamicChecks.filter(c => c.type === 'sensitive').length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <AlertTriangle size={12} className="text-amber-500" />
                                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Sensitive Zone Checks</span>
                                            </div>
                                            <div className="space-y-2">
                                                {dynamicChecks.filter(c => c.type === 'sensitive').map((check) => {
                                                    const val = policyChecks[check.key];
                                                    return (
                                                        <div
                                                            key={check.key}
                                                            className={`p-3 rounded-none border transition-all ${val === true ? 'bg-green-50 border-green-200' :
                                                                val === false ? 'bg-red-50 border-red-200' :
                                                                    'bg-white border-slate-200'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1 mr-3">
                                                                    <p className="text-xs font-bold text-slate-700">{check.label}</p>
                                                                    <p className="text-[10px] text-slate-500 mt-0.5">{check.desc}</p>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        onClick={() => setPolicyChecks(prev => ({ ...prev, [check.key]: true }))}
                                                                        disabled={isAlreadyReviewed}
                                                                        className={`w-8 h-8 rounded-none border-2 flex items-center justify-center transition-all ${isAlreadyReviewed ? 'cursor-default opacity-70' : 'cursor-pointer'} ${val === true
                                                                            ? 'bg-green-600 border-green-600 text-white shadow-md'
                                                                            : 'bg-green-50 border-green-300 text-green-400 hover:bg-green-100 hover:border-green-500'
                                                                            }`}
                                                                        title="Pass"
                                                                    >
                                                                        <Check size={16} strokeWidth={3} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setPolicyChecks(prev => ({ ...prev, [check.key]: false }))}
                                                                        disabled={isAlreadyReviewed}
                                                                        className={`w-8 h-8 rounded-none border-2 flex items-center justify-center transition-all ${isAlreadyReviewed ? 'cursor-default opacity-70' : 'cursor-pointer'} ${val === false
                                                                            ? 'bg-red-600 border-red-600 text-white shadow-md'
                                                                            : 'bg-red-50 border-red-300 text-red-400 hover:bg-red-100 hover:border-red-500'
                                                                            }`}
                                                                        title="Fail"
                                                                    >
                                                                        <X size={16} strokeWidth={3} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* No checks case */}
                                    {dynamicChecks.length === 0 && (
                                        <div className="p-4 bg-green-50 border border-green-100 rounded-none text-center">
                                            <CheckCircle size={20} className="mx-auto text-green-500 mb-1" />
                                            <p className="text-xs font-bold text-green-700">No policy restrictions for this screen</p>
                                            <p className="text-[10px] text-green-600 mt-0.5">You can approve this ad directly</p>
                                        </div>
                                    )}
                                </div>

                                {/* Rejection Note */}
                                {hasFailedChecks && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Rejection Note</label>
                                        <textarea
                                            value={policyNote}
                                            onChange={e => setPolicyNote(e.target.value)}
                                            rows={3}
                                            placeholder="Describe the policy violation for the advertiser..."
                                            className="w-full px-3 py-2 border border-slate-200 rounded-none focus:outline-none focus:border-blue-500 text-sm"
                                        />
                                    </div>
                                )}

                                {/* Previous rejection */}
                                {selectedAsset.validation_errors?.policy_failures && (
                                    <div className="p-3 bg-red-50 border border-red-100 rounded-none">
                                        <h4 className="text-[10px] font-bold text-red-700 mb-1 flex items-center gap-1.5">
                                            <AlertOctagon size={12} /> Previous Rejection
                                        </h4>
                                        {selectedAsset.validation_errors.policy_failures.map((f, i) => (
                                            <p key={i} className="text-xs text-red-600">• {f}</p>
                                        ))}
                                        {selectedAsset.validation_errors.note && (
                                            <p className="text-xs text-red-600 mt-1 italic">{selectedAsset.validation_errors.note}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            {isAlreadyReviewed ? (
                                <div className="px-5 py-4 border-t border-slate-100 bg-white">
                                    <button
                                        onClick={closePolicyDrawer}
                                        className="w-full py-3 font-bold text-xs rounded-none flex items-center justify-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                                    >
                                        <X size={14} /> Close
                                    </button>
                                </div>
                            ) : (
                                <div className="px-5 py-4 border-t border-slate-100 space-y-2 bg-white">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleApprove}
                                            disabled={!allChecksReviewed || !allChecksPassed || approving}
                                            className={`flex-1 py-3 font-bold text-xs rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer ${allChecksReviewed && allChecksPassed
                                                ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/20'
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                }`}
                                        >
                                            {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                            Approve & Push Live
                                        </button>
                                        <button
                                            onClick={handleReject}
                                            disabled={!hasFailedChecks || rejecting}
                                            className={`flex-1 py-3 font-bold text-xs rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer ${hasFailedChecks
                                                ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                                                : 'bg-slate-100 text-slate-400 border border-slate-100 cursor-not-allowed'
                                                }`}
                                        >
                                            {rejecting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                            Reject
                                        </button>
                                    </div>
                                    {!allChecksReviewed && (
                                        <p className="text-[10px] text-slate-400 text-center">Complete all {dynamicChecks.length} policy checks to take action</p>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default CreativeValidationQueue;