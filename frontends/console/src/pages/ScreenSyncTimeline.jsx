import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Database,
  Activity,
  ArrowRight
} from 'lucide-react';

import api from '../utils/api';

const ScreenSyncTimeline = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPartner, setFilterPartner] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterScreen, setFilterScreen] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const [playbackRes, auditRes] = await Promise.all([
        api.get('playback-logs/').catch(() => ({ data: [] })),
        api.get('audit-logs/')
      ]);

      const logEvents = auditRes.data.map(log => ({
        id: `LOG-${log.id}`,
        timestamp: new Date(log.timestamp).toLocaleTimeString(),
        screenId: log.target_id ? `SID-${log.target_id}` : 'System',
        screenName: log.target_type,
        partner: log.user_email || 'System',
        status: log.action.includes('FAILED') || log.action.includes('REJECTED') ? 'error' : 'success',
        type: log.action,
        message: `Action performed on ${log.target_type}`,
        duration: 'N/A'
      }));

      const playbackEvents = playbackRes.data.map(log => ({
        id: `PLAY-${log.id}`,
        timestamp: new Date(log.timestamp).toLocaleTimeString(),
        screenId: `SCR-${log.locality}`,
        screenName: 'Live Playback',
        partner: 'CMS Gateway',
        status: 'success',
        type: 'Playback',
        message: `Campaign ${log.campaign} played on screen ${log.locality}`,
        duration: '0.1s'
      }));

      setEvents([...logEvents, ...playbackEvents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (error) {
      console.error('Error fetching sync events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique screens for the dropdown
  const uniqueScreens = useMemo(() => {
    const screens = new Map();
    events.forEach(evt => {
      if (!screens.has(evt.screenId)) {
        screens.set(evt.screenId, evt.screenName);
      }
    });
    return Array.from(screens.entries());
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      const matchesPartner = filterPartner === 'All' || evt.partner === filterPartner;
      const matchesStatus = filterStatus === 'All' || evt.status === filterStatus;
      const matchesScreen = filterScreen === 'All' || evt.screenId === filterScreen;
      const matchesSearch = evt.screenId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        evt.message.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPartner && matchesStatus && matchesSearch && matchesScreen;
    });
  }, [events, filterPartner, filterStatus, filterScreen, searchTerm]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle size={16} className="text-green-500" />;
      case 'warning': return <AlertTriangle size={16} className="text-orange-500" />;
      case 'error': return <XCircle size={16} className="text-red-500" />;
      default: return <Activity size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'border-green-200 bg-green-50 text-green-700';
      case 'warning': return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'error': return 'border-red-200 bg-red-50 text-red-700';
      default: return 'border-slate-200 bg-slate-50 text-slate-700';
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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-20"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            Screen Sync Timeline
          </h1>
          <p className="text-slate-500 mt-1">View real-time and historical sync activity across all connected screens.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-none shadow-sm border border-slate-100">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800">Admin User</p>
            <p className="text-xs text-slate-500">Ops Team</p>
          </div>
          <div className="w-10 h-10 rounded-none bg-slate-100 flex items-center justify-center text-slate-400">
            <History size={24} />
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Sync Events', val: '1,240', sub: 'Today', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Successful', val: '1,180', sub: '95.2% Rate', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Warnings', val: '42', sub: 'Requires Review', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Errors', val: '18', sub: 'Failed Syncs', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((card, idx) => (
          <motion.div
            key={idx}
            variants={itemVariants}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-slate-400 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-slate-800">{card.val}</p>
              <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
            </div>
            <div className={`p-3 rounded-none ${card.bg} ${card.color}`}>
              <card.icon size={24} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <motion.div
        variants={itemVariants}
        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 items-center"
      >
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by screen ID or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-700 shadow-sm text-sm"
          />
        </div>
        <div className="flex gap-3 w-full lg:w-auto">
          {/* Screen Selector - NEW */}
          <div className="relative">
            <select
              value={filterScreen}
              onChange={(e) => setFilterScreen(e.target.value)}
              className="px-3 py-2 pr-8 rounded-none border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer font-bold w-full lg:w-[220px] text-sm appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem]"
            >
              <option value="All">All Screens</option>
              {uniqueScreens.map(([id, name]) => (
                <option key={id} value={id}>{name} ({id})</option>
              ))}
            </select>
          </div>

          <select
            value={filterPartner}
            onChange={(e) => setFilterPartner(e.target.value)}
            className="px-3 py-2 pr-8 rounded-none border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem]"
          >
            <option value="All">All Partners</option>
            <option value="DigitalSky Media">DigitalSky Media</option>
            <option value="AdNext Screens">AdNext Screens</option>
            <option value="MetroView DOOH">MetroView DOOH</option>
            <option value="CityScape Outdoor">CityScape Outdoor</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 pr-8 rounded-none border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem]"
          >
            <option value="All">All Status</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      </motion.div>

      {/* Timeline */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 relative"
      >
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Clock size={18} className="text-slate-400" /> Live Event Stream
        </h3>

        <div className="relative pl-0 space-y-8 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((evt, idx) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative pl-12 group"
              >
                {/* Timeline Dot */}
                <div className={`absolute left-0 top-1.5 w-8 h-8 rounded-none border-4 border-white shadow-sm flex items-center justify-center z-10 transition-colors ${evt.status === 'success' ? 'bg-green-100 text-green-600' :
                  evt.status === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'
                  }`}>
                  {getStatusIcon(evt.status)}
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-700">{evt.timestamp}</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-bold text-slate-800 text-sm">{evt.screenId}</span>
                      <span className="text-xs text-slate-500 hidden sm:inline-block">• {evt.screenName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                        {evt.partner}
                      </span>
                      <span className={`text-[10px] px-2 py-1 rounded-none font-bold border ${getStatusColor(evt.status)}`}>
                        {evt.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500 mb-0.5">{evt.type}</p>
                      <p className="text-sm text-slate-700">{evt.message}</p>
                    </div>
                    {evt.duration && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-mono">Latency</p>
                        <p className="text-xs font-bold text-slate-600">{evt.duration}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 italic pl-8">
              No sync events found matching your criteria.
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ScreenSyncTimeline;

