'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    Calendar,
    TrendingUp,
    Clock,
    Zap,
    Settings,
    LogOut,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle
} from 'lucide-react';

interface DashboardData {
    subscription: {
        status: string;
        trial_end?: string;
        renewal_date?: string;
    };
    usage: {
        posts_generated: number;
        linkedin_posts: number;
    };
    schedule: {
        is_active: boolean;
        days_of_week: string[];
        time_of_day: string;
    } | null;
    next_post: {
        scheduled_at: string;
        topic: string;
    } | null;
    recent_posts: any[];
}

export default function UserDashboard() {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardData | null>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        checkAuth();
        fetchDashboardData();
    }, []);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
        } else {
            setUser(user);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const response = await fetch('/api/v1/user/dashboard', {
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                setData(result);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const isTrialActive = data?.subscription?.status === 'trial';
    const isSubscribed = data?.subscription?.status === 'active';
    const hasAccess = isTrialActive || isSubscribed;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
                                <Zap className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">eLAutopost AI</h1>
                                <p className="text-sm text-gray-500">{user?.email}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Subscription Status Banner */}
                {!hasAccess && (
                    <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                            <div>
                                <h3 className="text-sm font-medium text-yellow-800">Subscription Required</h3>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Your trial has expired. Upgrade to continue using automation features.
                                </p>
                            </div>
                            <button className="ml-auto px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                                Upgrade Now
                            </button>
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Plan Status</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {isTrialActive ? 'Trial' : isSubscribed ? 'Active' : 'Expired'}
                                </p>
                            </div>
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${hasAccess ? 'bg-green-100' : 'bg-red-100'
                                }`}>
                                {hasAccess ? (
                                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                                ) : (
                                    <XCircle className="h-6 w-6 text-red-600" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Posts Generated</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {data?.usage?.posts_generated || 0}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Posted to LinkedIn</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {data?.usage?.linkedin_posts || 0}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Zap className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Auto-Posting</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {data?.schedule?.is_active ? 'ON' : 'OFF'}
                                </p>
                            </div>
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${data?.schedule?.is_active ? 'bg-green-100' : 'bg-gray-100'
                                }`}>
                                <Clock className={`h-6 w-6 ${data?.schedule?.is_active ? 'text-green-600' : 'text-gray-400'
                                    }`} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <button
                        onClick={() => router.push('/content/create')}
                        disabled={!hasAccess}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Zap className="h-8 w-8 mb-3" />
                        <h3 className="text-lg font-semibold mb-1">Generate Content</h3>
                        <p className="text-sm text-blue-100">Create AI-powered LinkedIn posts</p>
                    </button>

                    <button
                        onClick={() => router.push('/calendar')}
                        disabled={!hasAccess}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-6 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Calendar className="h-8 w-8 mb-3" />
                        <h3 className="text-lg font-semibold mb-1">Content Calendar</h3>
                        <p className="text-sm text-purple-100">30-Day strategic plan</p>
                    </button>

                    <button
                        onClick={() => router.push('/posts')}
                        className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                        <TrendingUp className="h-8 w-8 mb-3 text-gray-700" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-900">View Posts</h3>
                        <p className="text-sm text-gray-500">Manage your content queue</p>
                    </button>

                    <button
                        onClick={() => router.push('/settings')}
                        className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                        <Settings className="h-8 w-8 mb-3 text-gray-700" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-900">Settings</h3>
                        <p className="text-sm text-gray-500">Configure automation</p>
                    </button>
                </div>

                {/* Next Scheduled Post */}
                {data?.next_post && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Next Scheduled Post</h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Topic</p>
                                <p className="text-base font-medium text-gray-900 mt-1">{data.next_post.topic}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Scheduled For</p>
                                <p className="text-base font-medium text-gray-900 mt-1">
                                    {new Date(data.next_post.scheduled_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
