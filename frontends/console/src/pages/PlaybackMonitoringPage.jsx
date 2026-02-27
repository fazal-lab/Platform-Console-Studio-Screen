import React, { useState, useMemo, useEffect } from 'react';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Search, CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity, Camera, X, Calendar, Thermometer, Clock, Server, Eye, MoreVertical } from 'lucide-react';

const mockScreens = [
  {
    id: "CHN-01",
    location: "Mount Road",
    expectedPlays: 120,
    actualPlays: 118,
    cameraVerified: true,
    cmsStatus: "OK",
    playerStatus: "OK",
    confidence: 98,
    lastSync: "2025-01-14 14:22"
  },
  {
    id: "BLR-05",
    location: "Indiranagar",
    expectedPlays: 90,
    actualPlays: 75,
    cameraVerified: false,
    cmsStatus: "Retrying",
    playerStatus: "Warning",
    confidence: 68,
    lastSync: "2025-01-14 14:10"
  },
  {
    id: "MUM-22",
    location: "Bandra West",
    expectedPlays: 150,
    actualPlays: 120,
    cameraVerified: false,
    cmsStatus: "Failed",
    playerStatus: "Error",
    confidence: 42,
    lastSync: "2025-01-14 13:45"
  },
  {
    id: "HYD-12",
    location: "Jubilee Hills",
    expectedPlays: 110,
    actualPlays: 110,
    cameraVerified: true,
    cmsStatus: "OK",
    playerStatus: "OK",
    confidence: 100,
    lastSync: "2025-01-14 14:25"
  },
  {
    id: "DEL-08",
    location: "Connaught Place",
    expectedPlays: 140,
    actualPlays: 138,
    cameraVerified: true,
    cmsStatus: "OK",
    playerStatus: "Warning",
    confidence: 92,
    lastSync: "2025-01-14 14:18"
  }
];

