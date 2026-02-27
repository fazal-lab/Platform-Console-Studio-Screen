import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Monitor, Layers, Users, Activity } from 'lucide-react';

const SummaryCards = () => {
    const [metrics, setMetrics] = useState({
        screens: '0',
        campaigns: '0',
        users: '0',
        health: '98%'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMetrics();
    }, []);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const [screensRes, campaignsRes, usersRes] = await Promise.all([
                api.get('screens/'),
                api.get('campaigns/'),
                api.get('users/')
            ]);

            setMetrics({
                screens: screensRes.data.length.toLocaleString(),
                campaigns: campaignsRes.data.filter(c => c.status === 'live').length.toLocaleString(),
                users: usersRes.data.length.toLocaleString(),
                health: '99.9%' // Placeholder for now
            });
        } catch (error) {
            console.error('Error fetching dashboard metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const cards = [
        { title: 'Total Screens', value: metrics.screens, icon: Monitor, color: 'text-blue-600', bg: 'bg-blue-100' },
        { title: 'Active Campaigns', value: metrics.campaigns, icon: Layers, color: 'text-purple-600', bg: 'bg-purple-100' },
        { title: 'System Users', value: metrics.users, icon: Users, color: 'text-green-600', bg: 'bg-green-100' },
        { title: 'System Health', value: metrics.health, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-100' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, index) => (
                <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">{card.title}</p>
                        <h3 className={`text-2xl font-bold text-slate-900 mt-2 ${loading ? 'animate-pulse bg-slate-100 rounded' : ''}`}>
                            {loading ? '...' : card.value}
                        </h3>
                        <p className="text-xs font-medium text-slate-400 mt-1">Real-time sync</p>
                    </div>
                    <div className={`p-2.5 rounded-xl border border-white/20 ${card.bg}`}>
                        <card.icon className={card.color} size={24} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SummaryCards;
