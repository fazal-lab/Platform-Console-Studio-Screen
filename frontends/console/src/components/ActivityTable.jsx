import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { MoreVertical } from 'lucide-react';

const ActivityTable = () => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActivities();
    }, []);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const response = await api.get('audit-logs/');
            const mapped = response.data.map(log => ({
                user: log.user_email || 'System',
                action: log.action,
                time: new Date(log.timestamp).toLocaleString(),
                status: log.action.includes('FAILED') || log.action.includes('REJECTED') ? 'Failed' : 'Success'
            }));
            setActivities(mapped.slice(0, 10)); // Take last 10
        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-xs">Recent Activity</h3>
                <button
                    onClick={fetchActivities}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-none hover:bg-slate-50 transition-colors"
                >
                    <MoreVertical size={16} />
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold text-[10px]">
                        <tr>
                            <th className="px-3 py-2.5 border-b border-slate-200">User</th>
                            <th className="px-3 py-2.5 border-b border-slate-200">Action</th>
                            <th className="px-3 py-2.5 border-b border-slate-200">Time</th>
                            <th className="px-3 py-2.5 border-b border-slate-200">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="px-3 py-10 text-center text-slate-400 italic">
                                    Loading activities...
                                </td>
                            </tr>
                        ) : activities.length > 0 ? (
                            activities.map((activity, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0">
                                    <td className="px-3 py-2.5 font-medium text-slate-800 text-xs">{activity.user}</td>
                                    <td className="px-3 py-2.5 text-slate-600 text-xs">{activity.action}</td>
                                    <td className="px-3 py-2.5 text-slate-500 text-xs">{activity.time}</td>
                                    <td className="px-3 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border uppercase tracking-wider ${activity.status === 'Success' ? 'bg-green-50 text-green-700 border-green-100' :
                                            activity.status === 'Failed' ? 'bg-red-50 text-red-700 border-red-100' :
                                                'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                            {activity.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="px-3 py-10 text-center text-slate-400 italic">
                                    No recent activity found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ActivityTable;
