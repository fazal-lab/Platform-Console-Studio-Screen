import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Download,
    MessageSquare,
    CheckCircle2,
    Clock,
    ShieldAlert,
    Search,
    ChevronRight,
    X,
    MapPin,
    Camera,
    FileText,
    Eye
} from 'lucide-react';

const DisputesListPage = () => {
    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [selectedDispute, setSelectedDispute] = useState(null);

    useEffect(() => {
        fetchDisputes();
    }, []);

    const fetchDisputes = async () => {
        setLoading(true);
        try {
            const response = await api.get('disputes/');
            const mapped = response.data.map(d => ({
                id: `DSP-${d.id}`,
                numericId: d.id,
                partner: d.partner_name || "Unknown Partner",
                campaign: d.campaign_name || "Unknown Campaign",
                reason: d.reason,
                status: d.ticket_status === 'open' ? "Pending Evidence" :
                    d.ticket_status === 'resolved' ? "Resolved" : "Escalated",
                date: new Date(d.created_at).toISOString().split('T')[0],
                amount: "₹0", // Not in model yet
                location: "Varies",
                evidence: []
            }));
            setDisputes(mapped);
        } catch (error) {
            console.error('Error fetching disputes:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDisputes = useMemo(() => {
        return disputes.filter(d => {
            const matchesSearch = d.partner.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.campaign.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'All' ? true : d.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [disputes, searchTerm, filterStatus]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
            case 'Pending Evidence': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Escalated': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        Disputes & Evidence
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">Track and resolve campaign delivery disputes with partners.</p>
                </div>
                <button className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-none text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm cursor-pointer">
                    <Download size={14} />
                    Export Report
                </button>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Disputes', val: '24', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Resolved', val: '18', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Pending Evidence', val: '4', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Escalated', val: '2', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">{kpi.label}</p>
                            <p className={`text-2xl font-bold mt-2 ${kpi.color}`}>{kpi.val}</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">Pending action</p>
                        </div>
                        <div className={`p-2.5 rounded-xl ${kpi.bg} ${kpi.color}`}>
                            <kpi.icon size={24} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by ID, partner or campaign..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-none border border-slate-200 bg-white focus:outline-none focus:border-blue-500 transition-all text-slate-700 shadow-sm font-bold"
                    />
                </div>
                <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                    {['All', 'Pending Evidence', 'Resolved', 'Escalated'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 py-2 rounded-none text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${filterStatus === status
                                ? 'bg-slate-800 text-white border-slate-800 shadow-lg'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-400 font-bold text-[10px]">
                                <th className="px-6 py-4 border-b border-slate-100">Dispute ID</th>
                                <th className="px-6 py-4 border-b border-slate-100">Partner & Campaign</th>
                                <th className="px-6 py-4 border-b border-slate-100">Reason</th>
                                <th className="px-6 py-4 border-b border-slate-100">Claim Amount</th>
                                <th className="px-6 py-4 border-b border-slate-100 text-center">Status</th>
                                <th className="px-6 py-4 border-b border-slate-100">Date</th>
                                <th className="px-6 py-4 border-b border-slate-100"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredDisputes.map((dispute) => (
                                <tr
                                    key={dispute.id}
                                    onClick={() => setSelectedDispute(dispute)}
                                    className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                                >
                                    <td className="px-6 py-4 font-mono text-[10px] font-bold text-slate-400">{dispute.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-bold text-slate-800">{dispute.partner}</div>
                                        <div className="text-[10px] text-blue-600 font-medium mt-0.5">{dispute.campaign}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-600 font-medium truncate max-w-[200px]">{dispute.reason}</div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-700 text-xs">{dispute.amount}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-none text-[9px] font-bold border ${getStatusStyle(dispute.status)}`}>
                                            {dispute.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-[10px] text-slate-500 font-medium">{dispute.date}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-none transition-colors cursor-pointer">
                                            <ChevronRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dispute Detail Drawer */}
            <AnimatePresence>
                {selectedDispute && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDispute(null)}
                            className="fixed inset-0 bg-slate-900/20 mb-0 backdrop-blur-sm z-[60]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono font-bold text-slate-400">{selectedDispute.id}</span>
                                        <span className={`px-2 py-0.5 rounded-none text-[9px] font-bold border ${getStatusStyle(selectedDispute.status)}`}>
                                            {selectedDispute.status}
                                        </span>
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-800">{selectedDispute.partner}</h2>
                                    <p className="text-xs text-blue-600 font-bold">{selectedDispute.campaign}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedDispute(null)}
                                    className="p-2 rounded-none hover:bg-slate-200 text-slate-500 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {/* Reason & Amount */}
                                <div className="p-4 rounded-none bg-slate-50 border border-slate-100 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 mb-1">Dispute Reason</p>
                                        <p className="text-sm font-bold text-slate-700">{selectedDispute.reason}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 mb-1">Claim Amount</p>
                                        <p className="text-xl font-black text-red-600">{selectedDispute.amount}</p>
                                    </div>
                                </div>

                                {/* Location */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-3">Affected Location</h3>
                                    <div className="flex items-start gap-3 bg-white p-3 rounded-none border border-slate-100 shadow-sm">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-none">
                                            <MapPin size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{selectedDispute.location}</p>
                                            <p className="text-xs text-slate-500">Screen Profiler matched with log data</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Evidence Section */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-bold text-slate-400">Evidence & Analytics</h3>
                                        <button className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline cursor-pointer">
                                            <Download size={12} /> Full Logs
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {selectedDispute.evidence.map((ev, i) => (
                                            <div key={i} className={`p-3 rounded-none border ${ev.type === 'photo' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
                                                <div className="flex items-start gap-3">
                                                    {ev.type === 'photo' ? (
                                                        <Camera className="text-indigo-600 mt-1" size={16} />
                                                    ) : (
                                                        <FileText className="text-slate-400 mt-1" size={16} />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="text-xs font-bold text-slate-800">{ev.label || 'System Log Notification'}</p>
                                                        <p className="text-[11px] text-slate-600 mt-0.5">{ev.message || 'Verification capture stored in secure vault.'}</p>
                                                        {ev.timestamp && <span className="text-[9px] text-slate-400 mt-1 block font-mono">{ev.timestamp} UTC</span>}
                                                    </div>
                                                    {ev.type === 'photo' && (
                                                        <div className="w-12 h-12 bg-slate-200 rounded-none flex items-center justify-center">
                                                            <Eye size={16} className="text-slate-400" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Decision Timeline */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-3">Decision Timeline</h3>
                                    <div className="space-y-4 ml-2 border-l-2 border-slate-100 pl-4 py-2">
                                        <div className="relative">
                                            <div className="absolute -left-5.5 top-0 w-3 h-3 bg-blue-600 rounded-none border-2 border-white" />
                                            <p className="text-xs font-bold text-slate-800">Dispute Opened</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Automatic detection by AI Auditor</p>
                                            <span className="text-[9px] text-slate-400 font-mono">2024-05-20 10:15</span>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-5.5 top-0 w-3 h-3 bg-slate-200 rounded-none border-2 border-white" />
                                            <p className="text-xs font-bold text-slate-500">Review Pending</p>
                                            <p className="text-[10px] text-slate-400">Waiting for admin confirmation</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                                <button
                                    onClick={() => setSelectedDispute(null)}
                                    className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-none hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
                                >
                                    Reject Claim
                                </button>
                                <button className="flex-1 py-3.5 bg-blue-600 text-white text-xs font-bold rounded-none hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer">
                                    <CheckCircle2 size={16} />
                                    Resolve Dispute
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default DisputesListPage;

