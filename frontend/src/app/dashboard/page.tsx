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
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ShieldCheck,
    PenSquare
} from 'lucide-react';
import AppShell from '@/components/AppShell';

interface DashboardData {
    linkedin_connected: boolean;
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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.push('/login');
                    return;
                }

                if (!mounted) return;
                await fetchDashboardData();
            } catch (error) {
                console.error('Failed to initialize dashboard:', error);
                if (mounted) {
                    setErrorMessage('Failed to load your dashboard. Please refresh.');
                    setLoading(false);
                }
            }
        };

        initialize();

        const onFocus = () => {
            void fetchDashboardData(false);
        };
        window.addEventListener('focus', onFocus);
        const intervalId = window.setInterval(() => {
            void fetchDashboardData(false);
        }, 60000);

        return () => {
            mounted = false;
            window.removeEventListener('focus', onFocus);
            window.clearInterval(intervalId);
        };
    }, []);

    const fetchDashboardData = async (showLoader = true) => {
        if (showLoader) {
            setLoading(true);
        }
        try {
            setErrorMessage(null);
            const response = await fetch('/api/v1/user/dashboard', {
                cache: 'no-store',
            });

            if (response.ok) {
                const result = await response.json();
                setData(result);
                return;
            }

            const errorText = await response.text();
            setErrorMessage(errorText || 'Failed to fetch dashboard data');
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            setErrorMessage('Failed to fetch dashboard data');
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
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
        <AppShell
            title="Dashboard"
            description="Monitor account health, posting output, and automation activity."
            action={
                data?.linkedin_connected ? (
                    <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        LinkedIn Connected
                    </span>
                ) : (
                    <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        LinkedIn Not Connected
                    </span>
                )
            }
        >
            <div className="space-y-8">
                {/* Subscription Status Banner */}
                {errorMessage && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                        {errorMessage}
                    </div>
                )}

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

                {/* LinkedIn Connection Hero Banner (Pro UI) */}
                {data && !data.linkedin_connected && (
                    <div className="mb-8 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-8 shadow-xl text-white flex items-center justify-between relative overflow-hidden">
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
                        <div className="relative z-10 max-w-2xl">
                            <h2 className="text-2xl font-bold mb-2">Connect Your LinkedIn Account</h2>
                            <p className="text-blue-100 mb-6 text-lg">
                                Your account is not linked yet. Connect LinkedIn to generate and publish posts directly to your feed.
                            </p>
                            <div className="flex gap-3 flex-wrap">
                                <button 
                                    onClick={() => window.location.href = '/api/v1/auth/linkedin'}
                                    className="px-6 py-3 bg-white text-blue-700 hover:bg-blue-50 hover:shadow-lg rounded-xl font-bold transition-all flex items-center transform hover:-translate-y-0.5"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                                    Connect LinkedIn
                                </button>
                                <button
                                    onClick={() => router.push('/settings')}
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all flex items-center border border-white/30"
                                >
                                    <Settings className="w-5 h-5 mr-2" />
                                    Go to Settings
                                </button>
                            </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <button
                        onClick={() => router.push('/content/create')}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl text-left"
                    >
                        <PenSquare className="h-8 w-8 mb-3" />
                        <h3 className="text-lg font-semibold mb-1">Generate Content</h3>
                        <p className="text-sm text-blue-100">Create AI-powered LinkedIn posts</p>
                    </button>

                    <button
                        onClick={() => router.push('/calendar')}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-6 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl text-left"
                    >
                        <Calendar className="h-8 w-8 mb-3" />
                        <h3 className="text-lg font-semibold mb-1">Content Calendar</h3>
                        <p className="text-sm text-purple-100">30-Day strategic plan</p>
                    </button>

                    <button
                        onClick={() => router.push('/posts')}
                        className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                        <TrendingUp className="h-8 w-8 mb-3 text-gray-700" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-900">View Posts</h3>
                        <p className="text-sm text-gray-500">Manage your content queue</p>
                    </button>

                    <button
                        onClick={() => router.push('/settings')}
                        className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                        <Settings className="h-8 w-8 mb-3 text-gray-700" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-900">Settings</h3>
                        <p className="text-sm text-gray-500">Configure automation</p>
                    </button>

                    <button
                        onClick={() => router.push('/requirements')}
                        className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left md:col-span-2 lg:col-span-4"
                    >
                        <div className="flex items-center gap-4">
                            <ShieldCheck className="h-8 w-8 text-indigo-600 flex-shrink-0" />
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Requirements & Setup Checklist</h3>
                                <p className="text-sm text-gray-500">Check your system health — LinkedIn connection, schedule, queue status and more.</p>
                            </div>
                        </div>
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
        </AppShell>
    );
}
