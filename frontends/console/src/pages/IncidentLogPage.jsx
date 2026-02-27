import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
    Siren,
    Activity,
    Wrench,
    CheckCircle,
    AlertTriangle,
    Clock,
    Calendar,
    ArrowRight,
    Server,
    Shield
} from 'lucide-react';

const IncidentLogPage = () => {
    const maintenanceLog = [
        { id: 1, type: 'Planned', title: 'Firmware Update v2.4.1', date: 'Upcoming: Feb 12, 02:00 AM', status: 'Scheduled' },
        { id: 2, type: 'Emergency', title: 'Database Index Rebuild', date: 'Completed: Feb 08, 03:00 AM', status: 'Success' },
        { id: 3, type: 'Routine', title: 'Weekly Server Reboot', date: 'Completed: Feb 05, 01:00 AM', status: 'Success' }
    ];
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAuditLogs();
    }, []);

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const response = await api.get('audit-logs/');
            const mapped = response.data
                .filter(log =>
                    log.action.includes('REJECTED') ||
                    log.action.includes('SUSPENDED') ||
                    log.action.includes('FAILED') ||
                    log.action.includes('error')
                )
                .map(log => ({
                    id: `LOG-${log.id}`,
                    title: `${log.action} - ${log.target_type}`,
                    status: 'Active',
                    severity: log.action.includes('SUSPENDED') ? 'Critical' : 'Major',
                    affected: log.target_id ? `${log.target_type} #${log.target_id}` : 'System',
                    started: new Date(log.timestamp).toLocaleString(),
                    description: `Action performed by ${log.user_email || 'System'}. Details: ${log.action}`
                }));
            setIncidents(mapped.slice(0, 5));
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        <Siren className="text-red-600" />
                        Incident Log & Maintenance
                    </h1>
                    <p className="text-slate-500 mt-1">Network health monitoring and issue tracking.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50">
                        <Calendar size={18} /> Schedule Maintenance
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-sm">
                        <AlertTriangle size={18} /> Report Incident
                    </button>
                </div>
            </header>

            {/* System Health Summary */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">System Uptime</p>
                        <p className="text-2xl font-bold text-green-600 mt-2">99.98%</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Last 30 days</p>
                    </div>
                    <div className="p-2.5 bg-green-50 text-green-600 rounded-xl"><Activity size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Active Screens</p>
                        <p className="text-2xl font-bold text-slate-900 mt-2">1,248 <span className="text-sm text-slate-400 font-normal">/ 1,250</span></p>
                        <p className="text-xs font-medium text-green-600 mt-1 flex items-center gap-1"><CheckCircle size={14} /> 2 Offline</p>
                    </div>
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Server size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Open Incidents</p>
                        <p className="text-2xl font-bold text-amber-600 mt-2">{incidents.length}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Requires attention</p>
                    </div>
                    <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl"><Shield size={24} /></div>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Active Incidents */}
                <section className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <AlertTriangle size={20} className="text-red-500" />
                        Incidents
                    </h2>

                    {incidents.length > 0 ? incidents.map(inc => (
                        <div key={inc.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                            {inc.status === 'Active' && <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>}
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{inc.title}</h3>
                                <span className={`px-2 py-1 text-xs font-bold uppercase rounded ${inc.status === 'Active' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                    }`}>{inc.status}</span>
                            </div>
                            <p className="text-slate-600 mb-4">{inc.description}</p>
                            <div className="flex flex-wrap gap-4 text-sm text-slate-500 font-medium border-t border-slate-100 pt-4">
                                <span className="flex items-center gap-1"><AlertTriangle size={14} /> {inc.severity} Severity</span>
                                <span className="flex items-center gap-1"><Server size={14} /> {inc.affected}</span>
                                <span className="flex items-center gap-1"><Clock size={14} /> {inc.started}</span>
                            </div>
                        </div>
                    )) : (
                        <div className="bg-white p-12 text-center text-slate-400 border border-slate-200 rounded-xl border-dashed">
                            No active incidents detected.
                        </div>
                    )}
                </section>

                {/* Maintenance Log */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Wrench size={20} className="text-slate-500" />
                        Maintenance History
                    </h2>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {maintenanceLog.map(log => (
                                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-bold text-slate-800 text-sm">{log.title}</p>
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${log.type === 'Emergency' ? 'bg-red-100 text-red-700' :
                                            log.type === 'Planned' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                            }`}>{log.type}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">{log.date}</p>
                                    <div className="flex items-center text-xs font-semibold text-green-600">
                                        <CheckCircle size={12} className="mr-1" /> {log.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full py-3 text-center text-sm font-bold text-blue-600 hover:bg-slate-50 border-t border-slate-100">
                            View Full History
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default IncidentLogPage;
