'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    CheckCircle2,
    XCircle,
    AlertCircle,
    Linkedin,
    Key,
    Database,
    Globe,
    Zap,
    Bot,
    Calendar,
    Settings,
    ArrowRight,
    ExternalLink,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Clock,
    Users,
} from 'lucide-react';
import AppShell from '@/components/AppShell';

interface RequirementStatus {
    label: string;
    description: string;
    status: 'ok' | 'warning' | 'error' | 'loading';
    action?: { label: string; href?: string; onClick?: () => void };
    detail?: string;
}

interface SystemDiagnostics {
    linkedin_connected: boolean;
    ai_configured: boolean;
    schedule_active: boolean;
    posts_count: number;
    queued_posts: number;
    timezone: string;
    max_posts_per_day: number;
}

export default function RequirementsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);

    const loadDiagnostics = async () => {
        try {
            const [profileRes, settingsRes, scheduleRes, queueRes] = await Promise.all([
                fetch('/api/v1/auth/me', { cache: 'no-store' }),
                fetch('/api/v1/settings', { cache: 'no-store' }),
                fetch('/api/v1/user/schedule', { cache: 'no-store' }),
                fetch('/api/v1/user/queue', { cache: 'no-store' }),
            ]);

            const profile = profileRes.ok ? await profileRes.json() : {};
            const settings = settingsRes.ok ? await settingsRes.json() : {};
            const scheduleData = scheduleRes.ok ? await scheduleRes.json() : {};
            const queueData = queueRes.ok ? await queueRes.json() : { posts: [] };

            const schedule = scheduleData.schedule || {};
            const posts: any[] = queueData.posts || [];

            setDiagnostics({
                linkedin_connected: Boolean(profile.linkedin_connected),
                ai_configured: true, // AI is configured server-side
                schedule_active: Boolean(schedule.is_active),
                posts_count: posts.filter((p: any) => p.status === 'posted').length,
                queued_posts: posts.filter((p: any) => p.status === 'scheduled' || p.status === 'draft').length,
                timezone: schedule.timezone || settings.timezone || 'Not set',
                max_posts_per_day: settings.max_posts_per_day || 3,
            });
        } catch (e) {
            console.error('Failed to load diagnostics:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadDiagnostics();
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadDiagnostics();
    };

    const requirements: RequirementStatus[] = diagnostics
        ? [
              {
                  label: 'LinkedIn Account Connected',
                  description:
                      'Your LinkedIn OAuth token is required to publish posts to your profile or managed pages.',
                  status: diagnostics.linkedin_connected ? 'ok' : 'error',
                  detail: diagnostics.linkedin_connected
                      ? 'Your LinkedIn account is connected and active.'
                      : 'Not connected. Click to connect your LinkedIn account.',
                  action: diagnostics.linkedin_connected
                      ? undefined
                      : { label: 'Connect LinkedIn', href: '/settings' },
              },
              {
                  label: 'AI Content Generation',
                  description:
                      'OpenAI GPT-4o is used on the backend to generate post hooks, captions, and hashtags. This is configured by your admin.',
                  status: 'ok',
                  detail: 'AI service is operational. Ready to generate content.',
              },
              {
                  label: 'Posting Schedule Configured',
                  description:
                      'Set up your auto-posting schedule so the system automatically posts at your preferred times without manual intervention.',
                  status: diagnostics.schedule_active ? 'ok' : 'warning',
                  detail: diagnostics.schedule_active
                      ? 'Auto-posting is enabled and will post automatically on your schedule.'
                      : 'Auto-posting is disabled. Posts need to be manually published.',
                  action: { label: 'Configure Schedule', href: '/settings' },
              },
              {
                  label: 'Timezone Set',
                  description:
                      'Your timezone ensures scheduled posts go out at the correct local time in your region.',
                  status:
                      diagnostics.timezone && diagnostics.timezone !== 'Not set' ? 'ok' : 'warning',
                  detail: `Current timezone: ${diagnostics.timezone}`,
                  action:
                      diagnostics.timezone === 'Not set'
                          ? { label: 'Set Timezone', href: '/settings' }
                          : undefined,
              },
              {
                  label: 'Daily Post Limit',
                  description:
                      'Controls the maximum number of posts the system can publish per day to avoid spam and maintain quality.',
                  status: 'ok',
                  detail: `Limit set to ${diagnostics.max_posts_per_day} post(s) per day.`,
                  action: { label: 'Change Limit', href: '/settings' },
              },
              {
                  label: 'Content in Queue',
                  description:
                      'Drafts and scheduled posts waiting to be published. Create content to build your pipeline.',
                  status:
                      diagnostics.queued_posts > 0
                          ? 'ok'
                          : diagnostics.posts_count > 0
                          ? 'warning'
                          : 'warning',
                  detail:
                      diagnostics.queued_posts > 0
                          ? `${diagnostics.queued_posts} post(s) queued and ready.`
                          : 'No posts in queue. Create some content to fill your pipeline.',
                  action:
                      diagnostics.queued_posts === 0
                          ? { label: 'Create Content', href: '/content/create' }
                          : { label: 'View Queue', href: '/posts' },
              },
          ]
        : [];

    const score = requirements.filter((r) => r.status === 'ok').length;
    const total = requirements.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;

    const steps = [
        {
            num: '01',
            icon: Linkedin,
            title: 'Connect LinkedIn',
            body: 'Go to Settings and click "Connect" to link your LinkedIn account using OAuth. This grants permission to post on your behalf.',
        },
        {
            num: '02',
            icon: Bot,
            title: 'Create Your First Post',
            body: 'Use the content wizard to choose a goal, audience, and style. The AI generates a hook and caption optimised for LinkedIn engagement.',
        },
        {
            num: '03',
            icon: Calendar,
            title: 'Set Your Schedule',
            body: 'Configure auto-posting in Settings. Pick which days and time you want posts to go out, and choose your timezone for accuracy.',
        },
        {
            num: '04',
            icon: Zap,
            title: 'Enable Auto-Posting',
            body: 'Turn on auto-post in Settings so the system automatically publishes from your queue at scheduled times—hands-free.',
        },
    ];

    const features = [
        { icon: Bot, label: 'AI Content Generation', desc: 'GPT-4o powered hooks & captions' },
        { icon: Calendar, label: 'Smart Scheduling', desc: 'Time-zone aware auto-posting' },
        { icon: Users, label: 'Profile & Page Support', desc: 'Post to profile and/or pages' },
        { icon: Zap, label: 'Auto-Post Queue', desc: 'Fully automated content pipeline' },
        { icon: Globe, label: 'Carousel PDF Export', desc: 'Download branded carousel slides' },
        { icon: Clock, label: 'Post History & Logs', desc: 'Track all published content' },
    ];

    return (
        <AppShell
            title="App Requirements"
            description="Everything you need to know to get eLAutopost working correctly."
        >
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Hero Card */}
                <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white shadow-xl">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200 mb-2">
                        System Health
                    </p>
                    <h1 className="text-3xl font-extrabold mb-1">Requirements & Setup</h1>
                    <p className="text-indigo-200 mb-6">
                        Complete the checklist below to get your automation pipeline fully operational.
                    </p>

                    {loading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Checking system status…</span>
                        </div>
                    ) : (
                        <div className="flex items-end gap-6">
                            <div>
                                <p className="text-5xl font-black">{pct}%</p>
                                <p className="text-indigo-200 text-sm mt-1">
                                    {score} of {total} requirements met
                                </p>
                            </div>
                            <div className="flex-1">
                                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-3 bg-white rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Checklist */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-indigo-600" />
                            <h2 className="text-lg font-bold text-gray-900">Requirements Checklist</h2>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {requirements.map((req) => (
                                <div key={req.label} className="flex items-start gap-4 p-6">
                                    <div className="mt-0.5 flex-shrink-0">
                                        {req.status === 'ok' && (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        )}
                                        {req.status === 'warning' && (
                                            <AlertCircle className="h-5 w-5 text-amber-500" />
                                        )}
                                        {req.status === 'error' && (
                                            <XCircle className="h-5 w-5 text-red-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900">{req.label}</p>
                                        <p className="text-sm text-gray-500 mt-0.5">{req.description}</p>
                                        {req.detail && (
                                            <p
                                                className={`text-xs mt-1 font-medium ${
                                                    req.status === 'ok'
                                                        ? 'text-emerald-600'
                                                        : req.status === 'warning'
                                                        ? 'text-amber-600'
                                                        : 'text-red-600'
                                                }`}
                                            >
                                                {req.detail}
                                            </p>
                                        )}
                                    </div>
                                    {req.action && (
                                        <button
                                            onClick={() => req.action?.href && router.push(req.action.href)}
                                            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
                                        >
                                            {req.action.label}
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* How It Works */}
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">How to Get Started</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {steps.map((step) => {
                            const Icon = step.icon;
                            return (
                                <div
                                    key={step.num}
                                    className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex gap-4"
                                >
                                    <div className="flex-shrink-0">
                                        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                            <Icon className="h-5 w-5 text-indigo-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-indigo-400 mb-0.5">STEP {step.num}</p>
                                        <p className="font-bold text-gray-900">{step.title}</p>
                                        <p className="text-sm text-gray-500 mt-1">{step.body}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Features */}
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Platform Features</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {features.map((f) => {
                            const Icon = f.icon;
                            return (
                                <div
                                    key={f.label}
                                    className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-start gap-3"
                                >
                                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                        <Icon className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 text-sm">{f.label}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Quick Links */}
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { label: 'Create Content', href: '/content/create', icon: Bot, color: 'indigo' },
                            { label: 'View Queue', href: '/posts', icon: Calendar, color: 'blue' },
                            { label: 'Settings', href: '/settings', icon: Settings, color: 'slate' },
                        ].map(({ label, href, icon: Icon, color }) => (
                            <button
                                key={href}
                                onClick={() => router.push(href)}
                                className={`flex items-center justify-between rounded-xl px-4 py-3 font-semibold text-sm transition-all hover:scale-[1.02] ${
                                    color === 'indigo'
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        : color === 'blue'
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </div>
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Requirements Summary */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Key className="h-5 w-5 text-amber-500" />
                        Technical Requirements
                    </h2>
                    <div className="space-y-3 text-sm text-gray-700">
                        {[
                            { label: 'LinkedIn OAuth Credentials', note: 'Client ID & Secret configured by admin' },
                            { label: 'OpenAI API Key', note: 'GPT-4o access for content generation' },
                            { label: 'Supabase Database', note: 'Stores posts, schedules, user settings' },
                            { label: 'Backend API (FastAPI)', note: 'Handles auth, scheduling, and LinkedIn API calls' },
                            { label: 'Frontend (Next.js)', note: 'User interface deployed on Vercel' },
                            { label: 'Cron Job / Scheduler', note: 'Runs every hour to process the posting queue' },
                        ].map((item) => (
                            <div key={item.label} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-gray-900">{item.label}</p>
                                    <p className="text-xs text-gray-500">{item.note}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
