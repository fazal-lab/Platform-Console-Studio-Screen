import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Megaphone,
    Search,
    Briefcase,
    ArrowLeft,
    Download,
    Activity,
    AlertTriangle,
    CheckCircle,
    Ban,
    Pause,
    ChevronRight,
    CreditCard,
    Layers,
    AlertOctagon
} from 'lucide-react';

const mockBrands = [
    { id: 'BR-01', name: 'Coca-Cola', campaigns: 12, spend: '₹85 L', status: 'Active' },
    { id: 'BR-02', name: 'Samsung', campaigns: 8, spend: '₹1.2 Cr', status: 'Active' },
    { id: 'BR-03', name: 'Dove', campaigns: 4, spend: '₹22 L', status: 'Inactive' },
    { id: 'BR-04', name: 'Vodafone', campaigns: 6, spend: '₹45 L', status: 'Active' },
];

// Dashboard API (Platform backend — Studio routes)
const dashboardApi = axios.create({
    baseURL: '/api/studio/',
    timeout: 10000,
});

// --- Sub-Components ---
const StatusBadge = ({ status }) => {
    const styles = {
        'Active': 'bg-green-100 text-green-700 border-green-200',
        'Live': 'bg-green-100 text-green-700 border-green-200',
        'Suspended': 'bg-red-100 text-red-700 border-red-200',
        'Inactive': 'bg-slate-100 text-slate-600 border-slate-200',
        'Paused': 'bg-orange-100 text-orange-700 border-orange-200',
        'Completed': 'bg-blue-100 text-blue-700 border-blue-200',
        'Draft': 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return (
        <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${styles[status] || styles['Inactive']}`}>
            {status}
        </span>
    );
};

// --- Main Component ---
const AdvertisersBrands = () => {
    const navigate = useNavigate();
    const [advertisers, setAdvertisers] = useState([]);
    const [loading, setLoading] = useState(true);
    // Navigation State
    const [viewMode, setViewMode] = useState('list');
    const [selectedAdvertiser, setSelectedAdvertiser] = useState(null);

    // Tabs State (Full Page)
    const [activeTab, setActiveTab] = useState('Overview');

    // Drawer State
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeDrawerTab, setActiveDrawerTab] = useState('Overview');

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');

    // Campaign data for selected advertiser
    const [userCampaigns, setUserCampaigns] = useState([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);

    useEffect(() => {
        fetchAdvertisers();
    }, []);

    const fetchAdvertisers = async () => {
        setLoading(true);
        try {
            // Fetch users and slot bookings in parallel
            const [usersRes, bookingsRes] = await Promise.all([
                api.get('/api/admin/users/'),
                api.get('/api/console/slot-bookings/')
            ]);
            const users = usersRes.data.data || [];
            const bookings = bookingsRes.data.bookings || [];

            // Count distinct active campaign_ids per user_id
            const activeCampaignsByUser = {};
            bookings.forEach(b => {
                if (b.status === 'ACTIVE' && b.user_id && b.campaign_id) {
                    if (!activeCampaignsByUser[b.user_id]) {
                        activeCampaignsByUser[b.user_id] = new Set();
                    }
                    activeCampaignsByUser[b.user_id].add(b.campaign_id);
                }
            });

            const mapped = users
                .filter(c => c.is_staff === false)
                .map(c => {
                    const userId = String(c.id);
                    const campaignSet = activeCampaignsByUser[userId];
                    return {
                        id: `ADV-${c.id}`,
                        numericId: c.id,
                        name: c.username || c.email,
                        type: 'Direct',
                        campaignCount: campaignSet ? campaignSet.size : 0,
                        status: c.is_active ? 'Active' : 'Suspended',
                        riskScore: 0,
                        contact: c.email || 'N/A',
                        email: c.email || 'N/A',
                        phone: c.phone || 'N/A',
                        company: c.company || 'N/A',
                        crmId: `ADV-${c.id}`
                    };
                });
            setAdvertisers(mapped);
        } catch (error) {
            console.error('Error fetching advertisers:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAdvertisers = useMemo(() => {
        return advertisers.filter(adv => {
            const matchesSearch = adv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                adv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                adv.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                adv.company.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [advertisers, searchTerm]);

    // --- Fetch campaigns for a specific user ---
    const fetchUserCampaigns = async (userId) => {
        setLoadingCampaigns(true);
        try {
            const res = await dashboardApi.get('dashboard/overview/');
            const allCampaigns = res.data?.data?.campaigns || [];
            // Filter campaigns belonging to this user
            const filtered = allCampaigns.filter(c => String(c.user) === String(userId));
            setUserCampaigns(filtered);
        } catch (err) {
            console.error('Error fetching user campaigns:', err);
            setUserCampaigns([]);
        } finally {
            setLoadingCampaigns(false);
        }
    };

    // --- Handlers ---
    const handleRowClick = (adv) => {
        setSelectedAdvertiser(adv);
        setViewMode('fullPage');
        setActiveTab('Overview');
        setUserCampaigns([]);
    };

    const handleOpenDrawer = (e, adv) => {
        e.stopPropagation();
        setSelectedAdvertiser(adv);
        setDrawerOpen(true);
        setActiveDrawerTab('Overview');
    };

    const handleOpenFullPage = () => {
        setDrawerOpen(false);
        setViewMode('fullPage');
        setActiveTab('Overview');
    };

    // Fetch campaigns when Campaigns tab is selected
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'Campaigns' && selectedAdvertiser) {
            fetchUserCampaigns(selectedAdvertiser.numericId);
        }
    };

    // PDF Export function
    const handleExportPDF = () => {
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(18);
        doc.text('Advertisers Report', 14, 20);

        // Add date
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        // Prepare table data
        const tableData = filteredAdvertisers.map(adv => [
            adv.name,
            adv.email,
            adv.phone,
            adv.company,
            adv.campaignCount.toString(),
            adv.status
        ]);

        // Add table
        autoTable(doc, {
            startY: 35,
            head: [['Advertiser', 'Email', 'Phone', 'Company', 'Campaigns', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241] },
            styles: { fontSize: 9 }
        });

        // Save PDF
        doc.save(`advertisers-report-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // --- Renderers ---

    // 1. LIST VIEW
    const renderListView = () => (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        Advertisers & Brands
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">Manage agency portfolios, direct clients, and campaign hierarchies.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-none text-xs text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        <Download size={16} /> Export
                    </button>
                </div>
            </header>

            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search advertisers by name, email, or company..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-none border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-700 shadow-sm"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <select className="flex-1 md:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300">
                        <option>All Status</option>
                        <option>Active</option>
                        <option>Suspended</option>
                    </select>
                </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto pb-4">
                <table className="w-full text-left border-separate border-spacing-y-0 text-sm">
                    <thead>
                        <tr className="text-slate-400 font-bold text-[10px]">
                            <th className="px-4 py-3">Advertiser name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3 text-center">Active Campaigns</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white rounded-2xl shadow-sm border border-slate-100">
                        {filteredAdvertisers.map((row, idx) => (
                            <tr
                                key={row.id}
                                onClick={() => handleRowClick(row)}
                                className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                                style={idx !== filteredAdvertisers.length - 1 ? { borderBottom: '1px solid #d7d7d7' } : {}}
                            >
                                <td className={`px-4 py-2 border-b border-slate-100 ${idx === 0 ? 'rounded-tl-2xl' : ''} ${idx === filteredAdvertisers.length - 1 ? 'border-0 rounded-bl-2xl' : ''}`}>
                                    <p className="font-bold text-slate-800 text-xs">{row.name}</p>
                                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{row.id}</p>
                                </td>
                                <td className="px-4 py-2 border-b border-slate-100 text-slate-600 text-xs">{row.email}</td>
                                <td className="px-4 py-2 border-b border-slate-100 text-slate-600 text-xs font-mono">{row.phone}</td>
                                <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs font-medium">{row.company}</td>
                                <td className="px-4 py-2 border-b border-slate-100 text-center font-bold text-slate-800 text-xs">{row.campaignCount}</td>
                                <td className="px-4 py-2 border-b border-slate-100 text-center">
                                    <StatusBadge status={row.status} />
                                </td>
                                <td className={`px-4 py-2 border-b border-slate-100 text-right ${idx === 0 ? 'rounded-tr-2xl' : ''} ${idx === filteredAdvertisers.length - 1 ? 'border-0 rounded-br-2xl' : ''}`}>
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // 2. FULL PAGE VIEW
    const renderFullPageView = () => {
        if (!selectedAdvertiser) return null;

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
                            className="flex items-center text-slate-400 hover:text-blue-600 mb-2 text-sm font-medium transition-colors"
                        >
                            <ArrowLeft size={16} className="mr-1" />
                            Back to List
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                            {selectedAdvertiser.name}
                            <StatusBadge status={selectedAdvertiser.status} />
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">{selectedAdvertiser.type} Account • ID: {selectedAdvertiser.id} • CRM: {selectedAdvertiser.crmId}</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 px-3 py-2 bg-white text-red-600 border border-red-200 rounded-none text-xs font-bold hover:bg-red-50 transition-colors cursor-pointer">
                            <Ban size={14} /> Suspend Account
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-none text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer">
                            <Pause size={14} /> Pause All
                        </button>
                    </div>
                </header>

                {/* Tabs */}
                <div className="border-b border-slate-200">
                    <div className="flex gap-4">
                        {['Overview', 'Brands', 'Campaigns', 'Payments', 'Issues'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`pb-2 text-xs font-bold transition-colors relative whitespace-nowrap ${activeTab === tab ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.div layoutId="activeTabAdv" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="min-h-[400px]">
                    {activeTab === 'Overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-6">
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-2xl font-bold text-slate-900 mt-2 leading-none">{selectedAdvertiser.totalSpend}</p>
                                        <p className="text-xs font-medium text-slate-500 mt-1">Lifetime value</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-sm font-bold text-slate-800">Active campaigns</p>
                                        <p className="text-2xl font-bold text-green-600 mt-2 leading-none">{selectedAdvertiser.campaignCount}</p>
                                        <p className="text-xs font-medium text-slate-500 mt-1">Live right now</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-sm font-bold text-slate-800">Risk score</p>
                                        <div className="flex items-end gap-1 mt-2">
                                            <p className={`text-2xl font-bold leading-none ${selectedAdvertiser.riskScore > 50 ? 'text-red-600' : 'text-blue-600'}`}>
                                                {selectedAdvertiser.riskScore}
                                            </p>
                                            <span className="text-xs font-bold text-slate-400 mb-0.5">/100</span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-500 mt-1">Compliance rating</p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-none border border-slate-100 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Activity size={20} className="text-slate-400" /> Account Activity
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-2">
                                            <div className="w-1.5 h-1.5 rounded-none bg-green-500 mt-1.5" />
                                            <div>
                                                <p className="text-xs font-medium text-slate-800">New Campaign "Winter Sale" created</p>
                                                <p className="text-[10px] text-slate-500">2 hours ago • by {selectedAdvertiser.contact}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                                            <div>
                                                <p className="text-xs font-medium text-slate-800">Payment of ₹12.4L received</p>
                                                <p className="text-[10px] text-slate-500">Yesterday • Ref: TXN-88292</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-none border border-slate-100 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4">Contact Details</h3>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <p className="text-slate-400 text-xs">Primary Contact</p>
                                            <p className="font-medium text-slate-700">{selectedAdvertiser.contact}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">Phone</p>
                                            <p className="font-medium text-slate-700">{selectedAdvertiser.phone}</p>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Brands' && (
                        <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden">
                            {selectedAdvertiser.type === 'Agency' ? (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-100">
                                        <tr>
                                            <th className="px-3 py-4 border-b border-slate-200">Brand Name</th>
                                            <th className="px-3 py-4 border-b border-slate-200 text-center">Active Campaigns</th>
                                            <th className="px-3 py-4 border-b border-slate-200">Total Spend</th>
                                            <th className="px-3 py-4 border-b border-slate-200">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {mockBrands.map((b) => (
                                            <tr key={b.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-4 border-b border-slate-100 font-bold text-slate-800">{b.name}</td>
                                                <td className="px-3 py-4 border-b border-slate-100 text-center text-slate-600">{b.campaigns}</td>
                                                <td className="px-3 py-4 border-b border-slate-100 font-mono text-slate-600">{b.spend}</td>
                                                <td className="px-3 py-4 border-b border-slate-100"><StatusBadge status={b.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-12 text-center text-slate-400">
                                    <Layers size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Brand separation is not applicable for Direct advertisers.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Campaigns' && (
                        <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden">
                            {loadingCampaigns ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                                    <span className="ml-3 text-sm text-slate-500">Loading campaigns...</span>
                                </div>
                            ) : userCampaigns.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Layers size={40} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-sm text-slate-500 font-medium">No campaigns found for this advertiser</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-100">
                                        <tr>
                                            <th className="px-3 py-4">Campaign Name</th>
                                            <th className="px-3 py-4">Status</th>
                                            <th className="px-3 py-4">Duration</th>
                                            <th className="px-3 py-4 text-center">Screens</th>
                                            <th className="px-3 py-4 text-center">Slots</th>
                                            <th className="px-3 py-4">Budget</th>
                                            <th className="px-3 py-4">Location</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {userCampaigns.map((c) => {
                                            const screenCount = Object.keys(c.booked_screens || {}).length;
                                            return (
                                                <tr
                                                    key={c.campaign_id}
                                                    className="hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer group"
                                                >
                                                    <td className="px-3 py-4">
                                                        <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{c.campaign_name}</p>
                                                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{c.campaign_id}</p>
                                                    </td>
                                                    <td className="px-3 py-4"><StatusBadge status={c.status?.charAt(0).toUpperCase() + c.status?.slice(1)} /></td>
                                                    <td className="px-3 py-4 text-xs text-slate-500">{c.start_date} → {c.end_date}</td>
                                                    <td className="px-3 py-4 text-center font-bold text-slate-700">{screenCount}</td>
                                                    <td className="px-3 py-4 text-center font-bold text-slate-700">{c.total_slots_booked || 0}</td>
                                                    <td className="px-3 py-4 font-bold text-slate-700">₹{Number(c.total_budget || 0).toLocaleString()}</td>
                                                    <td className="px-3 py-4 text-xs text-slate-500">{c.location || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {activeTab === 'Payments' && (
                        <div className="bg-white p-8 rounded-none shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <CreditCard size={20} className="text-blue-600" /> Payment & Ledger (Read-Only)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                <div className="p-4 bg-slate-50 rounded-none border border-slate-100">
                                    <p className="text-xs text-slate-500">Total paid amount</p>
                                    <p className="text-xl font-bold text-slate-800 mt-1">₹4,25,00,000</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-none border border-slate-100">
                                    <p className="text-xs text-slate-500">Partner share</p>
                                    <p className="text-xl font-bold text-green-600 mt-1">₹1,80,00,000</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-none border border-slate-100">
                                    <p className="text-xs text-slate-500">Franchise share</p>
                                    <p className="text-xl font-bold text-blue-600 mt-1">₹45,00,000</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-none border border-slate-100">
                                    <p className="text-xs text-slate-500">Payout status</p>
                                    <p className="text-xl font-bold text-slate-800 mt-1 flex items-center gap-2">
                                        <CheckCircle size={18} className="text-green-500" /> Settled
                                    </p>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-none border border-slate-200 font-mono text-xs text-slate-600">
                                <p className="mb-2 font-bold text-slate-400">Latest CRM transaction reference</p>
                                <div className="flex justify-between items-center">
                                    <span>TXN-ID: 88291002-XIGI-CRM-SYNC-V2</span>
                                    <span>Verified: Today 10:00 AM</span>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <p className="mb-2 font-bold text-slate-400">Screen level earned amount (sample)</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <span>LED-002: ₹12,400</span>
                                        <span>LED-076: ₹45,200</span>
                                        <span>LCD-020: ₹8,100</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Issues & Violations' && (
                        <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-red-50/50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <AlertOctagon size={20} className="text-red-500" /> Compliance & Issues
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4 p-4 border border-red-100 bg-red-50 rounded-none">
                                        <AlertTriangle className="text-red-600 shrink-0" size={20} />
                                        <div>
                                            <p className="font-bold text-red-800 text-sm">Payment Failure Detected</p>
                                            <p className="text-red-700 text-xs mt-1">CRM flag raised for invoice INV-2024-003. Auto-suspension warning active.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-4 border border-orange-100 bg-orange-50 rounded-none">
                                        <Activity className="text-orange-600 shrink-0" size={20} />
                                        <div>
                                            <p className="font-bold text-orange-800 text-sm">Creative Policy Violation</p>
                                            <p className="text-orange-700 text-xs mt-1">Creative CR-2099 rejected due to brand safety guidelines (Competitor Logo).</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative min-h-screen"
        >
            {viewMode === 'list' ? renderListView() : renderFullPageView()}

            {/* Quick View Drawer */}
            {drawerOpen && selectedAdvertiser && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        className="absolute right-0 top-0 bottom-0 w-[450px] bg-slate-50 shadow-2xl flex flex-col"
                    >
                        {/* Drawer Header */}
                        <div className="p-6 bg-white border-b border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <StatusBadge status={selectedAdvertiser.status} />
                                        <span className="px-2 py-0.5 bg-slate-100 rounded-none text-[10px] font-bold text-slate-500 border border-slate-200">
                                            {selectedAdvertiser.type}
                                        </span>
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-800">{selectedAdvertiser.name}</h2>
                                    <p className="text-[9px] text-slate-400 font-mono mt-1">{selectedAdvertiser.id}</p>
                                </div>
                                <button
                                    onClick={() => setDrawerOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-none transition-colors border border-transparent hover:border-slate-200"
                                >
                                    <ArrowLeft className="rotate-180" size={20} />
                                </button>
                            </div>

                            {/* Drawer Tabs */}
                            <div className="flex gap-4 border-b border-slate-100 -mb-6">
                                {['Overview', 'Performance'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveDrawerTab(tab)}
                                        className={`pb-4 text-[10px] font-bold transition-all relative ${activeDrawerTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {tab}
                                        {activeDrawerTab === tab && (
                                            <motion.div layoutId="drawerTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {activeDrawerTab === 'Overview' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-white rounded-none border border-slate-100 shadow-sm">
                                            <p className="text-[9px] font-bold text-slate-400 mb-1">Total spend</p>
                                        </div>
                                        <div className="p-3 bg-white rounded-none border border-slate-100 shadow-sm">
                                            <p className="text-[9px] font-bold text-slate-400 mb-1">Risk score</p>
                                            <p className={`text-lg font-black ${selectedAdvertiser.riskScore > 50 ? 'text-red-600' : 'text-green-600'}`}>
                                                {selectedAdvertiser.riskScore}%
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-3 bg-white rounded-none border border-slate-100">
                                            <span className="text-xs text-slate-500">Brands</span>
                                            <span className="text-sm font-bold text-slate-800">{selectedAdvertiser.brandCount}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-white rounded-none border border-slate-100">
                                            <span className="text-xs text-slate-500">Active campaigns</span>
                                            <span className="text-sm font-bold text-slate-800">{selectedAdvertiser.campaignCount}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-white rounded-none border border-slate-100">
                                            <span className="text-xs text-slate-500">Contact</span>
                                            <span className="text-sm font-bold text-slate-800">{selectedAdvertiser.contact}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-12 text-center">
                                    <Activity className="mx-auto text-slate-300 mb-2" size={32} />
                                    <p className="text-slate-500 text-sm font-medium">Performance data loading...</p>
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-6 bg-white border-t border-slate-100">
                            <button
                                onClick={handleOpenFullPage}
                                className="w-full py-3.5 bg-blue-600 text-white rounded-none font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                                View full detail page <ChevronRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default AdvertisersBrands;

