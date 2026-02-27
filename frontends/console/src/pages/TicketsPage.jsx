import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
    Ticket,
    Filter,
    Search,
    Plus,
    MoreVertical,
    Clock,
    User,
    CheckCircle,
    AlertCircle,
    MessageSquare,
    ArrowRight
} from 'lucide-react';

const mockTickets = [
    {
        id: 'TKT-2024-001',
        title: 'Screen #404 Offline in T- Nagar',
        status: 'Open',
        priority: 'High',
        owner: 'Unassigned',
        created: '2 hours ago',
        category: 'Hardware',
        linkedEntity: 'Screen #404'
    },
    {
        id: 'TKT-2024-002',
        title: 'Creative Update Failed for Campaign CMP-1044',
        status: 'In Progress',
        priority: 'Medium',
        owner: 'Sarah M.',
        created: '5 hours ago',
        category: 'Content',
        linkedEntity: 'CMP-1044'
    },
    {
        id: 'TKT-2024-003',
        title: 'Partner Dispute: Login Issues',
        status: 'Resolved',
        priority: 'Low',
        owner: 'John D.',
        created: '1 day ago',
        category: 'Access',
        linkedEntity: 'Partner: Urban Electronics'
    },
    {
        id: 'TKT-2024-004',
        title: 'Verify new screen installation photos',
        status: 'Open',
        priority: 'Medium',
        owner: 'Unassigned',
        created: '2 days ago',
        category: 'Validation',
        linkedEntity: 'Screen #502'
    }
];

const TicketsPage = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const response = await api.get('tickets/');
            const mapped = response.data.map(t => ({
                id: `TKT-2024-${t.id}`,
                numericId: t.id,
                title: t.title,
                status: t.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                priority: t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
                owner: t.assigned_to_email || 'Unassigned',
                created: new Date(t.created_at).toLocaleString(),
                category: 'General', // Backend doesn't have category yet
                linkedEntity: t.title.includes('#') ? t.title.split('#')[1] : 'System'
            }));
            setTickets(mapped);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredTickets = tickets.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 pb-20">


            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        <Ticket className="text-blue-600" />
                        Tickets
                    </h1>
                    <p className="text-slate-500 mt-1">Centralized Ops task management.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50">
                        <Filter size={18} /> Filter
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm">
                        <Plus size={18} /> Create Ticket
                    </button>
                </div>
            </header>

            {/* KPI Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Open Tickets', v: '12', c: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'High Priority', v: '3', c: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Unassigned', v: '5', c: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Resolved Today', v: '8', c: 'text-green-600', bg: 'bg-green-50' },
                ].map((k, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">{k.label}</p>
                            <p className={`text-2xl font-bold mt-2 ${k.c}`}>{k.v}</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">Last 24h</p>
                        </div>
                        <div className={`p-2.5 rounded-xl ${k.bg} ${k.c}`}>
                            <Ticket size={24} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search tickets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex gap-2">
                    {['All', 'Open', 'In Progress', 'Resolved'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filterStatus === status
                                ? 'bg-slate-800 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ticket List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                            <th className="p-4">Ticket Details</th>
                            <th className="p-4">Status & Priority</th>
                            <th className="p-4">Owner</th>
                            <th className="p-4">Linked Entity</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredTickets.map((ticket) => (
                            <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1">
                                            {ticket.priority === 'High' || ticket.priority === 'Critical' ? <AlertCircle size={18} className="text-red-500" /> :
                                                ticket.status === 'Open' ? <MessageSquare size={18} className="text-blue-500" /> :
                                                    <CheckCircle size={18} className="text-slate-400" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{ticket.title}</p>
                                            <div className="flex items-center gap-2 mt-1 text-slate-500 text-xs">
                                                <span>#{ticket.id}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><Clock size={12} /> {ticket.created}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-2">
                                        <span className={`inline-flex w-fit px-2 py-1 text-xs font-bold rounded-md ${ticket.status === 'Open' ? 'bg-blue-100 text-blue-700' :
                                            ticket.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                            {ticket.status}
                                        </span>
                                        <span className={`inline-flex w-fit px-2 py-1 text-xs font-bold rounded-md border ${ticket.priority === 'High' || ticket.priority === 'Critical' ? 'border-red-200 text-red-700 bg-red-50' :
                                            ticket.priority === 'Medium' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                                                'border-slate-200 text-slate-600 bg-slate-50'
                                            }`}>
                                            {ticket.priority} Priority
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {ticket.owner === 'Unassigned' ? '?' : ticket.owner.charAt(0)}
                                        </div>
                                        {ticket.owner}
                                    </div>
                                </td>
                                <td className="p-4 text-slate-600">
                                    <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">{ticket.linkedEntity}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button className="p-2 hover:bg-slate-100 rounded text-slate-500 transition-colors" title="Assign">
                                            <User size={16} />
                                        </button>
                                        <button className="p-2 hover:bg-slate-100 rounded text-slate-500 transition-colors" title="Add Note">
                                            <MessageSquare size={16} />
                                        </button>
                                        <button className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 ml-2">
                                            View <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TicketsPage;
