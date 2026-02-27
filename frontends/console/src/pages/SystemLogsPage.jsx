import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Search, Filter, FileText, AlertTriangle, CheckCircle, XCircle, Info, UserCircle, Download, ChevronRight, X, Shield, Database, Activity, Globe, Clock, Eye, Copy, Server } from 'lucide-react';
import api from '../utils/api';

const mockLogs = [
    {
        id: 1,
        timestamp: "2025-02-14 10:22:11",
        event: "Campaign CMP-1044 updated: budget increased",
        category: "Campaign",
        user: "karthik@xigi.in",
        severity: "Info",
        details: "Budget increased from 50,000 to 75,000",
    },
    {
        id: 2,
        timestamp: "2025-02-14 10:05:02",
        event: "Screen LED-002 brightness dropped to 40%",
        category: "Screen",
        user: "system",
        severity: "Warning",
        details: "Detected by AI Camera Feed",
    },
    {
        id: 3,
        timestamp: "2025-02-14 09:48:40",
        event: "Partner login attempt failed",
        category: "User Action",
        user: "MetroDigital",
        severity: "Critical",
        details: "3 failed attempts from IP 172.16.44.10",
    },
    {
        id: 4,
        timestamp: "2025-02-14 09:33:18",
        event: "API outage: NovaStar Cloud sync failed",
        category: "API",
        user: "system",
        severity: "Critical",
        details: "503 error for 14 minutes",
    },
    {
        id: 5,
        timestamp: "2025-02-14 09:15:00",
        event: "Creative CR-2099 approved",
        category: "User Action",
        user: "anjali@xigi.in",
        severity: "Info",
        details: "Manual override of AI warning",
    },
    {
        id: 6,
        timestamp: "2025-02-14 08:55:12",
        event: "System Maintenance Started",
        category: "System",
        user: "admin",
        severity: "Info",
        details: "Scheduled patch v2.4.1",
    }
];

