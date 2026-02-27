import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    ScanFace,
    MapPin,
    Activity,
    TrendingUp,
    Video,
    Wifi,
    Sun,
    Server,
    ArrowRight,
    CheckCircle,
    AlertTriangle,
    AlertOctagon,
    Info,
    ChevronRight,
    X,
    Download,
    Wrench,
    Edit,
    RefreshCw,
    Eye,
    Target,
    Users,
    Compass,
    ShieldCheck,
    History,
    Clock,
    Layers
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import api from '../utils/api';

const ScreenProfilingPage = () => {
    const [screens, setScreens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedScreenId, setSelectedScreenId] = useState("");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        fetchScreens();
    }, []);

    const fetchScreens = async () => {
        setLoading(true);
        try {
            const response = await api.get('screens/');
            const mapped = response.data.map(s => ({
                id: s.id.toString(),
                numericId: s.id,
                location: s.screen_location || 'N/A',
                status: s.is_profiled ? 'Profiled' : 'UnProfiled',
                aiScore: 85, // Placeholder
                format: "LED Outdoor",
                size: "12 ft x 8 ft",
                direction: "Facing North",
                footfall: "15,000 / day",
                peakTraffic: "6–9 PM",
                audience: ["Commuters", "Shoppers"],
                poi: [s.district, s.state].filter(Boolean),
                health: { brightness: 'Good', camera: 'Stable', connectivity: 'Online', player: 'Working' },
                recommendations: ["Profiling complete"],
                history: [
                    { date: "Recently", event: "Screen added to system" }
                ]
            }));
            setScreens(mapped);
            if (mapped.length > 0) {
                setSelectedScreenId(mapped[0].id);
            }
        } catch (error) {
            console.error('Error fetching screens:', error);
        } finally {
            setLoading(false);
        }
    };

    // Layout Fix: Hide outer scrollbar
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            main {
                overflow: hidden !important;
                padding-bottom: 0 !important;
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    const selectedScreen = useMemo(() =>
        screens.find(s => s.id === selectedScreenId) || screens[0],
        [selectedScreenId, screens]);

    const filteredScreens = useMemo(() =>
        screens.filter(s =>
            s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.location.toLowerCase().includes(searchTerm.toLowerCase())
        ), [screens, searchTerm]);

    if (loading || !selectedScreen) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Profiled': return 'bg-green-100 text-green-700 border-green-200';
            case 'Sellable': return 'bg-blue-600 text-white border-blue-700';
            case 'Needs Review': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Unverified': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const handleExportPDF = (full = false) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Xigi Screen Profiling - ${selectedScreen.id}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        const basicInfo = [
            ['Screen ID', selectedScreen.id],
            ['Location', selectedScreen.location],
            ['AI Score', `${selectedScreen.aiScore}%`],
            ['Format', selectedScreen.format],
            ['Size', selectedScreen.size],
            ['Footfall', selectedScreen.footfall],
            ['Peak Traffic', selectedScreen.peakTraffic]
        ];

        autoTable(doc, {
            startY: 35,
            head: [['Attribute', 'Value']],
            body: basicInfo,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
        });

        if (full) {
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Audience Mix']],
                body: selectedScreen.audience.map(a => [a]),
                theme: 'plain',
            });

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                head: [['AI Recommendations']],
                body: selectedScreen.recommendations.map(r => [r]),
                theme: 'plain',
            });
        }

        doc.save(`xigi-profiling-${selectedScreen.id}-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const getHealthIcon = (status) => {
        if (status === 'Good' || status === 'Stable' || status === 'Online' || status === 'Working')
            return <div className="w-2 h-2 rounded-full bg-green-500" />;
        if (status === 'Warning' || status === 'Unstable')
            return <div className="w-2 h-2 rounded-full bg-orange-500" />;
        return <div className="w-2 h-2 rounded-full bg-red-500" />;
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6 h-full flex flex-col pb-3 overflow-hidden"
        >
            {/* 2. TOP BAR */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        Screen Profiling Intelligence
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">AI-powered profiling for accurate screen understanding and relevance mapping.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Fresh profiles</p>
                            <p className="text-2xl font-bold text-green-600 mt-2">124</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">Approved recently</p>
                        </div>
                        <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Stale profiles</p>
                            <p className="text-2xl font-bold text-orange-600 mt-2">12</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">Needs review</p>
                        </div>
                        <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                            <Clock size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Error profiles</p>
                            <p className="text-2xl font-bold text-red-600 mt-2">3</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">Requires attention</p>
                        </div>
                        <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                            <AlertOctagon size={24} />
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT SPLIT */}
            <div className="flex-1 flex gap-6 overflow-hidden">

                {/* 4. SCREEN LIST PANEL (LEFT) */}
                <motion.div
                    variants={itemVariants}
                    className="w-80 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col shrink-0"
                >
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search screen ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-3.5 text-sm rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-all font-bold"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {filteredScreens.map((screen) => (
                            <button
                                key={screen.id}
                                onClick={() => setSelectedScreenId(screen.id)}
                                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${selectedScreenId === screen.id
                                    ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
                                    : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <span className={`font-bold text-xs ${selectedScreenId === screen.id ? 'text-blue-700' : 'text-slate-800'}`}>
                                        {screen.id}
                                    </span>
                                    <span className={`text-[11px] px-2 py-0.5 rounded-none font-bold border ${getStatusColor(screen.status)}`}>
                                        {screen.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-[12px] text-slate-500  mb-0 pr-2">{screen.location}</p>
                                    <span className="text-[12px] font-bold text-slate-600 shrink-0">{screen.aiScore}% AI</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* 5. MAIN PROFILING VIEW (CENTER) */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-6">

                    {/* SECTION A & B: HEADER & AI SUMMARY */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1  xl:grid-cols-3 gap-6">

                        {/* Screen Basics */}
                        <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
                            <div>
                                <h3 className="text-[14px] font-bold text-slate-400 mb-2 flex items-center gap-2">
                                    <Server size={12} /> Screen Details
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] mb-1 text-slate-400">Location</p>
                                        <p className="text-xs font-semibold text-slate-700">{selectedScreen.location}</p>
                                    </div>
                                    <div className="grid grid-cols-2 mb-0 gap-4">
                                        <div>
                                            <p className="text-[10px] mb-1 text-slate-400">Format</p>
                                            <p className="text-xs font-semibold text-slate-700">{selectedScreen.format}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] mb-1 text-slate-400">Size</p>
                                            <p className="text-xs font-semibold text-slate-700">{selectedScreen.size}</p>
                                        </div>
                                    </div>
                                    <div className='mt-3'>
                                        <p className="text-[10px] mb-1 text-slate-400">Facing Direction</p>
                                        <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1">
                                            <Compass size={12} /> {selectedScreen.direction}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDrawerOpen(true)}
                                className="mt-6 w-full py-3.5 bg-slate-50 text-slate-700 font-bold text-[10px] rounded-none hover:bg-slate-100 transition-all border border-slate-200 shadow-sm cursor-pointer"
                            >
                                View Full Details
                            </button>
                        </div>

                        {/* AI Profiling Summary (Prominent) */}
                        <div
                            className="xl:col-span-2 rounded-xl shadow-lg py-6 px-6 relative overflow-hidden text-white flex flex-col justify-center"
                            style={{ background: 'linear-gradient(to bottom right, #0B0B49, #1B1B76)' }}
                        >
                            <div className="absolute top-0 right-0 w-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                                <div className="flex flex-col items-center justify-center bg-white rounded-full w-28 h-28 border-2 border-white/20 backdrop-blur-sm shrink-0">
                                    <span className="text-3xl text-[#1B1B76] font-bold">{selectedScreen.aiScore}</span>
                                    <span className="text-[9px] text-[#1B1B76] font-bold opacity-80 mt-1">AI score</span>
                                </div>

                                <div className="flex-1 space-y-6 w-full">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[12px] font-bold mb-1">Predicted footfall</p>
                                            <p className="text-lg font-bold">{selectedScreen.footfall}</p>
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-bold mb-1">Peak traffic</p>
                                            <p className="text-lg font-bold">{selectedScreen.peakTraffic}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-indigo-200 text-[12px] font-bold mb-2">Audience mix</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedScreen.audience.map(aud => (
                                                <span key={aud} className="px-2 py-0.5 bg-white/20 rounded-none text-[10px] font-bold backdrop-blur-md border border-white/10">
                                                    {aud}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* SECTION C & D: POI & HEALTH */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-[10px] font-bold text-slate-400 mb-3 flex items-center gap-2">
                                <MapPin size={12} className="text-red-500" /> Point-of-Interest Analysis
                            </h3>
                            <ul className="space-y-3 mb-4">
                                {selectedScreen.poi.map((p, i) => (
                                    <li key={i} className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
                                        <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-1 bg-purple-50 text-purple-700 text-[9px] font-bold rounded border border-purple-100">High Relevance</span>
                                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[9px] font-bold rounded border border-blue-100">Evening Peak Strength</span>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-[14px] font-bold text-slate-400 mb-3 flex items-center gap-2">
                                <Activity size={12} className="text-green-500" /> Health Indicators
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2"><Sun size={12} /> Brightness</span>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
                                        {getHealthIcon(selectedScreen.health.brightness)} {selectedScreen.health.brightness}
                                    </div>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2"><Video size={12} /> Camera</span>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
                                        {getHealthIcon(selectedScreen.health.camera)} {selectedScreen.health.camera}
                                    </div>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2"><Wifi size={12} /> Connect</span>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
                                        {getHealthIcon(selectedScreen.health.connectivity)} {selectedScreen.health.connectivity}
                                    </div>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2"><Server size={12} /> Player</span>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
                                        {getHealthIcon(selectedScreen.health.player)} {selectedScreen.health.player}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* SECTION F & G: CREATIVE & RECOMMENDATIONS */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-[14px] font-bold text-slate-400 mb-3 flex items-center gap-2">
                                <Target size={12} className="text-blue-500" /> Suitability
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 mb-2">Best creative types</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['High-contrast', 'Large typography', 'Minimal text', 'Product hero'].map(tag => (
                                            <div key={tag} className="bg-slate-50 px-2 py-1 rounded text-[9px] text-slate-600 flex items-center gap-1.5 font-bold">
                                                <CheckCircle size={8} className="text-green-500" /> {tag}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 mb-2">Ratio performance</p>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-600 font-medium">Standard 16:9</span>
                                            <span className="font-bold text-green-600">Good</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-600 font-medium">Wide Outdoor</span>
                                            <span className="font-bold text-purple-600">Best</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-[10px] font-bold text-slate-400 mb-3 flex items-center gap-2">
                                <TrendingUp size={12} className="text-orange-500" /> AI Recommendations
                            </h3>
                            <div className="space-y-2">
                                {selectedScreen.recommendations.map((rec, i) => (
                                    <div key={i} className="flex gap-3 items-start p-2.5 bg-blue-50/50 rounded-xl border border-blue-100/50 text-[10px] text-blue-900 font-medium leading-relaxed">
                                        <Info size={12} className="text-blue-600 shrink-0 mt-0.5" />
                                        {rec}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* HISTORY */}
                    <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-[10px] font-bold text-slate-400 mb-4">Profiling History</h3>
                        <div className="space-y-6 relative pl-2">
                            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-100" />
                            {selectedScreen.history.map((h, i) => (
                                <div key={i} className="relative pl-6 mb-1">
                                    <div className="absolute left-0 top-1.5 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full z-10" />
                                    <p className="text-[9px] font-bold text-slate-400 mb-2">{h.date}</p>
                                    <p className="text-[10px] font-bold text-slate-700">{h.event}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ACTION BAR */}
                    <motion.div variants={itemVariants} className="sticky bottom-0 bg-white border-t border-slate-200 p-4 -mx-2 -mb-2 flex items-center justify-between rounded-b-xl shadow-lg z-10">
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-3 py-3.5 bg-slate-100 text-slate-700 rounded-none text-[12px] font-bold hover:bg-slate-200 transition-colors cursor-pointer">
                                <Wrench size={12} /> Maintenance
                            </button>
                            <button className="flex items-center gap-2 px-3 py-3.5 bg-slate-100 text-slate-700 rounded-none text-[12px] font-bold hover:bg-slate-200 transition-colors cursor-pointer">
                                <Edit size={12} /> Edit
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleExportPDF(false)}
                                className="flex items-center gap-2 px-4 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-none text-[12px] font-bold hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
                            >
                                <Download size={12} /> Export
                            </button>
                            <button className="flex items-center gap-2 px-4 py-3.5 bg-blue-600 text-white rounded-none text-[12px] font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer">
                                <RefreshCw size={12} /> Re-run AI
                            </button>
                        </div>
                    </motion.div>

                </div>
            </div>

            {/* 8. DRAWER - FULL DETAILS */}
            <AnimatePresence>
                {isDrawerOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDrawerOpen(false)}
                            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] mb-0"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{selectedScreen.id}</h2>
                                    <p className="text-xs text-slate-500 mt-1 font-bold">Profiling Report</p>
                                </div>
                                <button
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="p-2 rounded-none hover:bg-slate-200 text-slate-500 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {/* Tech Specs */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 mb-4">Technical specifications</h3>
                                    <div className="bg-slate-50 rounded-xl px-3 py-2 grid grid-cols-2 gap-3 border border-slate-100">
                                        <div>
                                            <p className="text-[9px] text-slate-400 mb-1 font-bold">Resolution</p>
                                            <p className="text-xs font-bold text-slate-800 mb-0">1920 x 1080</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 mb-1 font-bold">Pixel Pitch</p>
                                            <p className="text-xs font-bold text-slate-800 mb-0">P4 Outdoor</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 mb-1 font-bold">Refresh Rate</p>
                                            <p className="text-xs font-bold text-slate-800 mb-0">3840 Hz</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 mb-1 font-bold">Max Brightness</p>
                                            <p className="text-xs font-bold text-slate-800 mb-0">6500 nits</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Profiling Metadata - New */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 mb-4 flex items-center gap-2">
                                        <Layers size={14} /> Profiling versioning
                                    </h3>
                                    <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2 border border-slate-100">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-400">Version</span>
                                            <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">v2.4.1</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-400">Computed At</span>
                                            <span className="text-[10px] font-bold text-slate-700 mb-1">Jan 29, 2024 • 14:22 PM</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-400">Inputs Hash</span>
                                            <span className="font-mono text-[9px] text-slate-400 mb-1">d41d8cd9...427e</span>
                                        </div>
                                        <div className="pt-2 border-t border-slate-200">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-slate-400">Confidence</span>
                                                <span className="text-[10px] font-bold text-green-600 mb-1">98.2%</span>
                                            </div>
                                            <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500 w-[98.2%]" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* AI Explanation */}
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                                            <ShieldCheck size={14} /> AI score breakdown
                                        </h3>
                                        <button className="text-[12px] font-bold text-blue-600 flex items-center gap-1 hover:underline cursor-pointer">
                                            <History size={10} /> Compare Versions
                                        </button>
                                    </div>
                                    <div className="px-4 py-3 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                                        <p className="text-[10px] font-bold text-purple-800">Why this screen ranks 92/100?</p>
                                        <ul className="space-y-1 mb-0 text-[10px] text-purple-900/80 font-medium">
                                            <li className="flex items-center gap-2"><CheckCircle size={10} className="text-purple-600" /> High dwell time at traffic signal (avg 65s)</li>
                                            <li className="flex items-center gap-2"><CheckCircle size={10} className="text-purple-600" /> Unobstructed visibility from 200m</li>
                                            <li className="flex items-center gap-2"><CheckCircle size={10} className="text-purple-600" /> High density of premium shoppers</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Trace Log - New */}
                                <div>
                                    <h3 className="text-[14px] font-bold text-slate-400 mb-4">Debug traces</h3>
                                    <div className="bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-green-400/80 space-y-1 overflow-x-auto">
                                        <p>[14:22:01] Fetching area context for "Nungambakkam High Road"...</p>
                                        <p>[14:22:03] POI Analysis: 4 high-value matches found.</p>
                                        <p>[14:22:04] Calculating audience affinity scores...</p>
                                        <p>[14:22:05] PROFILER_SUCCESS: Result generated with conf: 0.982</p>
                                    </div>
                                </div>

                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                                <button
                                    onClick={() => handleExportPDF(true)}
                                    className="flex-1 py-3.5 bg-slate-800 text-white rounded-none font-bold hover:bg-slate-900 transition-all shadow-lg text-[10px] cursor-pointer"
                                >
                                    Export Full PDF
                                </button>
                                <button
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="flex-1 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-none font-bold hover:bg-slate-50 transition-all text-[10px] shadow-sm cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </motion.div>
    );
};

export default ScreenProfilingPage;

