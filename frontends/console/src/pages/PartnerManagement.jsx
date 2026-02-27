import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Search,
    ChevronRight,
    X,
    Activity,
    CheckCircle,
    AlertTriangle,
    AlertOctagon,
    Ban,
    Settings,
    TrendingUp,
    ArrowLeft,
    RefreshCw,
    Monitor,
    Wifi,
    WifiOff,
    Globe,
    Key,
    MapPin,
    Layers
} from 'lucide-react';

// --- Sub-Components ---

const StatusBadge = ({ status }) => {
    const styles = {
        'Active': 'bg-green-100 text-green-700 border-green-200',
        'active': 'bg-green-100 text-green-700 border-green-200',
        'Suspended': 'bg-red-100 text-red-700 border-red-200',
        'suspended': 'bg-red-100 text-red-700 border-red-200',
        'Inactive': 'bg-slate-100 text-slate-600 border-slate-200',
        'Onboarding': 'bg-blue-100 text-blue-700 border-blue-200',
        'onboarding': 'bg-blue-100 text-blue-700 border-blue-200',
        'Blocked': 'bg-red-100 text-red-700 border-red-200',
        'blocked': 'bg-red-100 text-red-700 border-red-200',
        'VERIFIED': 'bg-green-100 text-green-700 border-green-200',
        'DRAFT': 'bg-slate-100 text-slate-600 border-slate-200',
        'SUBMITTED': 'bg-blue-100 text-blue-700 border-blue-200',
        'PENDING': 'bg-orange-100 text-orange-700 border-orange-200',
        'REJECTED': 'bg-red-100 text-red-700 border-red-200',
        'BLOCKED': 'bg-red-100 text-red-700 border-red-200',
    };
    const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    return (
        <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {label}
        </span>
    );
};

const ScreenStatusDot = ({ status }) => {
    const color = status === 'VERIFIED' ? 'bg-green-500' : status === 'DRAFT' ? 'bg-slate-300' : status === 'SUBMITTED' ? 'bg-blue-400' : status === 'REJECTED' ? 'bg-red-400' : 'bg-orange-400';
    return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
};

// --- Main Component ---

