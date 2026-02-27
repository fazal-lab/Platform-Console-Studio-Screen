import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity,
  Database,
  Server,
  Info,
  ArrowRight,
  Search,
  Filter,
  Clock
} from 'lucide-react';

const initialPartners = [
  {
    id: '1',
    name: 'DigitalSky Media',
    type: 'Broadsign API',
    lastSync: '2 minutes ago',
    status: 'active',
    rate: 'Every 3 min',
    version: 'v2.1',
    issues: 0
  },
  {
    id: '2',
    name: 'AdNext Screens',
    type: 'Custom CMS',
    lastSync: '14 min ago',
    status: 'warning',
    rate: 'Every 5 min',
    version: 'v1.8',
    issues: 2
  },
  {
    id: '3',
    name: 'MetroView DOOH',
    type: 'VIOOH API',
    lastSync: '1 hour ago',
    status: 'error',
    rate: 'Every 10 min',
    version: 'v3.0',
    issues: 5
  },
  {
    id: '4',
    name: 'CityScape Outdoor',
    type: 'Ayuda',
    lastSync: 'Just now',
    status: 'active',
    rate: 'Every 1 min',
    version: 'v4.2',
    issues: 0
  },
  {
    id: '5',
    name: 'Prime Display Net',
    type: 'Scala',
    lastSync: '4 minutes ago',
    status: 'active',
    rate: 'Every 5 min',
    version: 'v2.1',
    issues: 0
  },
  {
    id: '6',
    name: 'Urban Reach',
    type: 'Proprietary',
    lastSync: '28 minutes ago',
    status: 'warning',
    rate: 'Every 15 min',
    version: 'v1.0.4',
    issues: 1
  }
];

const initialEvents = [
  {
    id: 'e1',
    time: '12:04 PM',
    targetId: 'DX-443',
    location: 'HSR Layout Main',
    type: 'PAYLOAD SYNC',
    message: 'Payload synced successfully.',
    status: 'success'
  },
  {
    id: 'e2',
    time: '12:03 PM',
    targetId: 'MT-552',
    location: 'Metro Station North',
    type: 'SCHEMA VALIDATION',
    message: "Missing 'coordinates.lat' in payload.",
    status: 'error'
  },
  {
    id: 'e3',
    time: '12:02 PM',
    targetId: 'AD-211',
    location: 'Indiranagar 100ft',
    type: 'HEALTH CHECK',
    message: 'Brightness level out of expected range (45%).',
    status: 'warning'
  },
  {
    id: 'e4',
    time: '12:01 PM',
    targetId: 'DX-111',
    location: 'Koramangala Sony Signal',
    type: 'SCHEDULE UPDATE',
    message: 'Schedule updated. 4 new creatives added.',
    status: 'success'
  }
];

import api from '../utils/api';

const CmsSyncMonitor = () => {
  const [partners, setPartners] = useState([]);
  const [events] = useState(initialEvents);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const response = await api.get('screens/');
      const mapped = response.data.map(l => ({
        id: l.id,
        name: l.name,
        type: l.cms_brand || 'None',
        lastSync: 'Just now',
        status: l.cms_api_endpoint ? 'active' : 'warning',
        rate: l.cms_api_endpoint ? 'Live' : 'N/A',
        version: 'v1.0',
        issues: l.cms_api_endpoint ? 0 : 1
      }));
      setPartners(mapped);
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchPartners();
  };

  const filteredPartners = partners.filter(p => {
    const search = searchTerm.toLowerCase();
    const name = (p.name || '').toLowerCase();
    const type = (p.type || '').toLowerCase();

    const matchesSearch = name.includes(search) || type.includes(search);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle size={18} className="text-green-500" />;
      case 'warning': return <AlertTriangle size={18} className="text-orange-500" />;
      case 'error': return <XCircle size={18} className="text-red-500" />;
      default: return <Activity size={18} className="text-slate-400" />;
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'active': return 'bg-green-50 text-green-700 border-green-200';
      case 'warning': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'error': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-20 relative"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            CMS Sync Monitor
          </h1>
          <p className="text-slate-500 mt-1">Monitor partner data pipelines and API health.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-none border border-slate-200 text-xs font-medium text-slate-500 shadow-sm">
            <Activity size={14} className="text-blue-500 animate-pulse" />
            Live Monitoring
          </div>
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-none bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm cursor-pointer ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}
            title="Refresh Data"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active Sync', val: partners.filter(p => p.status === 'active').length, icon: RefreshCw, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Warnings', val: partners.filter(p => p.status === 'warning').length, icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Errors', val: partners.filter(p => p.status === 'error').length, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Data Freshness', val: '98%', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((k, i) => (
          <motion.div
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 shadow-sm border border-slate-100 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-bold text-slate-800">{k.label}</p>
              <p className={`text-2xl font-bold mt-2 ${k.color}`}>{k.val}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Live sync</p>
            </div>
            <div className={`p-2.5 rounded-xl ${k.bg} ${k.color}`}>
              <k.icon size={24} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Controls & Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white p-4  shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center"
      >
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search partners or CMS type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-700 shadow-sm text-sm"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {['all', 'active', 'warning', 'error'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-none text-sm font-bold capitalize whitespace-nowrap transition-colors border cursor-pointer ${statusFilter === status
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Main Table */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Server size={18} className="text-slate-400" /> Partner Integrations
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock size={12} />
            <span className="font-mono">Last check: {lastUpdated}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Partner Name</th>
                <th className="px-6 py-4">CMS Type</th>
                <th className="px-6 py-4">Last Sync</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Sync Rate</th>
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">Issues</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {filteredPartners.length > 0 ? (
                  filteredPartners.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-bold text-slate-700">{p.name}</td>
                      <td className="px-6 py-4 text-slate-600">{p.type}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.lastSync}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-none text-xs font-bold border ${getStatusStyles(p.status)}`}>
                          {getStatusIcon(p.status)}
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">{p.rate}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{p.version}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${p.issues > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {p.issues} issues
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-none transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                          <ArrowRight size={16} />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                      No partners found matching your filters.
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Live Event Stream */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 px-1">
          <Clock size={16} className="text-slate-400" /> Live Event Stream
        </h2>

        <div className="relative ml-4 pl-8 border-l-2 border-slate-100 space-y-6 py-2">
          {events.map((event, idx) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative"
            >
              {/* Timeline Icon Node */}
              <div className={`absolute -left-[45px] top-1 w-8 h-8 rounded-none border-4 border-white flex items-center justify-center bg-white shadow-sm ring-1 ring-slate-100`}>
                {event.status === 'success' && <CheckCircle size={14} className="text-green-500" />}
                {event.status === 'warning' && <AlertTriangle size={14} className="text-orange-500" />}
                {event.status === 'error' && <XCircle size={14} className="text-red-500" />}
              </div>

              {/* Event Card */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 transition-all hover:shadow-md hover:bg-white cursor-default">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-slate-800">{event.time}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-sm font-bold text-slate-700">{event.targetId}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 mx-1"></span>
                  <span className="text-xs text-slate-400 font-medium">{event.location}</span>
                </div>

                <h4 className="text-[10px] font-bold text-slate-500 mb-1">
                  {event.type}
                </h4>
                <p className="text-sm text-slate-600">
                  {event.message}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3"
      >
        <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-sm font-bold text-blue-800">System Information</h4>
          <p className="text-sm text-blue-700 mt-1">
            This module auto-checks partner CMS APIs every 90 seconds and logs sync events, payload differences, version mismatches, and stale data errors.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CmsSyncMonitor;

