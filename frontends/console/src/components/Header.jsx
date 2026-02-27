import React, { useState, useEffect } from 'react';
import { UserCircle, Menu, Bell, ArrowLeft, Monitor, FileVideo } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayout } from './LayoutContext';
import axios from 'axios';
import api from '../utils/api';

const Header = () => {
    const { toggleSidebar } = useLayout();
    const navigate = useNavigate();
    const location = useLocation();
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifData, setNotifData] = useState({ screens: [], creatives: [] });
    const [totalCount, setTotalCount] = useState(0);

    const isDetailPage = location.pathname.includes('/unprofiled/') ||
        location.pathname.includes('/profiled/') ||
        location.pathname.includes('/onboard') ||
        location.pathname === '/console/screens' ||
        (location.pathname.startsWith('/console/campaigns/') && location.pathname !== '/console/campaigns');

    const handleAction = () => {
        if (isDetailPage) {
            if (location.pathname.includes('/campaigns/')) {
                navigate('/console/campaigns');
            } else if (location.pathname === '/console/screens') {
                navigate('/console/dashboard');
            } else {
                navigate('/console/screens');
            }
        } else {
            toggleSidebar();
        }
    };

    const fetchNotifSummary = async () => {
        try {
            const screensRes = await axios.get('http://192.168.31.226:8000/api/console/screens/external-submit/');
            const allScreens = screensRes.data.screens || [];
            const pendingScreens = allScreens.filter(s =>
                s.status === 'PENDING' || s.status === 'RESUBMITTED' || s.status === 'SUBMITTED'
            );
            const screens = pendingScreens.slice(0, 5).map(s => ({
                id: s.id,
                name: s.screen_name || `Screen #${s.id}`,
                city: s.city || '—',
                status: s.status,
                time: s.created_at,
            }));

            let creatives = [];
            try {
                const assetsRes = await api.get('campaign-assets/');
                const assets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
                creatives = assets
                    .filter(a => a.status === 'uploaded')
                    .slice(0, 5)
                    .map(a => ({
                        id: a.id,
                        campaign: a.campaign_id,
                        screen: a.screen_name || `Screen ${a.screen_id}`,
                        isResubmission: a.is_resubmission,
                        time: a.updated_at,
                    }));
            } catch (e) { /* creative API might not be accessible */ }

            setNotifData({ screens, creatives });
            setTotalCount(pendingScreens.length + creatives.length);
        } catch (e) { /* silently fail */ }
    };

    useEffect(() => {
        fetchNotifSummary();
        const interval = setInterval(fetchNotifSummary, 60000);
        return () => clearInterval(interval);
    }, []);

    const formatAgo = (ts) => {
        if (!ts) return '';
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const statusColor = (status) => {
        if (status === 'RESUBMITTED') return 'text-violet-600';
        if (status === 'PENDING') return 'text-amber-600';
        return 'text-emerald-600';
    };

    return (
        <header className="flex items-center justify-between gap-4 px-8 py-2.5 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-4">
                <button
                    onClick={handleAction}
                    className="p-1.5 hover:bg-slate-100 cursor-pointer transition-colors text-slate-600 border border-slate-100 shadow-sm rounded-none"
                >
                    {isDetailPage ? <ArrowLeft size={18} /> : <Menu size={18} />}
                </button>
            </div>
            <div className="flex items-center gap-3">
                <div
                    className="relative group"
                    onMouseEnter={() => setShowNotifications(true)}
                    onMouseLeave={() => setShowNotifications(false)}
                >
                    <button
                        onClick={() => navigate('/console/notifications')}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-none transition-colors relative"
                    >
                        <Bell size={20} />
                        {totalCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 rounded-full border-2 border-white text-[9px] font-black text-white flex items-center justify-center px-0.5">
                                {totalCount > 99 ? '99+' : totalCount}
                            </span>
                        )}
                    </button>

                    {/* Live Notification Dropdown */}
                    <div className={`absolute right-0 mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-100 transition-all z-50 overflow-hidden ${showNotifications ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'}`}>
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <span className="font-black text-xs text-slate-800">Notifications</span>
                            {totalCount > 0 && (
                                <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-black rounded-full border border-red-100">
                                    {totalCount} pending
                                </span>
                            )}
                        </div>

                        {/* Screen Submissions */}
                        {notifData.screens.length > 0 && (
                            <>
                                <div className="px-4 pt-2.5 pb-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <Monitor size={9} /> Screen Submissions
                                    </p>
                                </div>
                                {notifData.screens.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => {
                                            setShowNotifications(false);
                                            navigate('/console/screens', { state: { activeTab: s.status === 'RESUBMITTED' ? 'resubmitted' : 'pending' } });
                                        }}
                                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-slate-800 truncate">{s.name}</p>
                                            <span className={`text-[9px] font-bold ${statusColor(s.status)} shrink-0 ml-2`}>
                                                {s.status === 'RESUBMITTED' ? 'Resubmitted' : s.status === 'PENDING' ? 'New' : 'Review'}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-slate-400">{s.city} • {formatAgo(s.time)}</p>
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Creatives */}
                        {notifData.creatives.length > 0 && (
                            <>
                                <div className="px-4 pt-2.5 pb-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <FileVideo size={9} /> Creatives
                                    </p>
                                </div>
                                {notifData.creatives.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => { setShowNotifications(false); navigate('/console/creative-validation'); }}
                                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-slate-800 truncate">{c.campaign}</p>
                                            <span className={`text-[9px] font-bold shrink-0 ml-2 ${c.isResubmission ? 'text-indigo-600' : 'text-amber-600'}`}>
                                                {c.isResubmission ? 'Resubmitted' : 'New'}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-slate-400">{c.screen} • {formatAgo(c.time)}</p>
                                    </div>
                                ))}
                            </>
                        )}

                        {notifData.screens.length === 0 && notifData.creatives.length === 0 && (
                            <div className="px-4 py-6 text-center">
                                <Bell size={20} className="mx-auto text-slate-200 mb-2" />
                                <p className="text-[10px] text-slate-400">All caught up!</p>
                            </div>
                        )}

                        <div
                            onClick={() => { setShowNotifications(false); navigate('/console/notifications'); }}
                            className="px-4 py-2.5 text-center text-[10px] font-black text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors border-t border-slate-100"
                        >
                            View All Notifications →
                        </div>
                    </div>
                </div>

                <div className="w-10 h-10 rounded-none bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 cursor-pointer hover:border-blue-200 transition-all">
                    <UserCircle size={24} />
                </div>
            </div>
        </header>
    );
};

export default Header;