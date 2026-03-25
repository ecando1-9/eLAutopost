'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    AlertCircle,
    Building2,
    Bot,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Globe2,
    Linkedin,
    Loader2,
    Plus,
    RefreshCw,
    Save,
    ShieldCheck,
    Sparkles,
    UserCircle2,
    Zap
} from 'lucide-react';
import AppShell from '@/components/AppShell';

type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type ContentType = 'alert' | 'curiosity' | 'insight' | 'future';
type PublishTarget = 'person' | 'organization' | 'both';

interface LocalPreferences {
    defaultGoal: string;
    defaultAudience: string;
    defaultStyle: string;
    defaultTone: string;
    targetMode: PublishTarget;
    organizationId: string;
}

interface SettingsResponse {
    default_tone?: string;
    auto_post?: boolean;
    notification_email?: boolean;
    preferred_content_types?: ContentType[];
    default_goal?: string;
    default_audience?: string;
    default_style?: string;
    publish_target?: PublishTarget;
    organization_id?: string | null;
    max_posts_per_day?: number;
}

interface LinkedInProfile {
    id: string;
    name: string;
    email?: string | null;
    picture_url?: string | null;
    urn?: string | null;
}

interface LinkedInOrganization {
    id: string;
    name: string;
    vanity_name?: string | null;
    urn?: string | null;
}

interface LinkedInTargetsResponse {
    connected: boolean;
    profile?: LinkedInProfile | null;
    organizations?: LinkedInOrganization[];
    scopes?: string[];
}

interface ScheduleResponse {
    is_active?: boolean;
    days_of_week?: Day[];
    time_of_day?: string;
    timezone?: string;
    categories?: string[];
    auto_topic?: boolean;
}

const DAYS: { value: Day; label: string }[] = [
    { value: 'MON', label: 'Mon' },
    { value: 'TUE', label: 'Tue' },
    { value: 'WED', label: 'Wed' },
    { value: 'THU', label: 'Thu' },
    { value: 'FRI', label: 'Fri' },
    { value: 'SAT', label: 'Sat' },
    { value: 'SUN', label: 'Sun' },
];

const DEFAULT_CATEGORY_POOL = [
    'AI',
    'Cybersecurity',
    'Tech News',
    'SaaS Growth',
    'Productivity',
    'Startups',
    'Leadership',
    'Remote Work',
    'Career',
    'Dev Tools',
    'Product Management',
    'Data & Analytics',
    'Cloud',
    'Automation',
    'Marketing',
    'Personal Branding',
];
const CONTENT_TYPES: ContentType[] = ['insight', 'curiosity', 'alert', 'future'];
const TONES = ['professional', 'friendly', 'authoritative', 'conversational', 'bold'];
const GOALS = ['Reach', 'Authority', 'Promotion', 'Education', 'Discussion', 'Research'];
const AUDIENCES = ['Founders', 'Developers', 'Students', 'Recruiters', 'Marketers', 'General Professionals'];
const STYLES = ['Storytelling', 'List Format', 'Framework', 'Question Format', 'Opinion / Hot Take', 'Carousel slides'];
const TIMEZONES = [
    'Asia/Kolkata',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
];
const PREFERENCES_KEY = 'elautopost.preferences.v1';

async function readErrorMessage(response: Response): Promise<string> {
    const raw = await response.text();
    if (!raw) return 'Request failed';

    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.detail === 'string') return parsed.detail;
        if (typeof parsed.error === 'string') return parsed.error;
        if (typeof parsed.message === 'string') return parsed.message;
    } catch {
        return raw;
    }

    return raw;
}