const PartnerManagement = () => {
    const [partners, setPartners] = useState([]);
    const [allScreens, setAllScreens] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    // Navigation State
    const [viewMode, setViewMode] = useState('list');
    const [selectedPartner, setSelectedPartner] = useState(null);

    // Drawer State
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeDrawerTab, setActiveDrawerTab] = useState('Overview');

    // Full Page State
    const [fullPageTab, setFullPageTab] = useState('Overview');

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [companiesRes, screensRes, ticketsRes] = await Promise.all([
                api.get('companies/'),
                api.get('screen-specs/'),
                api.get('tickets/').catch(() => ({ data: [] })),
            ]);

            const companies = companiesRes.data || [];
            const screens = screensRes.data || [];
            const ticketData = ticketsRes.data || [];

            // Map screens by admin_name for partner matching
            const screensByAdmin = {};
            screens.forEach(s => {
                const key = (s.admin_name || '').toLowerCase().trim();
                if (!screensByAdmin[key]) screensByAdmin[key] = [];
                screensByAdmin[key].push(s);
            });

            const mapped = companies.map(c => {
                const partnerKey = (c.name || '').toLowerCase().trim();
                const partnerScreens = screensByAdmin[partnerKey] || [];
                const verifiedScreens = partnerScreens.filter(s => s.status === 'VERIFIED');

                return {
                    id: c.partner_id,
                    numericId: c.id,
                    name: c.name,
                    displayName: c.display_name || c.name,
                    type: (c.company_type || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    rawType: c.company_type,
                    status: c.status || 'onboarding',
                    isActive: c.is_active,
                    // Contact
                    contact: c.primary_contact_name || 'N/A',
                    email: c.primary_contact_email || c.contact_email || 'N/A',
                    phone: c.primary_contact_phone || c.contact_phone || 'N/A',
                    // Screens
                    totalScreens: partnerScreens.length,
                    verifiedScreens: verifiedScreens.length,
                    screens: partnerScreens,
                    // Integration
                    apiKey: c.api_key || '',
                    webhookUrl: c.webhook_url || '',
                    proofOfPlayMode: c.proof_of_play_mode || '',
                    apiAccessMode: c.api_access_mode || '',
                    baseApiUrl: c.base_api_url || '',
                    lastApiSyncAt: c.last_api_sync_at || null,
                    // Dates
                    dateJoined: c.date_joined,
                    contractStart: c.contract_start_date,
                    contractEnd: c.contract_end_date,
                    createdAt: c.created_at,
                    // Risk
                    riskLevel: c.risk_level || 'low',
                };
            });

            setPartners(mapped);
            setAllScreens(screens);
            setTickets(ticketData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Computed stats
    const stats = useMemo(() => {
        const activePartners = partners.filter(p => p.status === 'active').length;
        const totalScreens = allScreens.length;
        const verifiedScreens = allScreens.filter(s => s.status === 'VERIFIED').length;
        const draftScreens = allScreens.filter(s => s.status === 'DRAFT').length;
        const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
        return { activePartners, totalScreens, verifiedScreens, draftScreens, openTickets };
    }, [partners, allScreens, tickets]);

    const filteredPartners = useMemo(() => {
        return partners.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'All' || p.status === statusFilter.toLowerCase();
            const matchesType = typeFilter === 'All' || p.rawType === typeFilter;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [partners, searchTerm, statusFilter, typeFilter]);

    // --- Handlers ---

    const handleRowClick = (partner) => {
        setSelectedPartner(partner);
        setViewMode('fullPage');
        setFullPageTab('Overview');
    };

    const handleOpenDrawer = (e, partner) => {
        e.stopPropagation();
        setSelectedPartner(partner);
        setDrawerOpen(true);
        setActiveDrawerTab('Overview');
    };

    const handleOpenFullPage = () => {
        setDrawerOpen(false);
        setViewMode('fullPage');
        setFullPageTab('Overview');
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
    };

    // --- Renderers ---

    // 1. LIST VIEW
    const renderListView = () => (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        Partner Management
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-none border border-blue-100">
                            Operational View
                        </span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">Operational visibility, screen inventory, and integration status for all partners.</p>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-none shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Active partners</p>
                        <p className="text-2xl font-bold text-slate-900 mt-2">{stats.activePartners}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">of {partners.length} total</p>
                    </div>
                    <div className="p-2.5 bg-green-50 text-green-600 rounded-none"><Users size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-none shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Total screens</p>
                        <p className="text-2xl font-bold text-blue-600 mt-2">{stats.totalScreens}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Across all partners</p>
                    </div>
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-none"><Monitor size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-none shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Verified screens</p>
                        <p className="text-2xl font-bold text-green-600 mt-2">{stats.verifiedScreens}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Live & operational</p>
                    </div>
                    <div className="p-2.5 bg-green-50 text-green-600 rounded-none"><CheckCircle size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-none shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Open tickets</p>
                        <p className="text-2xl font-bold text-orange-600 mt-2">{stats.openTickets}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Needs attention</p>
                    </div>
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-none"><AlertOctagon size={24} /></div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search partners by name, ID, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-none border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-700 shadow-sm"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="flex-1 md:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="All">All Types</option>
                        <option value="partner">Partner</option>
                        <option value="dooh_network">DOOH Network</option>
                        <option value="franchise">Franchise</option>
                        <option value="agency">Agency</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="flex-1 md:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Onboarding">Onboarding</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Blocked">Blocked</option>
                    </select>
                </div>
            </div>

            {/* Loading */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                    <span className="ml-3 text-sm text-slate-500">Loading partners...</span>
                </div>
            ) : (
                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-left border-separate border-spacing-y-0 text-sm">
                        <thead>
                            <tr className="text-slate-400 font-bold text-[10px]">
                                <th className="px-4 py-3">Partner name</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Contact</th>
                                <th className="px-4 py-3 text-center">Screens</th>
                                <th className="px-4 py-3 text-center">Integration</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white rounded-none shadow-sm border border-slate-100">
                            {filteredPartners.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                                        No partners found
                                    </td>
                                </tr>
                            ) : (
                                filteredPartners.map((row, idx) => (
                                    <tr
                                        key={row.id}
                                        onClick={() => handleRowClick(row)}
                                        className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                                        style={idx !== filteredPartners.length - 1 ? { borderBottom: '1px solid #d7d7d7' } : {}}
                                    >
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <p className="font-bold text-slate-800 text-xs">{row.name}</p>
                                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">{row.id}</p>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <span className="px-2 py-0.5 bg-slate-100 rounded-none text-[10px] font-bold text-slate-500 border border-slate-200">
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <p className="text-xs text-slate-700 font-medium">{row.contact}</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">{row.email}</p>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-center">
                                            <span className="font-bold text-slate-800 text-xs">{row.verifiedScreens}</span>
                                            <span className="text-slate-300 text-xs"> / </span>
                                            <span className="text-slate-400 text-xs">{row.totalScreens}</span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-center">
                                            {row.apiKey ? (
                                                <span className="flex items-center justify-center gap-1 text-green-600">
                                                    <Wifi size={12} />
                                                    <span className="text-[10px] font-bold">Connected</span>
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center gap-1 text-slate-400">
                                                    <WifiOff size={12} />
                                                    <span className="text-[10px] font-bold">None</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-center">
                                            <StatusBadge status={row.status} />
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right">
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // 2. FULL PAGE VIEW
    const renderFullPageView = () => {
        if (!selectedPartner) return null;
        const p = selectedPartner;

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 pb-20"
            >
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => setViewMode('list')}
                            className="flex items-center text-slate-400 hover:text-blue-600 mb-2 text-xs font-bold transition-colors cursor-pointer"
                        >
                            <ArrowLeft size={14} className="mr-1" />
                            Back to Partners
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                            {p.displayName}
                            <StatusBadge status={p.status} />
                        </h1>
                        <p className="text-xs text-slate-500 mt-1 font-bold opacity-70">{p.type} • ID: {p.id}</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-none text-xs font-bold hover:bg-red-50 transition-colors cursor-pointer">
                            <Ban size={14} /> Suspend
                        </button>
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-none text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer">
                            <Settings size={14} /> Settings
                        </button>
                    </div>
                </header>

                {/* Tabs */}
                <div className="border-b border-slate-200">
                    <div className="flex gap-6">
                        {['Overview', 'Screens', 'API & Integration', 'Issues'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setFullPageTab(tab)}
                                className={`pb-3 text-xs font-bold transition-colors relative whitespace-nowrap cursor-pointer ${fullPageTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}
                            >
                                {tab}
                                {fullPageTab === tab && (
                                    <motion.div layoutId="activeTabPartner" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-none" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="min-h-[400px]">
                    {/* === OVERVIEW TAB === */}
                    {fullPageTab === 'Overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-6">
                                {/* Stats cards */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-none border border-slate-100 shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">Total screens</p>
                                        <p className="text-xl font-bold text-slate-800">{p.totalScreens}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-none border border-slate-100 shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">Verified screens</p>
                                        <p className="text-xl font-bold text-green-600">{p.verifiedScreens}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-none border border-slate-100 shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">Risk level</p>
                                        <p className={`text-xl font-bold ${p.riskLevel === 'high' ? 'text-red-600' : p.riskLevel === 'medium' ? 'text-orange-600' : 'text-green-600'}`}>
                                            {p.riskLevel.charAt(0).toUpperCase() + p.riskLevel.slice(1)}
                                        </p>
                                    </div>
                                </div>

                                {/* Screen breakdown */}
                                {p.screens.length > 0 && (
                                    <div className="bg-white p-5 rounded-none border border-slate-100 shadow-sm">
                                        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                                            <Monitor size={14} className="text-slate-400" /> Screen Breakdown
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {['VERIFIED', 'SUBMITTED', 'DRAFT', 'REJECTED'].map(st => {
                                                const count = p.screens.filter(s => s.status === st).length;
                                                return (
                                                    <div key={st} className="flex items-center gap-2">
                                                        <ScreenStatusDot status={st} />
                                                        <span className="text-xs text-slate-600">{st.charAt(0) + st.slice(1).toLowerCase()}</span>
                                                        <span className="text-xs font-bold text-slate-800 ml-auto">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Integration status */}
                                <div className="bg-white p-5 rounded-none border border-slate-100 shadow-sm">
                                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                                        <Globe size={14} className="text-slate-400" /> Integration Status
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-none border border-slate-100">
                                            <span className="text-xs text-slate-500">API Key</span>
                                            {p.apiKey ? (
                                                <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><CheckCircle size={12} /> Configured</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-slate-400 text-xs font-bold"><X size={12} /> Not set</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-none border border-slate-100">
                                            <span className="text-xs text-slate-500">Webhook</span>
                                            {p.webhookUrl ? (
                                                <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><CheckCircle size={12} /> Active</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-slate-400 text-xs font-bold"><X size={12} /> Not set</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-none border border-slate-100">
                                            <span className="text-xs text-slate-500">PoP Mode</span>
                                            <span className="text-xs font-bold text-slate-700">{p.proofOfPlayMode || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-none border border-slate-100">
                                            <span className="text-xs text-slate-500">Access Mode</span>
                                            <span className="text-xs font-bold text-slate-700">{p.apiAccessMode || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right sidebar */}
                            <div className="space-y-6">
                                <div className="bg-white p-5 rounded-none border border-slate-100 shadow-sm">
                                    <h3 className="font-bold text-slate-400 text-[10px] mb-4">Contact Details</h3>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <p className="text-slate-400 text-xs">Primary Contact</p>
                                            <p className="font-medium text-slate-700">{p.contact}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">Email</p>
                                            <p className="font-medium text-slate-700">{p.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">Phone</p>
                                            <p className="font-medium text-slate-700">{p.phone}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-none border border-slate-100 shadow-sm">
                                    <h3 className="font-bold text-slate-400 text-[10px] mb-4">Contract</h3>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-slate-500">Joined</span>
                                            <span className="text-xs font-bold text-slate-700">{p.dateJoined || '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-slate-500">Contract start</span>
                                            <span className="text-xs font-bold text-slate-700">{p.contractStart || '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-slate-500">Contract end</span>
                                            <span className="text-xs font-bold text-slate-700">{p.contractEnd || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === SCREENS TAB === */}
                    {fullPageTab === 'Screens' && (
                        <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden">
                            {p.screens.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Monitor size={40} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-sm text-slate-500 font-medium">No screens registered for this partner</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                                        <tr>
                                            <th className="px-3 py-4 border-b border-slate-200">Screen Name</th>
                                            <th className="px-3 py-4 border-b border-slate-200">City</th>
                                            <th className="px-3 py-4 border-b border-slate-200">Environment</th>
                                            <th className="px-3 py-4 border-b border-slate-200">Resolution</th>
                                            <th className="px-3 py-4 border-b border-slate-200">Status</th>
                                            <th className="px-3 py-4 border-b border-slate-200">Role</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {p.screens.map((s) => (
                                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-4 border-b border-slate-100">
                                                    <p className="font-bold text-slate-700 text-xs">{s.screen_name || '—'}</p>
                                                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {s.id}</p>
                                                </td>
                                                <td className="px-3 py-4 border-b border-slate-100 text-xs text-slate-600">
                                                    <span className="flex items-center gap-1"><MapPin size={10} /> {s.city || '—'}</span>
                                                </td>
                                                <td className="px-3 py-4 border-b border-slate-100 text-xs text-slate-600">{s.environment || '—'}</td>
                                                <td className="px-3 py-4 border-b border-slate-100 text-xs font-mono text-slate-600">
                                                    {s.resolution_width && s.resolution_height ? `${s.resolution_width}×${s.resolution_height}` : '—'}
                                                </td>
                                                <td className="px-3 py-4 border-b border-slate-100">
                                                    <StatusBadge status={s.status} />
                                                </td>
                                                <td className="px-3 py-4 border-b border-slate-100">
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded-none text-[10px] font-bold text-slate-500 border border-slate-200">
                                                        {s.role || '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* === API & INTEGRATION TAB === */}
                    {fullPageTab === 'API & Integration' && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-none border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-slate-800 text-sm mb-6 flex items-center gap-2">
                                    <Key size={16} className="text-blue-600" /> API Configuration
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">API Key</p>
                                        <div className="p-3 bg-slate-50 rounded-none border border-slate-200 font-mono text-xs text-slate-600 break-all">
                                            {p.apiKey || <span className="text-slate-400 italic">Not configured</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">Base API URL</p>
                                        <div className="p-3 bg-slate-50 rounded-none border border-slate-200 font-mono text-xs text-slate-600 break-all">
                                            {p.baseApiUrl || <span className="text-slate-400 italic">Not configured</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">Webhook URL</p>
                                        <div className="p-3 bg-slate-50 rounded-none border border-slate-200 font-mono text-xs text-slate-600 break-all">
                                            {p.webhookUrl || <span className="text-slate-400 italic">Not configured</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">Access Mode</p>
                                        <div className="p-3 bg-slate-50 rounded-none border border-slate-200 text-xs font-bold text-slate-700">
                                            {p.apiAccessMode ? p.apiAccessMode.toUpperCase() : <span className="text-slate-400 italic font-normal">Not set</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-none border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-slate-800 text-sm mb-6 flex items-center gap-2">
                                    <Activity size={16} className="text-blue-600" /> Proof of Play
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">PoP Mode</p>
                                        <div className="p-3 bg-slate-50 rounded-none border border-slate-200 text-xs font-bold text-slate-700">
                                            {p.proofOfPlayMode ? p.proofOfPlayMode.charAt(0).toUpperCase() + p.proofOfPlayMode.slice(1).replace('_', ' ') : <span className="text-slate-400 italic font-normal">Not configured</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold mb-1">Last API Sync</p>
                                        <div className="p-3 bg-slate-50 rounded-none border border-slate-200 text-xs font-bold text-slate-700">
                                            {p.lastApiSyncAt ? new Date(p.lastApiSyncAt).toLocaleString() : <span className="text-slate-400 italic font-normal">Never</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === ISSUES TAB === */}
                    {fullPageTab === 'Issues' && (
                        <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden">
                            {tickets.length === 0 ? (
                                <div className="py-16 text-center">
                                    <CheckCircle size={40} className="mx-auto text-green-300 mb-3" />
                                    <p className="text-sm text-slate-500 font-medium">No open tickets or issues</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <AlertOctagon size={16} className="text-orange-500" /> Support Tickets
                                        </h3>
                                    </div>
                                    {tickets.map(t => (
                                        <div key={t.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                                            {t.priority === 'critical' || t.priority === 'high' ? (
                                                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                                            ) : (
                                                <Activity className="text-orange-500 shrink-0 mt-0.5" size={16} />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-bold text-slate-800 text-xs">{t.title}</p>
                                                    <span className={`px-1.5 py-0.5 rounded-none text-[9px] font-bold border ${t.priority === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : t.priority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                        {t.priority}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 truncate">{t.description}</p>
                                            </div>
                                            <StatusBadge status={t.status === 'open' ? 'Active' : t.status === 'in_progress' ? 'Onboarding' : 'Inactive'} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    // 3. DRAWER CONTENT
    const renderDrawerContent = () => {
        if (!selectedPartner) return null;
        const p = selectedPartner;

        return (
            <div className="flex-1 overflow-y-auto p-6">
                <div className="flex gap-3 mb-6 border-b border-slate-100 pb-1">
                    {['Overview', 'Screens'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveDrawerTab(tab)}
                            className={`pb-3 text-[12px] font-bold transition-colors relative whitespace-nowrap cursor-pointer ${activeDrawerTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab}
                            {activeDrawerTab === tab && (
                                <motion.div layoutId="activeTabDrawer" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                            )}
                        </button>
                    ))}
                </div>

                {activeDrawerTab === 'Overview' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-50 rounded-none border border-slate-100 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Total Screens</span>
                                <span className="text-sm font-bold text-slate-800">{p.totalScreens}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Verified</span>
                                <span className="text-sm font-bold text-green-600">{p.verifiedScreens}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Status</span>
                                <StatusBadge status={p.status} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-none text-center">
                                <p className="text-xs text-blue-700 font-bold">Type</p>
                                <p className="font-bold text-blue-800 text-sm mt-1">{p.type}</p>
                            </div>
                            <div className={`p-3 border rounded-none text-center ${p.riskLevel === 'high' ? 'bg-red-50 border-red-100' : p.riskLevel === 'medium' ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
                                <p className={`text-xs font-bold ${p.riskLevel === 'high' ? 'text-red-700' : p.riskLevel === 'medium' ? 'text-orange-700' : 'text-green-700'}`}>Risk</p>
                                <p className={`font-bold text-sm mt-1 ${p.riskLevel === 'high' ? 'text-red-800' : p.riskLevel === 'medium' ? 'text-orange-800' : 'text-green-800'}`}>
                                    {p.riskLevel.charAt(0).toUpperCase() + p.riskLevel.slice(1)}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-white rounded-none border border-slate-100">
                                <span className="text-xs text-slate-500">Contact</span>
                                <span className="text-xs font-bold text-slate-800">{p.contact}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-none border border-slate-100">
                                <span className="text-xs text-slate-500">Email</span>
                                <span className="text-xs font-bold text-slate-800 truncate ml-2">{p.email}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-none border border-slate-100">
                                <span className="text-xs text-slate-500">Integration</span>
                                {p.apiKey ? (
                                    <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><Wifi size={10} /> Connected</span>
                                ) : (
                                    <span className="flex items-center gap-1 text-slate-400 text-xs font-bold"><WifiOff size={10} /> None</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeDrawerTab === 'Screens' && (
                    <div className="space-y-3">
                        {p.screens.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <Monitor size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No screens registered</p>
                            </div>
                        ) : (
                            p.screens.map(s => (
                                <div key={s.id} className="p-3 bg-white rounded-none border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">{s.screen_name || 'Unnamed'}</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5">{s.city || '—'} • {s.environment || '—'}</p>
                                    </div>
                                    <StatusBadge status={s.status} />
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative min-h-screen"
            >
                {viewMode === 'list' ? renderListView() : renderFullPageView()}
            </motion.div>

            {/* Right Drawer */}
            <AnimatePresence>
                {drawerOpen && selectedPartner && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeDrawer}
                            className="fixed inset-0 z-[60]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{selectedPartner.displayName}</h2>
                                    <p className="text-[10px] text-slate-500 mt-1 font-bold opacity-70">{selectedPartner.type} • {selectedPartner.id}</p>
                                </div>
                                <button onClick={closeDrawer} className="p-2 rounded-none hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            {renderDrawerContent()}

                            <div className="p-6 border-t border-slate-100 bg-slate-50">
                                <button
                                    onClick={handleOpenFullPage}
                                    className="w-full py-3.5 bg-blue-600 text-white rounded-none font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-xs cursor-pointer"
                                >
                                    <TrendingUp size={16} /> Open Full View
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default PartnerManagement;
