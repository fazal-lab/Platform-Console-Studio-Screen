import React, { useState, useEffect } from 'react';
import { LayoutProvider, useLayout } from './LayoutContext';
import Header from './Header';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Activity, BrainCircuit, Handshake, Cpu, Terminal, Database,
    Settings, ChevronDown, ChevronRight, Map, ScanFace, LineChart, Hammer,
    Trophy, Megaphone, Image as ImageIcon, FlaskConical, ShieldCheck,
    BarChart3, RefreshCw, AlertOctagon, Monitor, Users, Layers, UserCircle,
    Bell, Code, History, Server, FileText, Ticket, AlertTriangle, LogOut
} from 'lucide-react';

const menuStructure = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, type: 'link', path: '/console/dashboard' },
    { id: 'screens', label: 'Screens', icon: Monitor, path: '/console/screens' },
    { id: 'creativeValidation', label: 'Creative Validation', icon: ImageIcon, path: '/console/creative-validation' },
    { id: 'campaignLive', label: 'Campaign Live', icon: Megaphone, path: '/console/campaign-live' },

    // { id: 'console', label: 'Console Hub', icon: Terminal, type: 'link', path: '/console/hub' }, // Placeholder

    // {
    //     id: 'campaignIntel',
    //     label: 'Campaign Intelligence',
    //     icon: BrainCircuit,
    //     type: 'group',
    //     children: [
    //         { id: 'campaignDashboard', label: 'Campaign Dashboard', icon: Megaphone, path: '/console/campaign-intelligence' },
    //         // { id: 'campaignInsights', label: 'Campaign Insights', icon: Megaphone, path: '/console/campaign-insights' },

    //         // { id: 'abTesting', label: 'A/B Testing', icon: FlaskConical, path: '/console/ab-testing' },
    //         // { id: 'playbackConfidence', label: 'Playback Confidence', icon: ShieldCheck, path: '/console/playback-confidence' },
    //     ]
    // },
    {
        id: 'cms',
        label: 'CMS',
        icon: Database,
        type: 'group',
        children: [
            { id: 'advertisersBrands', label: 'Advertisers & Brands', icon: Megaphone, path: '/console/advertisers-brands' },
            // { id: 'campaigns', label: 'Campaigns', icon: Layers, path: '/console/campaigns' },
            { id: 'partnerRecords', label: 'Partner Records', icon: Handshake, path: '/console/partner-records' },
            { id: 'users', label: 'Users & Roles', icon: Users, path: '/console/users-roles' },
        ]
    },
    {
        id: 'partnerFranchise',
        label: 'Partner & Franchise',
        icon: Handshake,
        type: 'group',
        children: [
            { id: 'partnerManagement', label: 'Partner Management', icon: Handshake, path: '/console/partner-management' },
            { id: 'disputes', label: 'Disputes & Evidence', icon: ShieldCheck, path: '/console/disputes' },
            // { id: 'partnerAnalytics', label: 'Partner Analytics', icon: BarChart3, path: '/console/partner-analytics' },
            { id: 'cmsSync', label: 'CMS Sync', icon: RefreshCw, path: '/console/cms-sync' },
            { id: 'payloadInspector', label: 'Payload Inspector', icon: Code, path: '/console/payload-inspector' },
            { id: 'syncTimeline', label: 'Sync Timeline', icon: History, path: '/console/sync-timeline' },
        ]
    },
    // {
    //     id: 'aiSystem',
    //     label: 'AI & System Intelligence',
    //     icon: Cpu,
    //     type: 'group',
    //     children: [
    //         { id: 'aiInsights', label: 'AI Overview', icon: BrainCircuit, path: '/console/ai-insights' },
    //         { id: 'diagnostics', label: 'AI Diagnostics', icon: Activity, path: '/console/diagnostics' },
    //         { id: 'events', label: 'Events & Alerts', icon: AlertOctagon, path: '/console/events' },
    //     ]
    // },
    {
        id: 'devConsole',
        label: 'Developer Console',
        icon: Terminal,
        type: 'group',
        children: [
            // { id: 'monitoring', label: 'API Monitoring', icon: Server, path: '/console/monitoring' },
            { id: 'logs', label: 'Logs & Audit Trail', icon: FileText, path: '/console/system-logs' },
        ]
    },

    {
        id: 'networkOps',
        label: 'Network Operations',
        icon: Activity,
        type: 'group',
        children: [
            // { id: 'profiling', label: 'Screen Profiling', icon: ScanFace, path: '/console/profiling' },
            { id: 'monitoring', label: 'Playback Monitoring', icon: Activity, path: '/console/monitoring' },
            { id: 'tickets', label: 'Tickets', icon: Ticket, path: '/console/tickets' },
            { id: 'incidents', label: 'Incidents & Maintenance', icon: AlertTriangle, path: '/console/incidents' },
        ]
    },
    { id: 'notifications', label: 'Notifications', icon: Bell, type: 'link', path: '/console/notifications' },
    // { id: 'settings', label: 'Settings', icon: Settings, type: 'link', path: '/console/settings' }
];

