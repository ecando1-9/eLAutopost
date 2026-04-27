'use client';

import { useEffect, useState } from 'react';
import { adminService, DashboardStats, RevenueAnalytics, UsageAnalytics } from '@/services/admin';
import {
    Users,
    CreditCard,
    TrendingUp,
    AlertTriangle,
    ArrowUpRight
} from 'lucide-react';

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [revenue, setRevenue] = useState<RevenueAnalytics[]>([]);
    const [usage, setUsage] = useState<UsageAnalytics[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [statsData, revenueData, usageData] = await Promise.all([
                    adminService.getDashboardStats(),
                    adminService.getRevenueAnalytics(),
                    adminService.getUsageAnalytics(),
                ]);
                setStats(statsData);
                setRevenue(revenueData.slice().reverse().slice(-6));
                setUsage(usageData.slice().reverse().slice(-14));
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
            value: `INR ${stats.mrr.toLocaleString()}`,
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

    const maxRevenue = Math.max(...revenue.map((row) => Number(row.revenue) || 0), 1);
    const maxPosts = Math.max(...usage.map((row) => Number(row.total_posts) || 0), 1);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                <p className="text-gray-500">Users, subscriptions, revenue, and product activity</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Revenue</h3>
                            <p className="text-sm text-gray-500">Captured payments by month</p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="mt-6 flex h-56 items-end gap-3">
                        {revenue.length === 0 ? (
                            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                                No revenue yet
                            </div>
                        ) : (
                            revenue.map((item) => {
                                const height = Math.max(8, ((Number(item.revenue) || 0) / maxRevenue) * 100);
                                return (
                                    <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                                        <div className="flex h-40 w-full items-end rounded-md bg-indigo-50">
                                            <div
                                                className="w-full rounded-md bg-indigo-500"
                                                style={{ height: `${height}%` }}
                                                title={`INR ${Number(item.revenue || 0).toLocaleString()}`}
                                            />
                                        </div>
                                        <span className="text-[11px] font-medium text-gray-500">
                                            {new Date(item.month).toLocaleDateString(undefined, { month: 'short' })}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Product Activity</h3>
                            <p className="text-sm text-gray-500">Generated posts by active day</p>
                        </div>
                        <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="mt-6 space-y-4">
                        {usage.length === 0 ? (
                            <div className="flex h-56 items-center justify-center text-sm text-gray-400">
                                No activity yet
                            </div>
                        ) : (
                            usage.map((item) => {
                                const postWidth = Math.max(4, ((Number(item.total_posts) || 0) / maxPosts) * 100);
                                return (
                                    <div key={item.date} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3">
                                        <span className="text-xs font-medium text-gray-500">
                                            {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                        <div className="h-3 overflow-hidden rounded-full bg-blue-50">
                                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${postWidth}%` }} />
                                        </div>
                                        <span className="text-right text-xs font-semibold text-gray-700">
                                            {item.total_posts || 0}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
