'use client';

import { useEffect, useState } from 'react';
import { adminService, DashboardStats } from '@/services/admin';
import {
    Users,
    CreditCard,
    TrendingUp,
    AlertTriangle,
    ArrowUpRight
} from 'lucide-react';

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await adminService.getDashboardStats();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch dashboard stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
    }

    if (!stats) {
        return <div className="p-8 text-center text-red-500">Failed to load dashboard data.</div>;
    }

    const statCards = [
        {
            label: 'Total Users',
            value: stats.total_users,
            icon: Users,
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-600',
            trend: `+${stats.new_users_this_month} this month`
        },
        {
            label: 'Active Subscribers',
            value: stats.active_subscribers,
            icon: CreditCard,
            bgColor: 'bg-green-50',
            textColor: 'text-green-600',
            trend: `+${stats.new_subscribers_this_month} this month`
        },
        {
            label: 'Monthly Recurring Revenue',
            value: `₹${stats.mrr.toLocaleString()}`,
            icon: TrendingUp,
            bgColor: 'bg-indigo-50',
            textColor: 'text-indigo-600',
            trend: 'Based on active plans'
        },
        {
            label: 'Trial Users',
            value: stats.trial_users,
            icon: AlertTriangle,
            bgColor: 'bg-yellow-50',
            textColor: 'text-yellow-600',
            trend: `${stats.expired_trials} expired`
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                <p className="text-gray-500">Welcome back, Administrator</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                                    <Icon className={`h-6 w-6 ${stat.textColor}`} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm">
                                <span className="text-green-600 font-medium flex items-center">
                                    <ArrowUpRight className="h-4 w-4 mr-1" />
                                    {stat.trend}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Placeholder for future charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-80 flex flex-col items-center justify-center text-gray-400">
                    <TrendingUp className="h-12 w-12 mb-4 text-gray-300" />
                    <p>Revenue Analytics (Coming Soon)</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-80 flex flex-col items-center justify-center text-gray-400">
                    <Users className="h-12 w-12 mb-4 text-gray-300" />
                    <p>User Growth Analytics (Coming Soon)</p>
                </div>
            </div>
        </div>
    );
}