function XigiAdminShellContent() {
    const navigate = useNavigate();
    const location = useLocation();
    const [expandedMenus, setExpandedMenus] = useState({
        screens: true,
        networkOps: true,
        campaignIntel: true,
        partnerFranchise: true,
        aiSystem: true,
        devConsole: true,
        cms: true
    });
    const { isSidebarOpen, toggleSidebar } = useLayout();
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const [notifCount, setNotifCount] = useState(0);

    // Fetch total pending notification count for sidebar badge
    useEffect(() => {
        const fetchNotifCount = async () => {
            try {
                const res = await fetch('/api/console/screens/external-submit/');
                const data = await res.json();
                const screens = data.screens || [];
                const pendingCount = screens.filter(s =>
                    s.status === 'PENDING' || s.status === 'SUBMITTED' || s.status === 'RESUBMITTED'
                ).length;
                setNotifCount(pendingCount);
            } catch (e) {
                // silently fail
            }
        };
        fetchNotifCount();
        const interval = setInterval(fetchNotifCount, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/');
    };

    const toggleMenu = (menuId) => {
        setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
    };

    const handleNavigate = (path) => {
        navigate(path);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (isSidebarOpen) {
            toggleSidebar();
        }
    };

    const sidebarVariants = {
        collapsed: { width: 72 },
        expanded: { width: 280 }
    };

    const submenuVariants = {
        closed: { height: 0, opacity: 0 },
        open: { height: 'auto', opacity: 1 }
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
            <motion.div
                initial="collapsed"
                animate={isSidebarOpen || isSidebarHovered ? "expanded" : "collapsed"}
                variants={sidebarVariants}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
                className="fixed left-0 top-0 h-full bg-slate-900 text-slate-300 z-50 flex flex-col shadow-2xl overflow-hidden"
            >
                <div className="h-16 flex items-center shrink-0 border-b border-slate-800 px-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">X</div>
                    <motion.div
                        className="ml-4 font-bold text-xl text-white tracking-tight whitespace-nowrap overflow-hidden"
                        animate={{ opacity: isSidebarOpen || isSidebarHovered ? 1 : 0, width: isSidebarOpen || isSidebarHovered ? 'auto' : 0 }}
                    >XIGI Admin</motion.div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-1 scrollbar-hide">
                    {menuStructure.map((item) => {
                        const isGroup = item.type === 'group';
                        const isExpanded = expandedMenus[item.id];

                        // Check if any child is active
                        const hasActiveChild = item.children?.some(child =>
                            child.path && location.pathname === child.path
                        );

                        // For single items (like Dashboard)
                        const isSingleItemActive = !isGroup && item.path && location.pathname === item.path;

                        // Group is considered "active" if it has an active child
                        const isParentActive = isGroup && hasActiveChild;

                        return (
                            <div key={item.id} className="px-3">
                                <button
                                    onClick={() => isGroup ? toggleMenu(item.id) : handleNavigate(item.path)}
                                    className={`w-full flex items-center h-11 px-2.5 rounded-none transition-all duration-200 group relative cursor-pointer ${isSingleItemActive || isParentActive
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="shrink-0 flex items-center justify-center w-5 relative">
                                        <item.icon
                                            size={22}
                                            className={
                                                isSingleItemActive || isParentActive
                                                    ? 'text-white'
                                                    : 'text-slate-400 group-hover:text-white'
                                            }
                                        />
                                        {/* Dot badge on icon when sidebar is collapsed */}
                                        {item.id === 'notifications' && notifCount > 0 && !(isSidebarOpen || isSidebarHovered) && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-violet-500 rounded-full border border-slate-900" />
                                        )}
                                    </div>
                                    <motion.div
                                        className="ml-3 flex-1 text-left text-sm font-medium whitespace-nowrap overflow-hidden flex items-center justify-between"
                                        animate={{
                                            opacity: isSidebarOpen || isSidebarHovered ? 1 : 0,
                                            width: isSidebarOpen || isSidebarHovered ? 'auto' : 0
                                        }}
                                    >
                                        {item.label}
                                        {/* Pending notification count badge */}
                                        {item.id === 'notifications' && notifCount > 0 && (
                                            <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white">
                                                {notifCount}
                                            </span>
                                        )}
                                        {isGroup && (
                                            <div className="ml-2">
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </div>
                                        )}
                                    </motion.div>
                                </button>

                                {isGroup && (
                                    <AnimatePresence>
                                        {isExpanded && (isSidebarOpen || isSidebarHovered) && (
                                            <motion.div
                                                variants={submenuVariants}
                                                initial="closed"
                                                animate="open"
                                                exit="closed"
                                                className="overflow-hidden ml-4 pl-4 border-l border-slate-700 mt-1 space-y-1"
                                            >
                                                {item.children?.map((child) => {
                                                    const isChildActive = child.path && location.pathname === child.path;
                                                    return (
                                                        <button
                                                            key={child.id}
                                                            onClick={() => handleNavigate(child.path)}
                                                            className={`w-full flex items-center justify-between h-9 px-3 rounded-none text-sm transition-colors whitespace-nowrap cursor-pointer ${isChildActive
                                                                ? 'bg-slate-800 text-blue-400 font-medium'
                                                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                                                }`}
                                                        >
                                                            {child.label}
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="px-3 py-3 border-t border-slate-800">
                    <div className="flex items-center justify-between px-2.5 h-12 rounded-lg group/logout hover:bg-slate-800 transition-colors cursor-pointer">
                        <div className="flex items-center overflow-visible">
                            <div className="w-5 flex items-center justify-center shrink-0">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0 shadow-lg">AD</div>
                            </div>
                            <motion.div
                                className="ml-3 overflow-hidden text-left flex flex-col justify-center"
                                animate={{
                                    opacity: isSidebarOpen || isSidebarHovered ? 1 : 0,
                                    width: isSidebarOpen || isSidebarHovered ? 'auto' : 0
                                }}
                            >
                                <p className="text-sm font-bold text-white whitespace-nowrap leading-tight">Admin User</p>
                                <p className="text-[10px] text-slate-400 whitespace-nowrap leading-tight mt-0.5">XIGI Team</p>
                            </motion.div>
                        </div>
                        <motion.button
                            onClick={handleLogout}
                            className="text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg p-2 transition-colors overflow-hidden shrink-0 flex items-center justify-center"
                            animate={{
                                opacity: isSidebarOpen || isSidebarHovered ? 1 : 0,
                                width: isSidebarOpen || isSidebarHovered ? 36 : 0
                            }}
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </motion.button>
                    </div>
                </div>
            </motion.div>

            <motion.div
                className="flex-1 flex flex-col h-full overflow-x-auto"
                style={{
                    marginLeft: isSidebarOpen || isSidebarHovered ? '280px' : '72px',
                    width: isSidebarOpen || isSidebarHovered
                        ? 'calc(100vw - 280px)'
                        : 'calc(100vw - 72px)'
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="min-w-[900px]">
                    <Header />
                </div>
                <main className="flex-1 overflow-y-auto px-8 pt-8 bg-slate-50 min-w-[900px]">
                    <Outlet />
                </main>
            </motion.div>
        </div>
    );
}

export default function XigiAdminShell() {
    return (
        <LayoutProvider>
            <XigiAdminShellContent />
        </LayoutProvider>
    );
}