export default function SettingsPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [isLinkedInConnected, setIsLinkedInConnected] = useState(false);
    const [isLinkedInLoading, setIsLinkedInLoading] = useState(false);
    const [linkedinProfile, setLinkedinProfile] = useState<LinkedInProfile | null>(null);
    const [linkedinOrganizations, setLinkedinOrganizations] = useState<LinkedInOrganization[]>([]);
    const [linkedinScopes, setLinkedinScopes] = useState<string[]>([]);

    // Main settings
    const [defaultTone, setDefaultTone] = useState('professional');
    const [notificationEmail, setNotificationEmail] = useState(true);
    const [preferredContentTypes, setPreferredContentTypes] = useState<ContentType[]>([
        'insight',
        'curiosity',
    ]);
    const [defaultGoal, setDefaultGoal] = useState('Authority');
    const [defaultAudience, setDefaultAudience] = useState('General Professionals');
    const [defaultStyle, setDefaultStyle] = useState('Carousel slides');
    const [targetMode, setTargetMode] = useState<PublishTarget>('person');
    const [organizationId, setOrganizationId] = useState('');

    // Schedule settings
    const [isActive, setIsActive] = useState(false);
    const [daysOfWeek, setDaysOfWeek] = useState<Day[]>(['MON', 'WED', 'FRI']);
    const [timeOfDay, setTimeOfDay] = useState('09:00');
    const [timezone, setTimezone] = useState('Asia/Kolkata');
    const [categories, setCategories] = useState<string[]>(['AI']);
    const [availableCategories, setAvailableCategories] = useState<string[]>(DEFAULT_CATEGORY_POOL);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [customCategory, setCustomCategory] = useState('');
    const [autoTopic, setAutoTopic] = useState(true);

    const setupChecks = useMemo(
        () => [
            { label: 'LinkedIn connected', done: isLinkedInConnected },
            { label: 'Auto-post enabled', done: isActive },
            { label: 'Schedule selected', done: daysOfWeek.length > 0 && !!timeOfDay },
            { label: 'Content defaults selected', done: preferredContentTypes.length > 0 },
            {
                label: 'Posting target configured',
                done:
                    targetMode === 'person' ||
                    ((targetMode === 'organization' || targetMode === 'both') && !!organizationId.trim()),
            },
        ],
        [
            isLinkedInConnected,
            isActive,
            daysOfWeek.length,
            timeOfDay,
            preferredContentTypes.length,
            targetMode,
            organizationId,
        ]
    );

    const setupScore = setupChecks.filter((check) => check.done).length;
    const visibleCategories = showAllCategories
        ? availableCategories
        : availableCategories.slice(0, 10);

    const normalizeCategory = (value: string) => value.trim().replace(/\s+/g, ' ');

    const mergeCategories = (incoming: string[]) => {
        const map = new Map<string, string>();
        [...DEFAULT_CATEGORY_POOL, ...incoming]
            .map((item) => normalizeCategory(item))
            .filter(Boolean)
            .forEach((item) => {
                const key = item.toLowerCase();
                if (!map.has(key)) {
                    map.set(key, item);
                }
            });
        return Array.from(map.values());
    };

    const loadLinkedInTargets = async () => {
        setIsLinkedInLoading(true);
        try {
            const response = await fetch('/api/v1/auth/linkedin/targets', {
                cache: 'no-store',
            });
            if (!response.ok) {
                return;
            }

            const payload: LinkedInTargetsResponse = await response.json();
            setIsLinkedInConnected(Boolean(payload.connected));
            setLinkedinProfile(payload.profile || null);
            setLinkedinOrganizations(Array.isArray(payload.organizations) ? payload.organizations : []);
            setLinkedinScopes(Array.isArray(payload.scopes) ? payload.scopes : []);

            if (payload.organizations && payload.organizations.length === 1) {
                setOrganizationId((current) => current || payload.organizations![0].id);
            }
        } catch (error) {
            console.error('Failed to load LinkedIn targets:', error);
        } finally {
            setIsLinkedInLoading(false);
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await supabase.auth.getSession();
                if (!data.session) {
                    router.push('/login');
                    return;
                }

                const [profileRes, settingsRes, scheduleRes] = await Promise.all([
                    fetch('/api/v1/auth/me', { cache: 'no-store' }),
                    fetch('/api/v1/settings', { cache: 'no-store' }),
                    fetch('/api/v1/user/schedule', { cache: 'no-store' }),
                ]);

                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    setIsLinkedInConnected(Boolean(profile.linkedin_connected));
                }

                if (settingsRes.ok) {
                    const settings: SettingsResponse = await settingsRes.json();
                    setDefaultTone(settings.default_tone || 'professional');
                    setNotificationEmail(settings.notification_email ?? true);
                    setPreferredContentTypes(
                        Array.isArray(settings.preferred_content_types) && settings.preferred_content_types.length > 0
                            ? settings.preferred_content_types
                            : ['insight', 'curiosity']
                    );
                    if (settings.default_goal) setDefaultGoal(settings.default_goal);
                    if (settings.default_audience) setDefaultAudience(settings.default_audience);
                    if (settings.default_style) setDefaultStyle(settings.default_style);
                    if (settings.publish_target) setTargetMode(settings.publish_target);
                    if (settings.organization_id) setOrganizationId(settings.organization_id);
                }

                if (scheduleRes.ok) {
                    const payload = await scheduleRes.json();
                    const schedule: ScheduleResponse | null = payload.schedule ?? null;
                    if (schedule) {
                        setIsActive(Boolean(schedule.is_active));
                        setDaysOfWeek(
                            Array.isArray(schedule.days_of_week) && schedule.days_of_week.length > 0
                                ? schedule.days_of_week
                                : ['MON', 'WED', 'FRI']
                        );
                        if (typeof schedule.time_of_day === 'string' && schedule.time_of_day.length >= 5) {
                            setTimeOfDay(schedule.time_of_day.slice(0, 5));
                        }
                        setTimezone(schedule.timezone || 'Asia/Kolkata');
                        const loadedCategories =
                            Array.isArray(schedule.categories) && schedule.categories.length > 0
                                ? schedule.categories
                                : ['AI'];
                        setCategories(loadedCategories);
                        setAvailableCategories(mergeCategories(loadedCategories));
                        setAutoTopic(schedule.auto_topic ?? true);
                    }
                }

                try {
                    const raw = localStorage.getItem(PREFERENCES_KEY);
                    if (raw) {
                        const prefs = JSON.parse(raw) as Partial<LocalPreferences>;
                        if (prefs.defaultGoal) setDefaultGoal(prefs.defaultGoal);
                        if (prefs.defaultAudience) setDefaultAudience(prefs.defaultAudience);
                        if (prefs.defaultStyle) setDefaultStyle(prefs.defaultStyle);
                        if (prefs.defaultTone) setDefaultTone(prefs.defaultTone);
                        if (prefs.targetMode) setTargetMode(prefs.targetMode);
                        if (prefs.organizationId) setOrganizationId(prefs.organizationId);
                    }
                } catch (error) {
                    console.error('Failed to read local preferences:', error);
                }

                await loadLinkedInTargets();
            } catch (error) {
                console.error('Failed to load settings:', error);
                setErrorMessage('Failed to load settings. Please refresh.');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const toggleDay = (day: Day) => {
        setDaysOfWeek((current) =>
            current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
        );
    };

    const toggleCategory = (category: string) => {
        setCategories((current) =>
            current.includes(category)
                ? current.filter((item) => item !== category)
                : [...current, category]
        );
    };

    const addCustomCategory = () => {
        const normalized = normalizeCategory(customCategory);
        if (!normalized) {
            return;
        }

        const existing = availableCategories.find(
            (category) => category.toLowerCase() === normalized.toLowerCase()
        );
        const finalCategory = existing || normalized;

        if (!existing) {
            setAvailableCategories((current) => mergeCategories([...current, normalized]));
        }

        setCategories((current) => {
            if (current.some((item) => item.toLowerCase() === finalCategory.toLowerCase())) {
                return current;
            }
            return [...current, finalCategory];
        });
        setCustomCategory('');
    };

    const toggleContentType = (contentType: ContentType) => {
        setPreferredContentTypes((current) =>
            current.includes(contentType)
                ? current.filter((item) => item !== contentType)
                : [...current, contentType]
        );
    };

    const handleConnectLinkedIn = () => {
        window.location.href = '/api/v1/auth/linkedin';
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            if (isActive && daysOfWeek.length === 0) {
                throw new Error('Select at least one day before enabling auto-post.');
            }

            if (preferredContentTypes.length === 0) {
                throw new Error('Select at least one preferred content type.');
            }

            if ((targetMode === 'organization' || targetMode === 'both') && !organizationId.trim()) {
                throw new Error('Organization/Page ID is required for page posting target.');
            }

            const scheduleDays = daysOfWeek.length > 0 ? daysOfWeek : ['MON'];
            const normalizedSelectedCategories = categories
                .map((category) => normalizeCategory(category))
                .filter(Boolean);
            if (autoTopic && normalizedSelectedCategories.length === 0) {
                throw new Error('Select at least one category when auto topic mode is enabled.');
            }

            const [settingsRes, scheduleRes] = await Promise.all([
                fetch('/api/v1/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        default_tone: defaultTone,
                        auto_post: isActive,
                        notification_email: notificationEmail,
                        preferred_content_types: preferredContentTypes,
                        default_goal: defaultGoal,
                        default_audience: defaultAudience,
                        default_style: defaultStyle,
                        publish_target: targetMode,
                        organization_id: organizationId.trim() || null,
                    }),
                }),
                fetch('/api/v1/user/schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        days_of_week: scheduleDays,
                        time_of_day: timeOfDay,
                        timezone,
                        is_active: isActive,
                        categories: normalizedSelectedCategories,
                        auto_topic: autoTopic,
                    }),
                }),
            ]);

            if (!settingsRes.ok) {
                throw new Error(await readErrorMessage(settingsRes));
            }

            if (!scheduleRes.ok) {
                throw new Error(await readErrorMessage(scheduleRes));
            }

            const localPreferences: LocalPreferences = {
                defaultGoal,
                defaultAudience,
                defaultStyle,
                defaultTone,
                targetMode,
                organizationId: organizationId.trim(),
            };
            localStorage.setItem(PREFERENCES_KEY, JSON.stringify(localPreferences));
            setCategories(normalizedSelectedCategories);
            setAvailableCategories((current) => mergeCategories([...current, ...normalizedSelectedCategories]));
            await loadLinkedInTargets();

            setSuccessMessage('Settings saved. Your automation configuration is now updated.');
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-sky-700" />
            </div>
        );
    }

    return (
        <AppShell
            title="Automation Settings"
            description="Set LinkedIn targets, schedule rules, and AI defaults in one place."
            hidePageHeader
        >
            <div className="max-w-5xl mx-auto">
                <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-6 sm:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                System Setup
                            </p>
                            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
                                Automation Settings
                            </h1>
                            <p className="mt-2 text-slate-600">
                                Keep only what matters: account connection, posting schedule, and AI defaults.
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
                            <p className="text-xs uppercase tracking-wide text-slate-300">Setup progress</p>
                            <p className="text-xl font-bold">
                                {setupScore}/{setupChecks.length}
                            </p>
                        </div>
                    </div>
                </div>

                {successMessage && (
                    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {errorMessage}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-3 mb-6">
                    <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-11 w-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                                        <Linkedin className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">LinkedIn Connection</h2>
                                        <p className="text-sm text-slate-600">
                                            Required for manual publishing and auto posting.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => loadLinkedInTargets()}
                                        disabled={isLinkedInLoading}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                    >
                                        {isLinkedInLoading ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        )}
                                        Refresh
                                    </button>

                                    {isLinkedInConnected ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Connected
                                        </span>
                                    ) : (
                                        <button
                                            onClick={handleConnectLinkedIn}
                                            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 transition-colors"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isLinkedInConnected && linkedinProfile && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                                    <div className="flex items-start gap-2">
                                        <UserCircle2 className="h-4 w-4 mt-0.5 text-emerald-700" />
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-900">
                                                Connected as {linkedinProfile.name}
                                            </p>
                                            <p className="text-xs text-emerald-700">
                                                {linkedinProfile.email || linkedinProfile.urn || 'LinkedIn account connected'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isLinkedInConnected && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <p className="text-sm font-semibold text-slate-900">Managed LinkedIn Pages</p>
                                        <span className="text-xs text-slate-500">
                                            {linkedinOrganizations.length} found
                                        </span>
                                    </div>

                                    {linkedinOrganizations.length > 0 ? (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {linkedinOrganizations.map((org) => (
                                                <button
                                                    key={org.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setOrganizationId(org.id);
                                                        if (targetMode === 'person') {
                                                            setTargetMode('organization');
                                                        }
                                                    }}
                                                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                                                        organizationId === org.id
                                                            ? 'border-sky-500 bg-sky-50'
                                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-slate-500" />
                                                        <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1">ID: {org.id}</p>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-600">
                                            No pages returned by LinkedIn API for this account. You can still enter a Page ID manually below.
                                        </p>
                                    )}

                                    {linkedinScopes.length > 0 && (
                                        <p className="text-[11px] text-slate-500 mt-3">
                                            Scopes: {linkedinScopes.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Checklist</h3>
                        <div className="mt-4 space-y-2">
                            {setupChecks.map((check) => (
                                <div key={check.label} className="flex items-center gap-2 text-sm">
                                    {check.done ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                        <div className="h-4 w-4 rounded-full border border-slate-300" />
                                    )}
                                    <span className={check.done ? 'text-slate-800' : 'text-slate-500'}>{check.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Zap className="h-5 w-5 text-amber-600" />
                            Auto Posting
                        </h2>
                        <p className="text-sm text-slate-600 mt-1 mb-4">
                            Controls when and what the system posts automatically.
                        </p>

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 mb-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Enable auto-post</p>
                                <p className="text-xs text-slate-500">Posts from queue on selected days and time</p>
                            </div>
                            <Toggle enabled={isActive} onChange={() => setIsActive((current) => !current)} />
                        </div>

                        <label className="block text-sm font-semibold text-slate-800 mb-2">Days</label>
                        <div className="grid grid-cols-7 gap-2 mb-4">
                            {DAYS.map((day) => (
                                <button
                                    type="button"
                                    key={day.value}
                                    onClick={() => toggleDay(day.value)}
                                    className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                                        daysOfWeek.includes(day.value)
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 mb-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-2">
                                    <Clock3 className="inline h-4 w-4 mr-1 text-slate-500" />
                                    Posting time
                                </label>
                                <input
                                    type="time"
                                    value={timeOfDay}
                                    onChange={(event) => setTimeOfDay(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-2">
                                    <Globe2 className="inline h-4 w-4 mr-1 text-slate-500" />
                                    Timezone
                                </label>
                                <select
                                    value={timezone}
                                    onChange={(event) => setTimezone(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    {TIMEZONES.map((zone) => (
                                        <option key={zone} value={zone}>
                                            {zone}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <label className="block text-sm font-semibold text-slate-800 mb-2">Topic categories</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {visibleCategories.map((category) => (
                                <button
                                    type="button"
                                    key={category}
                                    onClick={() => toggleCategory(category)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        categories.includes(category)
                                            ? 'bg-sky-700 text-white'
                                            : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                                    }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            {availableCategories.length > 10 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllCategories((current) => !current)}
                                    className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                                >
                                    {showAllCategories
                                        ? 'Show fewer categories'
                                        : `Show more (${availableCategories.length - 10})`}
                                </button>
                            )}
                            <span className="text-xs text-slate-500">
                                Selected: {categories.length}
                            </span>
                        </div>

                        <div className="mb-4 rounded-xl border border-slate-200 p-3">
                            <p className="text-sm font-semibold text-slate-900 mb-2">Add custom category</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={customCategory}
                                    onChange={(event) => setCustomCategory(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            addCustomCategory();
                                        }
                                    }}
                                    placeholder="e.g. FinTech, GenAI, Creator Economy"
                                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                                <button
                                    type="button"
                                    onClick={addCustomCategory}
                                    className="inline-flex items-center gap-1 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Auto topic mode</p>
                                <p className="text-xs text-slate-500">Pick topics automatically from selected categories</p>
                            </div>
                            <Toggle enabled={autoTopic} onChange={() => setAutoTopic((current) => !current)} />
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Bot className="h-5 w-5 text-indigo-600" />
                            AI Defaults
                        </h2>
                        <p className="text-sm text-slate-600 mt-1 mb-4">
                            These defaults are used when generating new content.
                        </p>

                        <label className="block text-sm font-semibold text-slate-800 mb-2">Default tone</label>
                        <select
                            value={defaultTone}
                            onChange={(event) => setDefaultTone(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {TONES.map((tone) => (
                                <option key={tone} value={tone}>
                                    {tone}
                                </option>
                            ))}
                        </select>

                        <div className="grid sm:grid-cols-3 gap-3 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                                    Default Goal
                                </label>
                                <select
                                    value={defaultGoal}
                                    onChange={(event) => setDefaultGoal(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {GOALS.map((goal) => (
                                        <option key={goal} value={goal}>
                                            {goal}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                                    Default Audience
                                </label>
                                <select
                                    value={defaultAudience}
                                    onChange={(event) => setDefaultAudience(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {AUDIENCES.map((audience) => (
                                        <option key={audience} value={audience}>
                                            {audience}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                                    Default Style
                                </label>
                                <select
                                    value={defaultStyle}
                                    onChange={(event) => setDefaultStyle(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {STYLES.map((style) => (
                                        <option key={style} value={style}>
                                            {style}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3 mb-4">
                            <p className="text-sm font-semibold text-slate-900 mb-2">Default LinkedIn Posting Target</p>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {[
                                    { id: 'person', label: 'Profile' },
                                    { id: 'organization', label: 'Page' },
                                    { id: 'both', label: 'Both' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setTargetMode(opt.id as PublishTarget)}
                                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                            targetMode === opt.id
                                                ? 'bg-slate-900 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {(targetMode === 'organization' || targetMode === 'both') && (
                                <div className="space-y-2">
                                    {linkedinOrganizations.length > 0 && (
                                        <select
                                            value={organizationId}
                                            onChange={(event) => setOrganizationId(event.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select LinkedIn Page</option>
                                            {linkedinOrganizations.map((org) => (
                                                <option key={org.id} value={org.id}>
                                                    {org.name} ({org.id})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <input
                                        type="text"
                                        value={organizationId}
                                        onChange={(event) => setOrganizationId(event.target.value)}
                                        placeholder="Organization/Page ID"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}
                        </div>

                        <label className="block text-sm font-semibold text-slate-800 mb-2">Preferred content types</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {CONTENT_TYPES.map((contentType) => (
                                <button
                                    type="button"
                                    key={contentType}
                                    onClick={() => toggleContentType(contentType)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        preferredContentTypes.includes(contentType)
                                            ? 'bg-indigo-700 text-white'
                                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                    }`}
                                >
                                    {contentType}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 mb-4">
                            <div className="flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-slate-500 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Email notifications</p>
                                    <p className="text-xs text-slate-500">Receive important automation and posting alerts</p>
                                </div>
                            </div>
                            <Toggle
                                enabled={notificationEmail}
                                onChange={() => setNotificationEmail((current) => !current)}
                            />
                        </div>

                        <div className="rounded-xl bg-slate-100 p-3 flex items-start gap-2">
                            <CalendarDays className="h-4 w-4 text-slate-600 mt-0.5" />
                            <p className="text-xs text-slate-600">
                                The scheduler adds a small random offset (+/- 20 minutes) to make posts look natural.
                            </p>
                        </div>
                    </section>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </AppShell>
    );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={enabled}
            onClick={onChange}
            className={`relative inline-flex h-8 w-16 items-center rounded-full border transition-all ${
                enabled
                    ? 'border-emerald-600 bg-emerald-600'
                    : 'border-slate-300 bg-slate-200'
            }`}
        >
            <span
                className={`absolute top-0.5 h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? 'translate-x-8' : 'translate-x-0.5'
                }`}
            />
            <span
                className={`pointer-events-none absolute text-[10px] font-bold uppercase tracking-wide ${
                    enabled ? 'left-2 text-white' : 'right-2 text-slate-600'
                }`}
            >
                {enabled ? 'On' : 'Off'}
            </span>
        </button>
    );
}
