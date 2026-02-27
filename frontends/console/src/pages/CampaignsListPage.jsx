import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Calendar,
    Monitor,
    Activity,
    Eye,
    X,
    TrendingUp,
    AlertCircle,
    ShieldAlert,
    Lock,
    CreditCard,
    FileCheck
} from 'lucide-react';
import api from '../utils/api';



const CampaignsListPage = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCity, setFilterCity] = useState('');
    const [filterAdvertiser, setFilterAdvertiser] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [slotBookings, setSlotBookings] = useState([]);

    useEffect(() => {
        fetchSlotBookings();
    }, []);

    const fetchSlotBookings = async () => {
        setLoading(true);
        try {
            const response = await api.get('slot-bookings/');
            setSlotBookings(response.data.bookings || []);
        } catch (error) {
            console.error('Error fetching slot bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    // Derive campaigns by grouping slot bookings on campaign_id
    const campaigns = useMemo(() => {
        const grouped = {};
        slotBookings.forEach(b => {
            const cid = b.campaign_id;
            if (!cid) return;
            if (!grouped[cid]) {
                grouped[cid] = {
                    id: cid,
                    bookings: [],
                    screens: new Set(),
                    screenNames: new Set(),
                    statuses: new Set(),
                    payments: new Set(),
                    userId: b.user_id || '—',
                    minDate: b.start_date,
                    maxDate: b.end_date,
                    totalSlots: 0,
                };
            }
            const g = grouped[cid];
            g.bookings.push(b);
            g.screens.add(b.screen);
            if (b.screen_name) g.screenNames.add(b.screen_name);
            g.statuses.add(b.status);
            g.payments.add(b.payment);
            g.totalSlots += b.num_slots || 0;
            if (b.start_date < g.minDate) g.minDate = b.start_date;
            if (b.end_date > g.maxDate) g.maxDate = b.end_date;
        });

        return Object.values(grouped).map(g => {
            // Determine overall campaign status from booking statuses
            let status = 'Active';
            if (g.statuses.has('ACTIVE')) status = 'Active';
            else if (g.statuses.has('HOLD')) status = 'Hold';
            else if (g.statuses.has('EXPIRED') && !g.statuses.has('ACTIVE')) status = 'Expired';
            else if (g.statuses.has('CANCELLED')) status = 'Cancelled';

            // Determine payment status
            const allPaid = !g.payments.has('UNPAID');

            const fmt = (d) => {
                if (!d) return '—';
                return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            };

            return {
                id: g.id,
                advertiser: `User ${g.userId}`,
                screens: g.screens.size,
                screenNames: [...g.screenNames],
                duration: `${fmt(g.minDate)} – ${fmt(g.maxDate)}`,
                totalSlots: g.totalSlots,
                status,
                payment: allPaid ? 'PAID' : 'UNPAID',
                bookingCount: g.bookings.length,
            };
        });
    }, [slotBookings]);

    // Campaign-level computed counts
    const totalCampaigns = campaigns.length;
    const activeCampaigns = useMemo(() => campaigns.filter(c => c.status === 'Active').length, [campaigns]);
    const paymentPendingCampaigns = useMemo(() => campaigns.filter(c => c.payment === 'UNPAID').length, [campaigns]);
    const expiredCampaigns = useMemo(() => campaigns.filter(c => c.status === 'Expired').length, [campaigns]);

    // Get bookings for a specific campaign
    const getBookingsForCampaign = (campaignId) => {
        if (!campaignId) return [];
        return slotBookings.filter(b => b.campaign_id === campaignId);
    };

    // Dynamic filter options
    const statusOptions = useMemo(() => [...new Set(campaigns.map(c => c.status))], [campaigns]);
    const advertiserOptions = useMemo(() => [...new Set(campaigns.map(c => c.advertiser))], [campaigns]);

    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => {
            const matchesSearch =
                c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.advertiser.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus ? c.status === filterStatus : true;
            const matchesAdvertiser = filterAdvertiser ? c.advertiser === filterAdvertiser : true;

            return matchesSearch && matchesStatus && matchesAdvertiser;
        });
    }, [campaigns, searchTerm, filterStatus, filterAdvertiser]);

    const clearFilters = () => {
        setSearchTerm('');
        setFilterStatus('');
        setFilterCity('');
        setFilterAdvertiser('');
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Live': return 'bg-green-100 text-green-700 border-green-200';
            case 'Upcoming': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Completed': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'Failed': return 'bg-red-100 text-red-700 border-red-200';
            case 'Draft': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getHealthColor = (health) => {
        switch (health) {
            case 'Strong': return 'text-green-600';
            case 'Good': return 'text-teal-600';
            case 'Average': return 'text-orange-500';
            case 'Poor': return 'text-red-600';
            default: return 'text-slate-400';
        }
    };

    const handleViewFullDetails = () => {
        if (selectedCampaign) {
            navigate(`/console/campaigns/${selectedCampaign.id}`);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* 2. TOP BAR */}
            <header className="flex flex-col gap-6 shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Campaigns</h1>
                        <p className="text-xs text-slate-500 mt-1">Manage live, upcoming, and completed DOOH campaigns.</p>
                    </div>
                </div>

                {/* Campaign Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Total Campaigns</p>
                            <p className="text-2xl font-bold text-blue-600 mt-2">{totalCampaigns}</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">All campaigns</p>
                        </div>
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><FileCheck size={24} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Active</p>
                            <p className="text-2xl font-bold text-green-600 mt-2">{activeCampaigns}</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">Currently running</p>
                        </div>
                        <div className="p-2.5 bg-green-50 text-green-600 rounded-xl"><Activity size={24} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Payment Pending</p>
                            <p className="text-2xl font-bold text-amber-600 mt-2">{paymentPendingCampaigns}</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">Awaiting payment</p>
                        </div>
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><CreditCard size={24} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Expired</p>
                            <p className="text-2xl font-bold text-red-600 mt-2">{expiredCampaigns}</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">Expired campaigns</p>
                        </div>
                        <div className="p-2.5 bg-red-50 text-red-600 rounded-xl"><ShieldAlert size={24} /></div>
                    </div>
                </div>
            </header>

            {/* 3. FILTER BAR */}
            <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-4 rounded-none shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 items-center"
            >
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-700 bg-slate-50/30 shadow-sm"
                    />
                </div>

                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 pr-8 rounded-none border border-slate-200 bg-slate-50 text-slate-700 text-sm focus:outline-none focus:border-blue-500 cursor-pointer font-bold transition-all hover:bg-white appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem]"
                    >
                        <option value="">All Status</option>
                        {statusOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <select
                        value={filterAdvertiser}
                        onChange={(e) => setFilterAdvertiser(e.target.value)}
                        className="px-3 py-2 pr-8 rounded-none border border-slate-200 bg-slate-50 text-slate-700 text-sm focus:outline-none focus:border-blue-500 cursor-pointer font-bold transition-all hover:bg-white appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem]"
                    >
                        <option value="">All Advertisers</option>
                        {advertiserOptions.map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>

                    <button
                        onClick={clearFilters}
                        className="px-3 py-2 rounded-none border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                        Clear Filters
                    </button>
                </div>
            </motion.div>

            {/* 4. CAMPAIGNS TABLE */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 font-bold text-[10px] border-b border-slate-100">
                                <th className="px-4 py-3">Campaign ID</th>
                                <th className="px-4 py-3">Advertiser</th>
                                <th className="px-4 py-3">Screens</th>
                                <th className="px-4 py-3">Slots</th>
                                <th className="px-4 py-3">Duration</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Payment</th>
                                <th className="px-4 py-3">Bookings</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white rounded-2xl shadow-sm border border-slate-100">
                            {filteredCampaigns.map((row, idx) => (
                                <motion.tr
                                    key={row.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.05 * idx }}
                                    onClick={() => setSelectedCampaign(row)}
                                    className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                                    style={idx !== filteredCampaigns.length - 1 ? { borderBottom: '1px solid #d7d7d7' } : {}}
                                >
                                    <td className={`px-4 py-2 font-mono font-medium text-slate-600 text-xs ${idx === 0 ? 'rounded-tl-2xl' : ''} ${idx === filteredCampaigns.length - 1 ? 'border-0 rounded-bl-2xl' : ''}`}>{row.id}</td>
                                    <td className="px-4 py-2 font-semibold text-slate-800 text-xs">{row.advertiser}</td>
                                    <td className="px-4 py-2 text-slate-600 text-center text-xs">{row.screens}</td>
                                    <td className="px-4 py-2 text-slate-600 text-center text-xs">{row.totalSlots}</td>
                                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap text-xs">{row.duration}</td>
                                    <td className="px-4 py-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold border ${getStatusStyle(row.status)}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold border ${row.payment === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                            {row.payment}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-600 text-center text-xs">{row.bookingCount}</td>
                                    <td className={`px-4 py-2 text-right ${idx === 0 ? 'rounded-tr-2xl' : ''} ${idx === filteredCampaigns.length - 1 ? 'border-0 rounded-br-2xl' : ''}`}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedCampaign(row);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-none border border-slate-200 text-slate-600 text-[11px] font-bold hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all bg-white shadow-sm cursor-pointer"
                                        >
                                            <Eye size={12} />
                                            View
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                            {filteredCampaigns.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                                        {loading ? 'Loading campaigns...' : 'No campaigns found matching your criteria.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* 5. CAMPAIGN DETAIL DRAWER */}
            <AnimatePresence>
                {selectedCampaign && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedCampaign(null)}
                            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] mb-0"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100"
                        >
                            {/* Drawer Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{selectedCampaign.id}</h2>
                                    <p className="text-sm text-slate-500 mt-1">Campaign Details</p>
                                </div>
                                <button
                                    onClick={() => setSelectedCampaign(null)}
                                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                                {/* Main Status Card */}
                                <div className={`py-3 px-4 rounded-none border ${getStatusStyle(selectedCampaign.status)}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold opacity-70">Current status</span>
                                        <Activity size={18} />
                                    </div>
                                    <div className="text-2xl font-bold">{selectedCampaign.status}</div>
                                </div>

                                <div className="space-y-6">
                                    {/* Advertiser Info */}
                                    <div>
                                        <h3 className="text-[10px] font-bold text-slate-400 mb-3">Advertiser</h3>
                                        <div className="bg-slate-50 rounded-none p-4 flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                                {selectedCampaign.advertiser.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{selectedCampaign.advertiser}</p>
                                                <p className="text-xs text-slate-500">Premium Partner</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Campaign Specs */}
                                    <div>
                                        <h3 className="text-[10px] font-bold text-slate-400 mb-3">Specifications</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-none bg-slate-50 border border-slate-100">
                                                <Calendar className="text-slate-400 mb-2" size={18} />
                                                <p className="text-[10px] text-slate-500 mb-1">Duration</p>
                                                <p className="font-bold text-slate-800 text-xs">{selectedCampaign.duration}</p>
                                            </div>
                                            <div className="p-4 rounded-none bg-slate-50 border border-slate-100">
                                                <Monitor className="text-slate-400 mb-2" size={18} />
                                                <p className="text-[10px] text-slate-500 mb-1">Screens</p>
                                                <p className="font-bold text-slate-800 text-xs">{selectedCampaign.screens} Screens</p>
                                            </div>
                                            <div className="p-4 rounded-none bg-slate-50 border border-slate-100">
                                                <Activity className="text-slate-400 mb-2" size={18} />
                                                <p className="text-[10px] text-slate-500 mb-1">Total Slots</p>
                                                <p className="font-bold text-slate-800 text-xs">{selectedCampaign.totalSlots} Slots</p>
                                            </div>
                                            <div className="p-4 rounded-none bg-slate-50 border border-slate-100">
                                                <CreditCard className="text-slate-400 mb-2" size={18} />
                                                <p className="text-[10px] text-slate-500 mb-1">Payment</p>
                                                <p className={`font-bold text-xs ${selectedCampaign.payment === 'PAID' ? 'text-green-600' : 'text-amber-600'}`}>{selectedCampaign.payment}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Screen Names */}
                                    {selectedCampaign.screenNames && selectedCampaign.screenNames.length > 0 && (
                                        <div>
                                            <h3 className="text-[10px] font-bold text-slate-400 mb-3">Screens</h3>
                                            <div className="space-y-2">
                                                {selectedCampaign.screenNames.map((name, i) => (
                                                    <div key={i} className="bg-slate-50 rounded-none p-3 border border-slate-100 flex items-center gap-2">
                                                        <Monitor size={14} className="text-slate-400" />
                                                        <span className="text-xs font-medium text-slate-700">{name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Operational Status - From Slot Bookings API */}
                                    <div>
                                        <h3 className="text-[10px] font-bold text-slate-400 mb-3">Slot Bookings</h3>
                                        {(() => {
                                            const campaignBookings = getBookingsForCampaign(selectedCampaign.id);
                                            if (campaignBookings.length === 0) {
                                                return (
                                                    <div className="bg-slate-50 rounded-none p-4 border border-slate-100 text-center">
                                                        <p className="text-xs text-slate-400">No slot bookings found for this campaign.</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="space-y-3">
                                                    {campaignBookings.map((booking) => (
                                                        <div key={booking.id} className="bg-slate-50 rounded-none p-4 border border-slate-100 space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs font-bold text-slate-700">{booking.screen_name || `Screen #${booking.screen}`}</span>
                                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-none ${booking.status === 'ACTIVE' ? 'text-green-600 bg-green-50' :
                                                                    booking.status === 'HOLD' ? 'text-blue-600 bg-blue-50' :
                                                                        booking.status === 'EXPIRED' ? 'text-red-600 bg-red-50' :
                                                                            'text-slate-600 bg-slate-100'
                                                                    }`}>{booking.status}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <Monitor size={14} className="text-slate-400" />
                                                                    <span className="text-[11px] text-slate-600">{booking.num_slots} slots</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Calendar size={14} className="text-slate-400" />
                                                                    <span className="text-[11px] text-slate-600">{booking.start_date} → {booking.end_date}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <CreditCard size={14} className="text-slate-400" />
                                                                    <span className="text-[11px] text-slate-600">Payment</span>
                                                                </div>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-none ${booking.payment === 'PAID' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
                                                                    }`}>{booking.payment}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[11px] text-slate-400">Source</span>
                                                                <span className="text-[10px] font-bold text-slate-500">{booking.source}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-3">
                                <button
                                    onClick={handleViewFullDetails}
                                    className="w-full py-3.5 bg-blue-600 text-white rounded-none font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <TrendingUp size={18} />
                                    View Full Details Page
                                </button>
                                {selectedCampaign.status === 'Failed' && (
                                    <button className="w-full py-3.5 bg-white text-red-600 border border-red-200 rounded-none font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 cursor-pointer">
                                        <AlertCircle size={18} />
                                        Diagnose Failure
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default CampaignsListPage;