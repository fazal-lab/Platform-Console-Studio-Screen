import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    MapPin,
    Calendar,
    Monitor,
    Activity,
    Target,
    Layers,
    Clock,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    FileText,
    Play,
    Image as ImageIcon,
    Cpu,
    TrendingUp,
    Download,
    Pause,
    RefreshCw,
    AlertCircle,
    ArrowRight,
    Lock,
    Unlock,
    CreditCard,
    FileCheck,
    MessageSquare,
    AlertOctagon,
    Plus
} from 'lucide-react';
import api from '../utils/api';

const CampaignDetailPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Overview');
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [tickets, setTickets] = useState([]);

    useEffect(() => {
        fetchCampaign();
    }, [id]);

    const fetchCampaign = async () => {
        setLoading(true);
        try {
            // Extract numeric ID from CMP-ID
            const numericId = id.includes('-') ? id.split('-')[1] : id;
            const response = await api.get(`campaigns/${numericId}/`);
            setCampaign(response.data);
        } catch (error) {
            console.error('Error fetching campaign:', error);
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const tabs = ['Overview', 'Screens', 'Creatives', 'AI Insights', 'Operations', 'Tickets', 'Logs'];

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6 pb-20"
        >
            {/* 2. TOP BAR */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={() => navigate('/console/campaigns')}
                        className="flex items-center text-slate-400 hover:text-blue-600 mb-2 text-sm font-medium transition-colors"
                    >
                        <ChevronLeft size={16} className="mr-1" />
                        Back to Campaigns
                    </button>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                            Campaign: {id}
                        </h1>
                        <span className="px-2 py-0.5 rounded-none bg-green-100 text-green-700 text-[10px] font-bold border border-green-200 flex items-center gap-1 uppercase tracking-wider">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                            {campaign?.status || 'Active'}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{campaign?.company_name || 'Loading...'}</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-400">Total budget</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">₹{parseFloat(campaign?.budget || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                        <DollarSign size={24} />
                    </div>
                </div>
            </header>

            {/* 3. CAMPAIGN SUMMARY CARD */}
            <motion.div
                variants={itemVariants}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    {/* Left Column: Info */}
                    <div className="col-span-2 p-8">
                        <h3 className="text-sm font-bold text-slate-400 mb-6">Campaign metadata</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            <div>
                                <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Target size={14} /> Objective</p>
                                <p className="font-bold text-slate-800">Brand Awareness</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><MapPin size={14} /> Cities</p>
                                <p className="font-bold text-slate-800">Chennai</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Monitor size={14} /> Screens Used</p>
                                <p className="font-bold text-slate-800">12 Screens</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Layers size={14} /> Frequency</p>
                                <p className="font-bold text-slate-800">180 plays/day</p>
                            </div>
                            <div className="col-span-2 md:col-span-4 mt-2">
                                <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Calendar size={14} /> Duration</p>
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-800">{campaign ? new Date(campaign.start_date).toLocaleDateString() : '...'}</p>
                                    <ArrowRight size={14} className="text-slate-400" />
                                    <p className="font-bold text-slate-800">{campaign ? new Date(campaign.end_date).toLocaleDateString() : '...'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Stats */}
                    <div className="bg-slate-50/50 p-8 flex flex-col justify-center space-y-8">
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-slate-800">Spend progress</span>
                                <span className="text-xs font-bold text-slate-500">
                                    <span className="text-slate-900">₹{parseFloat(campaign?.budget || 0).toLocaleString('en-IN')}</span> / ₹{parseFloat(campaign?.budget || 0).toLocaleString('en-IN')}
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 w-[68%]" />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-slate-800">Delivery</span>
                                <span className="text-xs font-bold text-green-600">68% completed</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 w-[68%]" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-bold text-slate-800">AI health status</span>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-none text-[10px] font-bold border border-green-200 uppercase tracking-widest">
                                <Activity size={14} />
                                Strong
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 4. TABS SECTION */}
            <div className="border-b border-slate-200">
                <div className="flex gap-4 overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-2 text-xs font-medium transition-colors relative whitespace-nowrap ${activeTab === tab ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'Overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Delivery Metrics */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <Activity size={18} className="text-blue-500" /> Delivery stats
                                    </h4>
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-3xl font-black text-slate-900 leading-none">348,200</p>
                                            <p className="text-xs font-medium text-slate-500 mt-2">Total Impressions</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xl font-bold text-slate-800">3.4s</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Dwell</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-bold text-slate-800">5-9 PM</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peak Hours</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 pt-4 border-t border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Best Performing Screen</p>
                                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center gap-2 text-blue-700 font-bold text-xs">
                                        <Monitor size={14} /> LED-076 (Mount Road)
                                    </div>
                                </div>
                            </div>

                            {/* Budget Metrics */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <DollarSign size={18} className="text-green-500" /> Financial metrics
                                </h4>
                                <div className="space-y-8">
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-bold text-slate-700">Budget Spent</span>
                                            <span className="font-black text-slate-900">68%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 w-[68%]" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-slate-700">Cost Per Play</span>
                                            <span className="text-xl font-black text-green-600">₹0.85</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded inline-block">
                                            <TrendingUp size={12} /> 12% lower than category
                                        </div>
                                    </div>
                                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                        <span className="text-xs font-bold text-indigo-700">Projected Savings</span>
                                        <span className="text-lg font-black text-indigo-900">₹2,400</span>
                                    </div>
                                </div>
                            </div>

                            {/* Issues & Alerts */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <AlertCircle size={18} className="text-red-500" /> Health status
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex gap-4 items-start">
                                            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                                <AlertTriangle size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-red-900">Brightness Drop</p>
                                                <p className="text-xs text-red-600 mt-0.5">LED-002 • Manual verification req.</p>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-green-50 border border-green-100 flex gap-4 items-start opacity-70">
                                            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                                <CheckCircle size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-green-900">Camera Offline</p>
                                                <p className="text-xs text-green-600 mt-0.5">LED-108 • Resolved automatically</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Operational Snapshot */}
                                <div className="mt-8 pt-4 border-t border-slate-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ops status</span>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-none text-[10px] font-bold border border-blue-100">
                                            <Lock size={12} /> LOCKED
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-slate-500">HOLD EXPIRY</span>
                                        <span className="text-slate-700">JAN 31, 10:00 AM</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: OPERATIONS - New */}
                    {activeTab === 'Operations' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                    <h4 className="text-slate-500 font-bold text-xs tracking-tight mb-4 flex items-center gap-2">
                                        <Layers size={14} /> Line item lock status
                                    </h4>
                                    <div className="space-y-3">
                                        {[
                                            { item: "Slot 1 (Prime)", screen: "LED-076", status: "Locked", type: "Full" },
                                            { item: "Slot 2 (Evening)", screen: "LED-108", status: "Partial", type: "Partial" },
                                            { item: "Slot 4 (Morning)", screen: "LCD-003", status: "Locked", type: "Full" }
                                        ].map((slot, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{slot.item}</p>
                                                    <p className="text-[10px] text-slate-500">{slot.screen}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-none border uppercase tracking-wider ${slot.status === 'Locked' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'
                                                        }`}>
                                                        {slot.status}
                                                    </span>
                                                    {slot.status === 'Partial' && (
                                                        <button
                                                            onClick={() => setIsResolveModalOpen(true)}
                                                            className="text-[10px] font-bold text-blue-600 hover:underline"
                                                        >
                                                            Resolve
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                    <h4 className="text-slate-500 font-bold text-xs tracking-tight mb-4 flex items-center gap-2">
                                        <CreditCard size={14} /> Payment & billing
                                    </h4>
                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs text-blue-800 mb-1">Xigi One Reference</p>
                                                <p className="font-mono text-xs font-bold text-blue-900">INV-2024-X992</p>
                                            </div>
                                            <span className="px-2 py-1 bg-green-500 text-white text-[10px] font-bold rounded-none uppercase tracking-wider">Paid</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-blue-200">
                                            <div>
                                                <p className="text-[10px] text-blue-700">Transaction ID</p>
                                                <p className="text-xs font-bold text-blue-900">TXN_881273921</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-blue-700">Settled On</p>
                                                <p className="text-xs font-bold text-blue-900">Jan 28, 2024</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="mt-4 w-full py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-none hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                                        <Download size={14} /> Download Invoice
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h4 className="text-slate-500 font-bold text-xs tracking-tight mb-4 flex items-center gap-2">
                                    <FileCheck size={14} /> Proof & confidence summary
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 font-bold">Playback Proof</p>
                                        <p className="text-xl font-bold text-slate-800">99.8%</p>
                                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500 w-[99.8%]" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 font-bold">Camera Uptime</p>
                                        <p className="text-xl font-bold text-slate-800">94.2%</p>
                                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-[94.2%]" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 font-bold">AI Confidence</p>
                                        <p className="text-xl font-bold text-slate-800">Medium</p>
                                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-500 w-[65%]" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 font-bold">Scheduling status</p>
                                        <p className="text-xl font-bold text-green-600">Sync'd</p>
                                        <p className="text-[10px] text-slate-400">Last sync 5m ago</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: TICKETS - New */}
                    {activeTab === 'Tickets' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h4 className="text-slate-500 font-bold text-xs tracking-tight flex items-center gap-2">
                                    <MessageSquare size={14} /> Open tickets & disputes
                                </h4>
                                <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-none hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm">
                                    <Plus size={14} /> Open Ticket
                                </button>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-100">
                                            <th className="px-6 py-4">Ticket ID</th>
                                            <th className="px-6 py-4">Subject</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Priority</th>
                                            <th className="px-6 py-4">Created</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tickets.map((t) => (
                                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-mono font-medium text-slate-700">{t.id}</td>
                                                <td className="px-6 py-4 text-slate-800 font-medium">{t.subject}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${t.status === 'Open' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-green-100 text-green-700 border-green-200'
                                                        }`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs font-bold ${t.priority === 'High' ? 'text-red-600' : 'text-slate-500'}`}>
                                                        {t.priority}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 text-xs">{t.date}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-blue-600 hover:text-blue-800 text-xs font-bold transition-all hover:translate-x-1">View Details</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: SCREENS */}
                    {activeTab === 'Screens' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-100">
                                        <th className="px-6 py-4">Screen ID</th>
                                        <th className="px-6 py-4">Location</th>
                                        <th className="px-6 py-4">City</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-center">Plays Delivered</th>
                                        <th className="px-6 py-4">AI Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[
                                        { id: "LED-076", location: "Mount Road", city: "Chennai", status: "Active", plays: 3800, ai: "High" },
                                        { id: "LED-108", location: "OMR TIDEL Park", city: "Chennai", status: "Warning", plays: 2100, ai: "Medium" },
                                        { id: "LCD-003", location: "Anna Nagar Roundtana", city: "Chennai", status: "Active", plays: 2400, ai: "High" }
                                    ].map((screen) => (
                                        <tr key={screen.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono font-medium text-slate-700">{screen.id}</td>
                                            <td className="px-6 py-4 text-slate-600">{screen.location}</td>
                                            <td className="px-6 py-4 text-slate-600">{screen.city}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${screen.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'
                                                    }`}>
                                                    {screen.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono text-slate-700">{screen.plays.toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-bold ${screen.ai === 'High' ? 'text-green-600' : 'text-orange-500'
                                                    }`}>
                                                    {screen.ai}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TAB 3: CREATIVES */}
                    {activeTab === 'Creatives' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2].map((item) => (
                                <div key={item} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4">
                                    <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 shrink-0">
                                        <ImageIcon size={32} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <p className="font-mono text-xs font-bold text-slate-500">CR-{100 + item}</p>
                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100">MP4</span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">Duration</p>
                                            <p className="text-sm font-semibold text-slate-800">10s</p>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-100 flex items-center gap-1">
                                                <CheckCircle size={10} /> Res OK
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-100 flex items-center gap-1">
                                                <CheckCircle size={10} /> Size OK
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* TAB 4: AI INSIGHTS */}
                    {activeTab === 'AI Insights' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Category Performance */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h4 className="text-slate-500 font-bold text-xs tracking-tight mb-4">Category affinity</h4>
                                <div className="space-y-3">
                                    {[
                                        { l: 'Jewellery', v: 'Strong', c: 'bg-green-500' },
                                        { l: 'Fashion', v: 'Medium', c: 'bg-blue-500' },
                                        { l: 'Electronics', v: 'Medium', c: 'bg-blue-500' },
                                        { l: 'Real Estate', v: 'Low', c: 'bg-slate-300' },
                                    ].map((cat) => (
                                        <div key={cat.l} className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600">{cat.l}</span>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden`}>
                                                    <div className={`h-full ${cat.c}`} style={{ width: cat.v === 'Strong' ? '90%' : cat.v === 'Medium' ? '60%' : '30%' }} />
                                                </div>
                                                <span className="text-xs font-medium text-slate-500 w-12 text-right">{cat.v}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Predicted Result Lift */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h4 className="text-slate-500 font-bold text-xs tracking-tight mb-4">Predicted uplift</h4>
                                <div className="space-y-4">
                                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                        <div className="flex items-center gap-2 mb-1 text-purple-700 font-bold text-lg">
                                            <TrendingUp size={20} /> +22%
                                        </div>
                                        <p className="text-xs text-purple-800">Visibility lift if moved to LED-108 (TIDEL Park)</p>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                        <div className="flex items-center gap-2 mb-1 text-blue-700 font-bold text-lg">
                                            <TrendingUp size={20} /> +12%
                                        </div>
                                        <p className="text-xs text-blue-800">Engagement lift if frequency increased by 20%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Recommendations */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h4 className="text-slate-500 font-bold text-xs tracking-tight mb-4">AI recommendations</h4>
                                <ul className="space-y-3">
                                    <li className="flex gap-2 items-start text-sm text-slate-600">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                        Optimize 2 creatives for readability on smaller screens.
                                    </li>
                                    <li className="flex gap-2 items-start text-sm text-slate-600">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                        Move 1 screen to higher-footfall location near Metro.
                                    </li>
                                    <li className="flex gap-2 items-start text-sm text-slate-600">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                        Improve brightness on LED-076 during peak hours (5-7 PM).
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* TAB 5: LOGS */}
                    {activeTab === 'Logs' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-100">
                                        <th className="px-6 py-4">Time</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Entity</th>
                                        <th className="px-6 py-4">Message</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[
                                        { t: "10:22 AM", type: "Creative Push", ent: "LED-076", msg: "Success – Delivered new file" },
                                        { t: "10:10 AM", type: "AI Insight", ent: "System", msg: "Suggested screen shift for visibility gain" },
                                        { t: "09:55 AM", type: "Health", ent: "LED-108", msg: "Warning – Camera signal unstable" }
                                    ].map((log, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono text-slate-500 text-xs">{log.t}</td>
                                            <td className="px-6 py-4 font-medium text-slate-700">{log.type}</td>
                                            <td className="px-6 py-4 text-slate-600">{log.ent}</td>
                                            <td className="px-6 py-4 text-slate-600">{log.msg}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* 5. ACTIONS BAR */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-white p-2 pr-3 rounded-full shadow-xl border border-slate-200 flex items-center gap-2"
                >
                    <button className="flex items-center gap-2 px-4 py-2 rounded-none bg-slate-50 text-slate-600 font-medium hover:bg-slate-100 transition-colors border border-slate-200">
                        <Pause size={16} /> Pause
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-none bg-slate-50 text-slate-600 font-medium hover:bg-slate-100 transition-colors border border-slate-200">
                        <Download size={16} /> Export
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    <button className="flex items-center gap-2 px-6 py-2 rounded-none bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
                        <RefreshCw size={16} /> Force Re-Push
                    </button>
                </motion.div>
            </div>

            {/* 6. RESOLVE PARTIAL BOOKING MODAL */}
            <AnimatePresence>
                {isResolveModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsResolveModalOpen(false)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded-2xl shadow-2xl z-[90] p-8 border border-slate-100"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertOctagon className="text-orange-500" size={24} />
                                        <h2 className="text-2xl font-bold text-slate-800">Resolve Partial Booking</h2>
                                    </div>
                                    <p className="text-sm text-slate-500">Some line items failed to secure a full slot on LED-108.</p>
                                </div>
                                <button onClick={() => setIsResolveModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                                    <p className="text-sm font-bold text-orange-800 mb-2">Affected Line Item</p>
                                    <p className="text-sm text-orange-700">Slot 2 (Evening Peak) • LED-108 • 4 / 6 spots secured</p>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-xs font-bold text-slate-400 tracking-tight">Choose resolution action</p>

                                    <label className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group">
                                        <input type="radio" name="resolve" className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700">Accept Partial Slot & Refund Diff</p>
                                            <p className="text-xs text-slate-500">Secure the 4 spots and trigger a partial refund of ₹1,200 via Xigi One.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group">
                                        <input type="radio" name="resolve" className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700">Move Spots to Alternative Screen</p>
                                            <p className="text-xs text-slate-500">Move the missing 2 spots to LED-002 (Nungambakkam) for same duration.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-red-500 hover:bg-red-50 cursor-pointer transition-all group">
                                        <input type="radio" name="resolve" className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 group-hover:text-red-700">Cancel Line Item</p>
                                            <p className="text-xs text-slate-500 text-red-600/70">Cancel this specific slot entirely and refund full amount.</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-10">
                                <button
                                    onClick={() => setIsResolveModalOpen(false)}
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-none hover:bg-slate-50 transition-all uppercase tracking-wider text-sm"
                                >
                                    Later
                                </button>
                                <button
                                    onClick={() => {
                                        setIsResolveModalOpen(false);
                                        // Logic would go here
                                    }}
                                    className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-none hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 uppercase tracking-wider text-sm"
                                >
                                    Confirm & Execute
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </motion.div>
    );
};

export default CampaignDetailPage;

