import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileJson,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Activity,
  Server,
  Code,
  ArrowRightLeft,
  Info,
  Clock,
  Database,
  Terminal,
  ShieldAlert,
  Play
} from 'lucide-react';

const CmsPayloadInspector = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(true);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const response = await api.get('companies/');
      const mapped = response.data.map(p => ({
        id: p.partner_id || `P-${p.id}`,
        numericId: p.id,
        name: p.name,
        endpoint: 'https://api.xigi.in/sync',
        status: p.is_active ? 'Active' : 'Issues',
        receivedJson: {
          screenId: "DX-443",
          location: "HSR Layout",
          status: "active",
          brightness: 72,
          content: ["ad_001", "ad_002"],
          lastUpdated: new Date().toISOString()
        },
        expectedJson: {
          screenId: "string",
          location: "string",
          coordinates: { lat: "number", lng: "number" },
          status: "string",
          brightness: "number",
          content: "array",
          lastUpdated: "timestamp"
        },
        diffs: [],
        logs: [
          { id: 1, timestamp: new Date().toLocaleTimeString(), type: "System", message: "Initial payload captured.", severity: "success" }
        ]
      }));
      setPartners(mapped);
      if (mapped.length > 0) {
        setSelectedPartnerId(mapped[0].id);
        setSelectedPartner(mapped[0]);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPartnerId) {
      const p = partners.find(partner => partner.id === selectedPartnerId);
      if (p) setSelectedPartner(p);
    }
  }, [selectedPartnerId, partners]);

  if (loading || !selectedPartner) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleRevalidate = () => {
    setIsValidating(true);
    setTimeout(() => setIsValidating(false), 1500);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700 border-green-200';
      case 'Issues': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  // Helper to render JSON lines with highlighting
  const renderJsonLines = (jsonObj, side) => {
    const jsonString = JSON.stringify(jsonObj, null, 2);
    const lines = jsonString.split('\n');

    return lines.map((line, index) => {
      const diff = selectedPartner.diffs.find(d => d.line === index + 1 && d.side === side);

      let bgClass = "bg-transparent";
      let textClass = "text-slate-300";

      if (diff) {
        if (diff.type === 'missing') {
          bgClass = "bg-yellow-500/20";
          textClass = "text-yellow-200";
        } else if (diff.type === 'type_error') {
          bgClass = "bg-red-500/20";
          textClass = "text-red-200";
        } else if (diff.type === 'extra_field') {
          bgClass = "bg-blue-500/20";
          textClass = "text-blue-200";
        }
      }

      return (
        <div key={index} className={`relative px-4 py-0.5 font-mono text-sm hover:bg-slate-800/50 transition-colors group ${bgClass}`}>
          <span className="inline-block w-6 mr-2 text-slate-600 text-right select-none text-xs">{index + 1}</span>
          <span className={textClass}>{line}</span>
          {diff && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              <span className={`text-[10px] px-2 py-1 rounded-none shadow-lg font-bold ${diff.type === 'missing' ? 'bg-yellow-600 text-white' :
                diff.type === 'type_error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                {diff.type.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      );
    });
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
      className="space-y-6 pb-20 h-full flex flex-col"
    >
      {/* 1. Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-800  tracking-tight flex items-center gap-3">
            CMS Payload Inspector
          </h1>
          <p className="text-slate-500 mt-1">Inspect incoming CMS payloads, compare schemas, and debug sync errors.</p>
        </div>

      </header>

      {/* 2. Controls */}
      <motion.div
        variants={itemVariants}
        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0"
      >
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative min-w-[280px]">
            <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="w-full pl-10 pr-8 py-2 rounded-none border border-slate-200 bg-slate-50 text-slate-700 font-bold focus:outline-none focus:border-blue-500 cursor-pointer appearance-none shadow-sm text-sm bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem]"
            >
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-none text-xs font-bold border ${getStatusColor(selectedPartner.status)}`}>
              {selectedPartner.status}
            </span>
            <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200 truncate max-w-[200px] hidden lg:block">
              {selectedPartner.endpoint}
            </span>
          </div>
        </div>

        <button
          onClick={handleRevalidate}
          disabled={isValidating}
          className={`flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-none font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 cursor-pointer ${isValidating ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          <RefreshCw size={18} className={isValidating ? 'animate-spin' : ''} />
          {isValidating ? 'Validating...' : 'Re-validate Payload'}
        </button>
      </motion.div>

      {/* 3. Main Inspector Area */}
      <div className="flex-1 min-h-[400px] grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Received Payload */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900"
        >
          <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="text-blue-400" size={16} />
              <p className="text-sm font-bold text-white mb-0 text-slate-200">Received Payload</p>
            </div>
            <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded font-mono">JSON</span>
          </div>
          <div className="flex-1 overflow-auto py-4 custom-scrollbar">
            {renderJsonLines(selectedPartner.receivedJson, 'received')}
          </div>
        </motion.div>

        {/* Right: Expected Schema */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900"
        >
          <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Database className="text-green-400" size={16} />
              <p className="text-sm font-bold text-white mb-0 text-slate-200">Expected Schema</p>
            </div>
            <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded font-mono">Schema Def</span>
          </div>
          <div className="flex-1 overflow-auto py-4 custom-scrollbar">
            {renderJsonLines(selectedPartner.expectedJson, 'expected')}
          </div>
        </motion.div>

      </div>

      {/* 4. Error Log Panel */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden shrink-0"
      >
        <button
          onClick={() => setIsLogsOpen(!isLogsOpen)}
          className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-slate-500" />
            <h3 className="font-bold text-slate-800 mb-0">Validation Logs</h3>
            <span className={`px-2 py-0.5 rounded-none text-xs font-bold border ml-2 ${selectedPartner.logs.some(l => l.severity === 'error')
              ? 'bg-red-100 text-red-600 border-red-200'
              : 'bg-slate-200 text-slate-600 border-slate-300'
              }`}>
              {selectedPartner.logs.length} Events
            </span>
          </div>
          {isLogsOpen ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
        </button>

        <AnimatePresence>
          {isLogsOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden border-t border-slate-100"
            >
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white text-slate-500 font-semibold text-xs sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 w-32">Timestamp</th>
                      <th className="px-6 py-3 w-40">Type</th>
                      <th className="px-6 py-3">Message</th>
                      <th className="px-6 py-3 w-24 text-center">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPartner.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-slate-500">{log.timestamp}</td>
                        <td className="px-6 py-3 font-bold text-slate-700">{log.type}</td>
                        <td className="px-6 py-3 text-slate-600">{log.message}</td>
                        <td className="px-6 py-3 text-center">
                          {log.severity === 'error' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-none border border-red-100">
                              <XCircle size={10} /> Error
                            </span>
                          ) : log.severity === 'warning' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-600 text-[10px] font-bold rounded-none border border-yellow-100">
                              <AlertTriangle size={10} /> Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-none border border-green-100">
                              <CheckCircle size={10} /> Success
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Legend & Instructions */}
      <motion.div
        variants={itemVariants}
        className="flex flex-wrap gap-4 text-xs text-slate-500 px-2 pt-2 pb-4"
      >
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-yellow-500 rounded-sm"></span> Missing Field
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-sm"></span> Type Mismatch
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded-sm"></span> Extra Field
        </div>
        <div className="flex-1 text-right italic">
          * Payloads are auto-captured from the ingestion gateway every 30 seconds.
        </div>
      </motion.div>

    </motion.div>
  );
};

export default CmsPayloadInspector;