const PlaybackConfidenceMonitor = () => {
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedScreen, setSelectedScreen] = useState(null);

  useEffect(() => {
    fetchScreens();
  }, []);

  const fetchScreens = async () => {
    setLoading(true);
    try {
      const response = await api.get('screens/');
      const mapped = response.data.map(l => ({
        id: `LED-${l.id}`,
        numericId: l.id,
        location: l.name,
        expectedPlays: 200, // Placeholder
        actualPlays: Math.floor(Math.random() * 50) + 150, // Mock for now
        cameraVerified: true,
        cmsStatus: l.cms_api_endpoint ? "OK" : "Warning",
        playerStatus: "OK",
        confidence: l.cms_api_endpoint ? 98 : 75,
        lastSync: "Just now"
      }));
      setScreens(mapped);
    } catch (error) {
      console.error('Error fetching screens:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredScreens = useMemo(() => {
    return screens.filter(s => {
      const matchesSearch = s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.location.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesFilter = true;
      if (filterStatus === 'Fully Verified') matchesFilter = s.confidence >= 95;
      if (filterStatus === 'Minor Issues') matchesFilter = s.confidence >= 70 && s.confidence < 95;
      if (filterStatus === 'Failed') matchesFilter = s.confidence < 70;

      return matchesSearch && matchesFilter;
    });
  }, [screens, searchTerm, filterStatus]);

  const getConfidenceColor = (score) => {
    if (score >= 95) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'OK': return <CheckCircle size={14} className="text-green-500" />;
      case 'Warning': case 'Retrying': return <AlertTriangle size={14} className="text-orange-500" />;
      case 'Error': case 'Failed': return <XCircle size={14} className="text-red-500" />;
      default: return <Activity size={14} className="text-slate-400" />;
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
      className="space-y-6 pb-20 relative"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            Playback Confidence Monitor
          </h1>
          <p className="text-xs text-slate-500 mt-1">Verify real-time content delivery accuracy across screens.</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { label: 'Overall confidence', val: '94.2%', icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Screens verified', val: '124/132', icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Screens with issues', val: '8', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Retry events', val: '12', icon: RefreshCw, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((card, idx) => (
          <motion.div
            key={idx}
            variants={itemVariants}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-bold text-slate-800">{card.label}</p>
              <p className={`text-2xl font-bold mt-2 ${card.color}`}>{card.val}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Live metrics</p>
            </div>
            <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
              <card.icon size={24} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <motion.div
        variants={itemVariants}
        className="bg-white p-4 rounded-none shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 items-center"
      >
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search screens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm text-slate-700 bg-slate-50/30 shadow-sm"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['All', 'Fully Verified', 'Minor Issues', 'Failed'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-2 rounded-none text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${filterStatus === status
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Confidence Table */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Screen ID</th>
                <th className="px-6 py-4 text-center">Plays (Exp / Act)</th>
                <th className="px-6 py-4 text-center">AI Verified</th>
                <th className="px-6 py-4">CMS Status</th>
                <th className="px-6 py-4">Player Health</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4">Last Sync</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredScreens.map((screen, idx) => (
                <motion.tr
                  key={screen.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800 font-mono">{screen.id}</p>
                    <p className="text-xs text-slate-500">{screen.location}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-mono text-slate-600">
                      <span className="font-bold">{screen.actualPlays}</span> / {screen.expectedPlays}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {screen.cameraVerified ? (
                      <span className="inline-flex items-center gap-1.5 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-none border border-green-100 uppercase tracking-wider">
                        <Camera size={14} /> Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-none border border-slate-200 uppercase tracking-wider">
                        <Camera size={14} /> No
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(screen.cmsStatus)}
                      <span className="text-slate-700">{screen.cmsStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(screen.playerStatus)}
                      <span className="text-slate-700">{screen.playerStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${getConfidenceColor(screen.confidence)}`}>
                      {screen.confidence}%
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {screen.lastSync}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedScreen(screen)}
                      className="text-blue-600 font-bold text-sm hover:underline underline-offset-4 cursor-pointer transition-all rounded-none"
                    >
                      View Details
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedScreen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedScreen(null)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{selectedScreen.id}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedScreen.location}</p>
                </div>
                <button
                  onClick={() => setSelectedScreen(null)}
                  className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* Confidence Card */}
                <div className={`p-6 rounded-none border ${getConfidenceColor(selectedScreen.confidence)} flex flex-col items-center text-center`}>
                  <ShieldCheck size={32} className="mb-2" />
                  <p className="text-3xl font-black mb-1 leading-none">{selectedScreen.confidence}%</p>
                  <p className="text-[10px] font-bold tracking-tight opacity-80">Confidence Score</p>
                </div>

                {/* Timeline Mock */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 tracking-tight mb-3">Playback timeline (1h)</h4>
                  <div className="h-24 bg-slate-50 rounded-none border border-slate-100 flex items-end justify-between px-2 pb-2 gap-1">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-sm ${Math.random() > 0.1 ? 'bg-green-500' : 'bg-red-400'}`}
                        style={{ height: `${Math.random() * 60 + 20}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* AI Snapshot */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 tracking-tight mb-3">AI verification snapshot</h4>
                  <div className="aspect-video bg-slate-900 rounded-none flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <Camera className="text-white/50" size={32} />
                    <div className="absolute bottom-3 left-3 text-white">
                      <p className="text-xs font-mono">Matched: Creative-A</p>
                      <p className="text-[10px] opacity-70">Confidence: 98.2%</p>
                    </div>
                    {selectedScreen.cameraVerified && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-none shadow-sm">
                        VERIFIED
                      </div>
                    )}
                  </div>
                </div>

                {/* CMS Logs */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 tracking-tight mb-3">Recent CMS logs</h4>
                  <div className="bg-slate-50 rounded-none border border-slate-100 divide-y divide-slate-100 text-[11px]">
                    <div className="p-3 flex justify-between">
                      <span className="text-slate-500 font-mono">14:32:10</span>
                      <span className="text-slate-700">Content push successful</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-slate-500 font-mono">14:30:05</span>
                      <span className="text-orange-600">Retry initiated (Attempt 2)</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-slate-500 font-mono">14:28:55</span>
                      <span className="text-slate-700">Player confirmed playback start</span>
                    </div>
                  </div>
                </div>

                {/* Health Indicators */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 tracking-tight mb-3">Player health</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-none border border-slate-100">
                      <p className="text-[10px] text-slate-400 mb-1">FPS</p>
                      <p className="font-bold text-slate-800 text-sm">59.8</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-none border border-slate-100">
                      <p className="text-[10px] text-slate-400 mb-1">Latency</p>
                      <p className="font-bold text-slate-800 text-sm">24ms</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-none border border-slate-100">
                      <p className="text-[10px] text-slate-400 mb-1">Temp</p>
                      <p className="font-bold text-slate-800 text-sm">42°C</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-none border border-slate-100">
                      <p className="text-[10px] text-slate-400 mb-1">Brightness</p>
                      <p className="font-bold text-slate-800 text-sm">85%</p>
                    </div>
                  </div>
                </div>

                {/* Verdict */}
                <div className="bg-blue-50 p-4 rounded-none border border-blue-100">
                  <h4 className="text-[10px] font-bold text-blue-700 tracking-tight mb-2">Compliance verdict</h4>
                  <p className="text-xs text-blue-900 leading-snug">
                    Screen is compliant with minor deviations in evening hours. Recommended to check network stability during peak traffic.
                  </p>
                </div>

              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => setSelectedScreen(null)}
                  className="w-full py-3.5 bg-white text-slate-700 border border-slate-200 rounded-none font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm cursor-pointer"
                >
                  Close Drawer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default PlaybackConfidenceMonitor;

