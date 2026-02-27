import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { Search, Plus, CheckCircle, XCircle, AlertCircle, Edit, Trash2, Download, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PartnerRecords = () => {
    const navigate = useNavigate();
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

    useEffect(() => {
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        setLoading(true);
        try {
            const response = await api.get('companies/');
            const mapped = response.data.map(c => {
                // Map company_type to display label
                const typeLabels = {
                    partner: 'Partner',
                    dooh_network: 'DOOH Network',
                    franchise: 'Franchise',
                    agency: 'Agency',
                    internal: 'Internal',
                    advertiser: 'Advertiser',
                };
                const statusLabels = {
                    onboarding: 'Onboarding',
                    active: 'Active',
                    suspended: 'Suspended',
                    blocked: 'Blocked',
                };
                return {
                    id: c.partner_id || `PTR-${c.id}`,
                    numericId: c.id,
                    name: c.name,
                    displayName: c.display_name || '',
                    type: typeLabels[c.company_type] || c.company_type,
                    status: statusLabels[c.status] || (c.is_active ? 'Active' : 'Suspended'),
                    screens: 0,
                    apiKeyStatus: c.api_key ? 'Valid' : 'None',
                    email: c.primary_contact_email || c.contact_email || 'N/A',
                    phone: c.primary_contact_phone || c.contact_phone || '',
                    createdOn: new Date(c.created_at).toLocaleDateString(),
                    settlementModel: c.settlement_model || '—',
                };
            });
            setPartners(mapped);
        } catch (error) {
            console.error('Error fetching partners:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPartners = useMemo(() => {
        return partners.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = filterType === 'All' || p.type === filterType;
            const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
            return matchesSearch && matchesType && matchesStatus;
        });
    }, [partners, searchTerm, filterType, filterStatus]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': return 'bg-green-100 text-green-700 border-green-200';
            case 'Suspended': return 'bg-red-100 text-red-700 border-red-200';
            case 'Onboarding': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Blocked': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getKeyStatusIcon = (status) => {
        switch (status) {
            case 'Valid': return <CheckCircle size={14} className="text-green-500" />;
            case 'Expired': return <AlertCircle size={14} className="text-red-500" />;
            default: return <XCircle size={14} className="text-slate-400" />;
        }
    };

    const handleExport = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Xigi Partner Records', 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        const tableData = filteredPartners.map(p => [
            p.id, p.name, p.type, p.status, p.screens, p.email
        ]);

        autoTable(doc, {
            startY: 35,
            head: [['ID', 'Name', 'Type', 'Status', 'Screens', 'Email']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] },
            styles: { fontSize: 8 },
        });

        doc.save(`xigi-partners-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleDelete = async (partner, e) => {
        e.stopPropagation();
        if (!window.confirm(`Delete partner "${partner.name}"?`)) return;
        try {
            await api.delete(`companies/${partner.numericId}/`);
            fetchPartners();
        } catch (error) {
            console.error('Error deleting partner:', error);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20 relative">
            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">Partner Records</h1>
                    <p className="text-xs text-slate-500 mt-1">Manage partner entities, metadata, and system-level integration details.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-none text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                        <Download size={14} /> Export PDF
                    </button>
                    <button
                        onClick={() => navigate('/console/partner-records/add')}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-none text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer"
                    >
                        <Plus size={16} /> Add New
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, ID, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-none border border-slate-200 bg-white focus:outline-none focus:border-blue-500 transition-all text-slate-700 shadow-sm font-bold"
                    />
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="flex-1 lg:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="All">All Types</option>
                        <option value="Partner">Partner</option>
                        <option value="DOOH Network">DOOH Network</option>
                        <option value="Agency">Agency</option>
                        <option value="Franchise">Franchise</option>
                        <option value="Internal">Internal</option>
                        <option value="Advertiser">Advertiser</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="flex-1 lg:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Onboarding">Onboarding</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Blocked">Blocked</option>
                    </select>

                    {(searchTerm || filterType !== 'All' || filterStatus !== 'All') && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setFilterType('All');
                                setFilterStatus('All');
                            }}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-none text-slate-400 hover:text-red-500 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                            title="Clear Filters"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto pb-4">
                <table className="w-full text-left border-separate border-spacing-y-0 text-sm">
                    <thead>
                        <tr className="text-slate-400 font-bold text-[10px]">
                            <th className="px-4 py-3">Partner details</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-center">Screens</th>
                            <th className="px-4 py-3">Api key</th>
                            <th className="px-4 py-3">Created on</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white rounded-none shadow-sm border border-slate-100">
                        {loading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400 font-bold">Loading partners...</td></tr>
                        ) : filteredPartners.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400 font-bold">No partners found</td></tr>
                        ) : filteredPartners.map((partner, idx) => (
                            <tr
                                key={partner.id}
                                onClick={() => navigate(`/console/partner-records/edit/${partner.numericId}`)}
                                className="hover:bg-slate-50 transition-all group cursor-pointer"
                            >
                                <td className={`px-4 py-2.5 border-b border-slate-100 ${idx === 0 ? 'rounded-tl-2xl' : ''} ${idx === filteredPartners.length - 1 ? 'border-0 rounded-bl-2xl' : ''}`}>
                                    <p className="font-bold text-slate-800 text-xs">{partner.name}</p>
                                    <div className="flex items-center gap-2 text-[9px] text-slate-400 mt-0.5">
                                        <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded-none border border-slate-100">{partner.id}</span>
                                        <span>•</span>
                                        <span className="truncate max-w-[150px]">{partner.email}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 border-b border-slate-100">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-none text-[9px] font-bold border border-slate-200">
                                        {partner.type}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 border-b border-slate-100">
                                    <span className={`px-2 py-0.5 rounded-none text-[9px] font-bold border ${getStatusColor(partner.status)}`}>
                                        {partner.status}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 border-b border-slate-100 text-center font-mono font-bold text-slate-700 text-xs">
                                    {partner.screens}
                                </td>
                                <td className="px-4 py-2.5 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        {getKeyStatusIcon(partner.apiKeyStatus)}
                                        <span className="text-slate-500 text-[9px] font-bold">{partner.apiKeyStatus}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 border-b border-slate-100 text-slate-500 text-[9px] font-medium">
                                    {partner.createdOn}
                                </td>
                                <td className={`px-4 py-4 border-b border-slate-100 text-center ${idx === 0 ? 'rounded-tr-2xl' : ''} ${idx === filteredPartners.length - 1 ? 'border-0 rounded-br-2xl' : ''}`}>
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/console/partner-records/edit/${partner.numericId}`);
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-none transition-colors border border-transparent hover:border-blue-100 cursor-pointer"
                                            title="Edit"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(partner, e)}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-none transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default PartnerRecords;