const SystemLogsPage = () => {
    const [logs, setLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('');
    const [filterTime, setFilterTime] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await api.get('audit-logs/');
            const mappedLogs = response.data.map(log => ({
                id: log.id,
                timestamp: new Date(log.created_at).toLocaleString(),
                event: log.action,
                category: log.component,
                user: log.user_email || 'System',
                severity: log.action.toLowerCase().includes('failed') || log.action.toLowerCase().includes('error') ? 'Critical' :
                    log.action.toLowerCase().includes('updated') ? 'Warning' : 'Info',
                details: log.description,
            }));
            setLogs(mappedLogs);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = log.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = filterCategory ? log.category === filterCategory : true;
            const matchesSeverity = filterSeverity ? log.severity === filterSeverity : true;
            return matchesSearch && matchesCategory && matchesSeverity;
        });
    }, [logs, searchTerm, filterCategory, filterSeverity]);

    const clearFilters = () => {
        setSearchTerm('');
        setFilterCategory('');
        setFilterSeverity('');
        setFilterTime('');
    };

    const getSeverityStyles = (severity) => {
        switch (severity) {
            case 'Critical': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle };
            case 'Warning': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertTriangle };
            case 'Info': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Info };
            default: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: Info };
        }
    };

    // PDF Export function for logs
    const handleExportLogs = (timeRange) => {
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(18);
        const title = timeRange === '24h' ? 'System Logs - Last 24 Hours' :
            timeRange === '7d' ? 'System Logs - Last 7 Days' :
                'System Logs - Complete Export';
        doc.text(title, 14, 20);

        // Add date
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        // Prepare table data
        const tableData = filteredLogs.map(log => [
            log.timestamp,
            log.event,
            log.category,
            log.user,
            log.severity
        ]);

        // Add table
        autoTable(doc, {
            startY: 35,
            head: [['Timestamp', 'Event', 'Category', 'User', 'Severity']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241] },
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 60 },
                2: { cellWidth: 25 },
                3: { cellWidth: 35 },
                4: { cellWidth: 20 }
            }
        });

        // Save PDF
        const filename = `system-logs-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 pb-20"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        System Logs
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">Monitor system activity, admin actions, and audit trails.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    variants={itemVariants}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between "
                >
                    <div>
                        <p className="text-[10px] font-black text-slate-600 mb-2">Total logs (24h)</p>
                        <p className="text-3xl font-black text-slate-900 leading-none">142</p>
                    </div>
                    <div className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <Database size={24} />
                    </div>
                </motion.div>
                <motion.div
                    variants={itemVariants}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
                >
                    <div>
                        <p className="text-[10px] font-black text-slate-600 mb-2">Critical events</p>
                        <div className="flex items-center gap-2">
                            <p className="text-3xl font-black text-red-600 leading-none">4</p>
                            <span className="text-[10px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-none uppercase">Attention Req.</span>
                        </div>
                    </div>
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl transition-colors">
                        <AlertTriangle size={24} />
                    </div>
                </motion.div>
                <motion.div
                    variants={itemVariants}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
                >
                    <div>
                        <p className="text-[10px] font-black text-slate-600 mb-2">API failures</p>
                        <p className="text-3xl font-black text-orange-600 leading-none">2</p>
                    </div>
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl transition-colors">
                        <Globe size={24} />
                    </div>
                </motion.div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-none border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-700 shadow-sm"
                    />
                </div>

                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="flex-1 lg:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="">All Categories</option>
                        <option value="System">System</option>
                        <option value="Campaign">Campaign</option>
                        <option value="Screen">Screen</option>
                        <option value="Partner">Partner</option>
                        <option value="User Action">User Action</option>
                        <option value="API">API</option>
                    </select>

                    <select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value)}
                        className="flex-1 lg:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="">All Severity</option>
                        <option value="Critical">Critical</option>
                        <option value="Warning">Warning</option>
                        <option value="Info">Info</option>
                    </select>

                    <select
                        value={filterTime}
                        onChange={(e) => setFilterTime(e.target.value)}
                        className="flex-1 lg:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="">All Time</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>

                    {(filterCategory || filterSeverity || filterTime || searchTerm) && (
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-none text-slate-400 hover:text-red-500 transition-colors shadow-sm cursor-pointer"
                            title="Clear Filters"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto pb-4">
                <table className="w-full text-left border-separate border-spacing-y-0 text-sm">
                    <thead>
                        <tr className="text-slate-400 font-bold text-[10px]">
                            <th className="px-4 py-3">Timestamp</th>
                            <th className="px-4 py-3">Event</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">User / System</th>
                            <th className="px-4 py-3">Severity</th>
                            <th className="px-4 py-3">Details</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white p-2 shadow-sm">
                        {filteredLogs.map((log, idx) => {
                            const style = getSeverityStyles(log.severity);
                            return (
                                <tr
                                    key={log.id}
                                    onClick={() => setSelectedLog(log)}
                                    className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                                    style={idx !== filteredLogs.length - 1 ? { borderBottom: '1px solid #d7d7d7' } : {}}
                                >
                                    <td className={`px-4 py-2 border-b border-slate-100 font-mono text-[9px] text-slate-500 whitespace-nowrap ${idx === 0 ? 'rounded-tl-2xl' : ''} ${idx === filteredLogs.length - 1 ? 'border-0 rounded-bl-2xl' : ''}`}>
                                        {log.timestamp}
                                    </td>
                                    <td className="px-4 py-2 border-b border-slate-100 font-medium text-slate-800 text-xs">
                                        {log.event}
                                    </td>
                                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">
                                        <span className="px-2 py-0.5 bg-slate-100 rounded-none text-[9px] font-bold text-slate-500 border border-slate-200">
                                            {log.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">
                                        <div className="flex items-center gap-1.5">
                                            {log.user === 'system' ? <Server size={12} className="text-slate-400" /> : <UserCircle size={12} className="text-slate-400" />}
                                            <span className="text-xs">{log.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 border-b border-slate-100">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[9px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                                            <style.icon size={10} />
                                            {log.severity}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 text-[10px] truncate max-w-[200px]" title={log.details}>
                                        {log.details}
                                    </td>
                                    <td className={`px-4 py-2 border-b border-slate-100 text-right ${idx === 0 ? 'rounded-tr-2xl' : ''} ${idx === filteredLogs.length - 1 ? 'border-0 rounded-br-2xl' : ''}`}>
                                        <div className="flex items-center justify-end gap-1 text-blue-600 group-hover:text-blue-700 font-bold text-[10px]">
                                            View <ChevronRight size={12} />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 rounded-2xl">
                                    No logs found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>



            <motion.div
                variants={itemVariants}
                className="flex flex-col md:flex-row gap-4 justify-end pt-4 border-t border-slate-200"
            >
                <button
                    onClick={() => handleExportLogs('24h')}
                    className="px-6 py-3.5 bg-white border border-slate-200 rounded-none text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                    <Download size={16} /> Export Last 24 Hours
                </button>
                <button
                    onClick={() => handleExportLogs('7d')}
                    className="px-6 py-3.5 bg-white border border-slate-200 rounded-none text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                    <Download size={16} /> Export Last 7 Days
                </button>
                <button
                    onClick={() => handleExportLogs('all')}
                    className="px-6 py-3.5 bg-slate-800 text-white rounded-none font-bold text-sm hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-500/20 cursor-pointer"
                >
                    <Database size={16} /> Export All Logs
                </button>
            </motion.div>

            <AnimatePresence>
                {selectedLog && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedLog(null)}
                            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
                            style={{ marginBottom: "0px" }}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100 rounded-none"
                            style={{ marginTop: "0px", marginBottom: "0px" }}
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Log Details</h2>
                                    <p className="text-[10px] font-mono font-bold text-slate-400 mt-2">UUID: {selectedLog.id} • SCOPE: AUDIT_TRAIL</p>
                                </div>
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className={`p-6 rounded-2xl border ${getSeverityStyles(selectedLog.severity).bg} ${getSeverityStyles(selectedLog.severity).border} flex gap-4 overflow-hidden relative group`}>
                                    <div className="absolute -right-4 -top-4 w-24 h-24 opacity-5 group-hover:scale-110 transition-transform">
                                        {React.createElement(getSeverityStyles(selectedLog.severity).icon, { size: 96 })}
                                    </div>
                                    <div className={`p-3 rounded-xl bg-white shadow-sm ${getSeverityStyles(selectedLog.severity).text} relative z-10`}>
                                        {React.createElement(getSeverityStyles(selectedLog.severity).icon, { size: 24 })}
                                    </div>
                                    <div className="relative z-10">
                                        <p className={`font-black text-[10px] uppercase tracking-widest ${getSeverityStyles(selectedLog.severity).text}`}>
                                            {selectedLog.severity} PRIORITY
                                        </p>
                                        <p className="text-slate-900 font-bold text-base mt-1">{selectedLog.event}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Audit Metadata</h3>
                                    <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                                        <div className="p-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</span>
                                            <span className="text-sm font-bold text-slate-800 font-mono tracking-tighter">{selectedLog.timestamp}</span>
                                        </div>
                                        <div className="p-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</span>
                                            <span className="text-sm font-bold text-slate-800 uppercase">{selectedLog.category}</span>
                                        </div>
                                        <div className="p-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actor</span>
                                            <span className="text-sm font-bold text-blue-600 underline decoration-blue-200 underline-offset-4">{selectedLog.user}</span>
                                        </div>
                                        <div className="p-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IP Reference</span>
                                            <span className="text-sm font-bold text-slate-800 font-mono">192.168.1.42</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Technical Description</h3>
                                    <div className="p-6 bg-white rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 leading-relaxed shadow-sm italic">
                                        "{selectedLog.details}"
                                    </div>
                                </div>

                                {selectedLog.category === 'Campaign' && (
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400  mb-3">Change Snapshot</h3>
                                        <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs overflow-hidden">
                                            <div className="text-red-400">- budget: 50,000</div>
                                            <div className="text-green-400">+ budget: 75,000</div>
                                            <div className="text-slate-500 mt-2"># Modified by {selectedLog.user}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-3">
                                <button className="w-full py-3.5 bg-slate-800 text-white rounded-none mb-3 font-bold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-500/20 flex items-center justify-center gap-2 cursor-pointer">
                                    <Download size={18} /> Export Log JSON
                                </button>
                                <div className="flex gap-3">
                                    <button className="flex-1 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-none font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                        <Copy size={18} /> Copy ID
                                    </button>
                                    <button
                                        onClick={() => setSelectedLog(null)}
                                        className="flex-1 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-none font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default SystemLogsPage;

