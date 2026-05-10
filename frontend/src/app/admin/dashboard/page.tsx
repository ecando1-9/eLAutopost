'use client';

import { useEffect, useState } from 'react';
import { adminService, DashboardStats, RevenueAnalytics, SystemInsight, UsageAnalytics } from '@/services/admin';
import {
    Users,
    CreditCard,
    TrendingUp,
    AlertTriangle,
    ArrowUpRight,
    Activity,
    IndianRupee,
    RefreshCw,
    ShieldAlert,
    Receipt,
    Send,
    Webhook
} from 'lucide-react';

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [revenue, setRevenue] = useState<RevenueAnalytics[]>([]);
    const [usage, setUsage] = useState<UsageAnalytics[]>([]);
    const [insights, setInsights] = useState<SystemInsight | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const [statsData, revenueData, usageData, insightData] = await Promise.all([
                adminService.getDashboardStats(),
                adminService.getRevenueAnalytics(),
                adminService.getUsageAnalytics(),
                adminService.getSystemInsights(),
            ]);
            setStats(statsData);
            setRevenue(revenueData.slice().reverse().slice(-6));
            setUsage(usageData.slice().reverse().slice(-14));
            setInsights(insightData);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
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
            trend: `+${stats.new_subscribers_this_month} this month`,
            detail: 'Paid accounts only'
        },
        {
            label: 'Active MRR',
            value: `INR ${Number(stats.mrr || 0).toLocaleString()}`,
            icon: IndianRupee,
            bgColor: 'bg-indigo-50',
            textColor: 'text-indigo-600',
            trend: 'Sum of active subscription prices',
            detail: 'Uses each user paid price'
        },
        {
            label: 'Trial Users',
            value: stats.trial_users,
            icon: AlertTriangle,
            bgColor: 'bg-yellow-50',
            textColor: 'text-yellow-600',
            trend: `${stats.expired_trials} expired`,
            detail: 'Active trials only'
        }
    ];

    const maxRevenue = Math.max(...revenue.map((row) => Number(row.revenue) || 0), 1);
    const maxPosts = Math.max(...usage.map((row) => Number(row.total_posts) || 0), 1);
    const totalRevenue = revenue.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
    const totalPosts = usage.reduce((sum, row) => sum + (Number(row.total_posts) || 0), 0);
    const totalPublished = usage.reduce((sum, row) => sum + (Number(row.total_linkedin_posts) || 0), 0);
    const riskCards = insights ? [
        {
            label: 'Payment failures',
            value: insights.payment_failures_24h,
            detail: 'Last 24 hours',
            icon: Receipt,
            color: insights.payment_failures_24h ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50',
        },
        {
            label: 'Post failures',
            value: insights.failed_posts_24h,
            detail: 'Needs support review',
            icon: Send,
            color: insights.failed_posts_24h ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50',
        },
        {
            label: 'Webhook events',
            value: insights.webhook_events_24h,
            detail: 'Razorpay callbacks',
            icon: Webhook,
            color: 'text-sky-600 bg-sky-50',
        },
        {
            label: 'Admin actions',
            value: insights.admin_actions_24h,
            detail: 'Operational changes',
            icon: ShieldAlert,
            color: 'text-violet-600 bg-violet-50',
        },
    ] : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                    <p className="text-gray-500">Live users, billing, revenue, and product activity</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs font-medium text-gray-400">
                            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={fetchStats}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
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
                                    {'detail' in stat && <p className="mt-1 text-xs text-gray-400">{stat.detail}</p>}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
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
                    <div className="mt-4 rounded-lg bg-indigo-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Visible period revenue</p>
                        <p className="mt-1 text-xl font-bold text-indigo-950">INR {totalRevenue.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Product Activity</h3>
                            <p className="text-sm text-gray-500">Generated and posted content by day</p>
                        </div>
                        <Activity className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-blue-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Generated</p>
                            <p className="mt-1 text-xl font-bold text-blue-950">{totalPosts}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Published</p>
                            <p className="mt-1 text-xl font-bold text-emerald-950">{totalPublished}</p>
                        </div>
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

            {insights && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 xl:col-span-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">System Health</h3>
                                <p className="text-sm text-gray-500">Errors and operational activity</p>
                            </div>
                            <ShieldAlert className="h-5 w-5 text-gray-500" />
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            {riskCards.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label} className="rounded-lg border border-gray-200 p-4">
                                        <div className={`inline-flex rounded-md p-2 ${item.color}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <p className="mt-3 text-2xl font-bold text-gray-900">{item.value}</p>
                                        <p className="text-xs font-semibold text-gray-600">{item.label}</p>
                                        <p className="mt-1 text-xs text-gray-400">{item.detail}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 xl:col-span-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Recent Failure Log</h3>
                                <p className="text-sm text-gray-500">Payment and publishing errors captured by the system</p>
                            </div>
                        </div>
                        <div className="mt-5 divide-y divide-gray-100 rounded-lg border border-gray-200">
                            {[...insights.recent_payment_errors, ...insights.recent_post_errors].length === 0 ? (
                                <div className="p-5 text-sm text-gray-500">No recent failures recorded.</div>
                            ) : (
                                [...insights.recent_payment_errors.map((item) => ({
                                    id: item.id,
                                    type: 'Payment',
                                    message: item.error_message || 'Payment failed',
                                    time: item.updated_at || item.created_at,
                                    meta: item.razorpay_order_id || item.user_id,
                                })), ...insights.recent_post_errors.map((item) => ({
                                    id: item.id,
                                    type: 'Post',
                                    message: item.error_message || 'Post failed',
                                    time: item.updated_at || item.created_at,
                                    meta: item.topic || item.user_id,
                                }))].slice(0, 8).map((item) => (
                                    <div key={`${item.type}-${item.id}`} className="grid gap-2 p-4 sm:grid-cols-[7rem_1fr_9rem] sm:items-center">
                                        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            item.type === 'Payment' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                        }`}>
                                            {item.type}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-gray-900">{item.message}</p>
                                            <p className="truncate text-xs text-gray-500">{item.meta || 'No reference'}</p>
                                        </div>
                                        <span className="text-xs text-gray-400 sm:text-right">
                                            {item.time ? new Date(item.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
