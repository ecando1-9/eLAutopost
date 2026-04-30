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
    defaultGoal?: string;
    defaultAudience?: string;
    defaultStyle?: string;
    defaultTone?: string;
    targetMode?: PublishTarget;
    organizationId?: string;
    emojiDensity?: 'None' | 'Low' | 'Medium' | 'High';
    autoFormatReach?: boolean;
}

interface SettingsResponse {
    default_tone?: string;
    auto_post?: boolean;
    notification_email?: boolean;
    preferred_content_types?: ContentType[];
    default_goal?: string;
    default_audience?: string;
    default_style?: string;
    emoji_density?: 'None' | 'Low' | 'Medium' | 'High';
    auto_format_reach?: boolean;
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

interface SetupCheck {
    label: string;
    done: boolean;
    sectionId: string;
    helperText: string;
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
const LINKEDIN_ORGANIZATION_SCOPES = ['w_organization_social', 'rw_organization_admin'];

function isValidTimeSlot(value: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(value)) {
        return false;
    }

    const [hour, minute] = value.split(':').map((part) => parseInt(part, 10));
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function parseSavedSlotTimes(value?: string | null): string[] {
    if (typeof value !== 'string') {
        return [];
    }

    const seen = new Set<string>();
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => {
            if (!isValidTimeSlot(entry) || seen.has(entry)) {
                return false;
            }
            seen.add(entry);
            return true;
        })
        .sort();
}

function buildSlotInputs(slotValues: string[], desiredCount: number): string[] {
    const normalized = slotValues
        .map((value) => value.trim())
        .slice(0, Math.max(1, desiredCount));

    while (normalized.length < Math.max(1, desiredCount)) {
        normalized.push('');
    }

    return normalized;
}

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

function hasLinkedInOrganizationAccess(scopes: string[]): boolean {
    return scopes.some((scope) => LINKEDIN_ORGANIZATION_SCOPES.includes(scope));
}

function formatLinkedInAuthError(detail?: string | null, description?: string | null): string {
    if (detail === 'unauthorized_scope_error') {
        return 'LinkedIn rejected organization/page permissions for this app. Profile posting can work with standard member scopes, but Company Page posting needs extra LinkedIn approval and a reconnect.';
    }

    if (description) {
        return `LinkedIn connection failed: ${description}`;
    }

    if (detail) {
        return `LinkedIn connection failed: ${detail.replace(/_/g, ' ')}`;
    }

    return 'LinkedIn connection failed. Please try again.';
}

const EMOJI_LEVELS = ['None', 'Low', 'Medium', 'High'];

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
    const [emojiDensity, setEmojiDensity] = useState<'None'|'Low'|'Medium'|'High'>('Medium');
    const [autoFormatReach, setAutoFormatReach] = useState(true);

    // Schedule settings
    const [isActive, setIsActive] = useState(false);
    const [daysOfWeek, setDaysOfWeek] = useState<Day[]>(['MON', 'WED', 'FRI']);
    const [timezone, setTimezone] = useState('Asia/Kolkata');
    const [categories, setCategories] = useState<string[]>(['AI']);
    const [availableCategories, setAvailableCategories] = useState<string[]>(DEFAULT_CATEGORY_POOL);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [customCategory, setCustomCategory] = useState('');
    const [autoTopic, setAutoTopic] = useState(true);
    const [maxPostsPerDay, setMaxPostsPerDay] = useState(1);
    // Individual time slots (one per post per day). timeOfDay = first slot for backward compat
    const [slotTimes, setSlotTimes] = useState<string[]>(['09:00']);

    // Keep timeOfDay as comma-separated string for API to process multiple slots
    const filledSlotTimes = slotTimes
        .map((value) => value.trim())
        .filter((value) => isValidTimeSlot(value));
    const timeOfDay = [...filledSlotTimes].sort().join(',');

    const setSlotTime = (index: number, value: string) => {
        setSlotTimes((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const adjustMaxPosts = (delta: number) => {
        setMaxPostsPerDay((prev) => {
            const next = Math.min(5, Math.max(1, prev + delta));
            setSlotTimes((times) => buildSlotInputs(times, next));
            return next;
        });
    };

    const scrollToSection = (sectionId: string) => {
        const section = document.getElementById(sectionId);
        if (!section) {
            return;
        }

        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const setupChecks = useMemo<SetupCheck[]>(
        () => [
            {
                label: 'LinkedIn connected',
                done: isLinkedInConnected,
                sectionId: 'linkedin-workspace',
                helperText: isLinkedInConnected ? 'Open LinkedIn connection details.' : 'Connect your LinkedIn profile.',
            },
            {
                label: 'Auto-post enabled',
                done: isActive,
                sectionId: 'publishing-rhythm',
                helperText: isActive ? 'Review your auto-post switch.' : 'Turn on auto-posting.',
            },
            {
                label: 'Schedule selected',
                done: daysOfWeek.length > 0 && filledSlotTimes.length === maxPostsPerDay,
                sectionId: 'publishing-rhythm',
                helperText: 'Choose active days, times, and timezone.',
            },
            {
                label: 'Content defaults selected',
                done: preferredContentTypes.length > 0,
                sectionId: 'generation-profile',
                helperText: 'Pick your preferred content mix.',
            },
            {
                label: 'Posting target configured',
                done:
                    targetMode === 'person' ||
                    ((targetMode === 'organization' || targetMode === 'both') && !!organizationId.trim()),
                sectionId: 'generation-profile',
                helperText: 'Set profile or page posting target.',
            },
        ],
        [
            isLinkedInConnected,
            isActive,
            daysOfWeek.length,
            filledSlotTimes.length,
            maxPostsPerDay,
            preferredContentTypes.length,
            targetMode,
            organizationId,
        ]
    );
    const hasOrganizationPostingAccess = useMemo(
        () => hasLinkedInOrganizationAccess(linkedinScopes),
        [linkedinScopes]
    );

    const setupScore = setupChecks.filter((check) => check.done).length;
    const visibleCategories = showAllCategories
        ? availableCategories
        : availableCategories.slice(0, 10);
    const setupComplete = setupScore === setupChecks.length;
    const postingTargetLabel =
        targetMode === 'person'
            ? 'Profile'
            : targetMode === 'organization'
                ? 'Page'
                : 'Profile + Page';
    const cadenceSummary = isActive
        ? `${maxPostsPerDay} slot${maxPostsPerDay > 1 ? 's' : ''} on ${daysOfWeek.length} day${daysOfWeek.length === 1 ? '' : 's'}`
        : 'Manual posting only';
    const scheduleSummary = filledSlotTimes.length > 0
        ? filledSlotTimes.join(' • ')
        : 'Choose posting times';

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
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.push('/login');
                    return;
                }

                if (typeof window !== 'undefined') {
                    const params = new URLSearchParams(window.location.search);
                    const linkedinStatus = params.get('linkedin');
                    const linkedinDetail = params.get('detail');
                    const linkedinDescription = params.get('description');

                    if (linkedinStatus === 'connected') {
                        setSuccessMessage('LinkedIn connected successfully.');
                        setErrorMessage('');
                    } else if (linkedinStatus === 'error') {
                        setSuccessMessage('');
                        setErrorMessage(
                            formatLinkedInAuthError(linkedinDetail, linkedinDescription)
                        );
                    }

                    if (params.has('linkedin') || params.has('detail') || params.has('description')) {
                        params.delete('linkedin');
                        params.delete('detail');
                        params.delete('description');
                        const nextSearch = params.toString();
                        window.history.replaceState(
                            {},
                            '',
                            nextSearch ? `/settings?${nextSearch}` : '/settings'
                        );
                    }
                }

                const token = session.access_token;

                const [profileRes, settingsRes, scheduleRes] = await Promise.all([
                    fetch('/api/v1/auth/me', { 
                        headers: { 'Authorization': `Bearer ${token}` },
                        cache: 'no-store' 
                    }),
                    fetch('/api/v1/settings', { 
                        headers: { 'Authorization': `Bearer ${token}` },
                        cache: 'no-store' 
                    }),
                    fetch('/api/v1/user/schedule', { 
                        headers: { 'Authorization': `Bearer ${token}` },
                        cache: 'no-store' 
                    }),
                ]);

                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    setIsLinkedInConnected(Boolean(profile.linkedin_connected));
                }

                let fetchedMaxPosts = maxPostsPerDay;

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
                    if (settings.emoji_density) setEmojiDensity(settings.emoji_density);
                    if (typeof settings.auto_format_reach === 'boolean') setAutoFormatReach(settings.auto_format_reach);
                    if (settings.publish_target) setTargetMode(settings.publish_target);
                    if (settings.organization_id) setOrganizationId(settings.organization_id);
                    if (typeof settings.max_posts_per_day === 'number') {
                        fetchedMaxPosts = Math.min(5, Math.max(1, settings.max_posts_per_day));
                        setMaxPostsPerDay(fetchedMaxPosts);
                    }
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
                        setTimezone(schedule.timezone || 'Asia/Kolkata');

                        const savedSlots = parseSavedSlotTimes(schedule.time_of_day);
                        setSlotTimes(
                            buildSlotInputs(savedSlots.length > 0 ? savedSlots : ['09:00'], fetchedMaxPosts)
                        );
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
                        if (prefs.emojiDensity) setEmojiDensity(prefs.emojiDensity as 'None'|'Low'|'Medium'|'High');
                        if (prefs.autoFormatReach !== undefined) setAutoFormatReach(prefs.autoFormatReach);
                    }
                } catch (error) {
                    console.error('Failed to read local preferences:', error);
                }

                void loadLinkedInTargets();
            } catch (error) {
                console.error('Failed to load settings:', error);
                setErrorMessage((current) => current || 'Failed to load settings. Please refresh.');
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

            if (filledSlotTimes.length !== maxPostsPerDay) {
                throw new Error(`Choose ${maxPostsPerDay} posting time${maxPostsPerDay > 1 ? 's' : ''} before saving.`);
            }

            if (new Set(filledSlotTimes).size !== filledSlotTimes.length) {
                throw new Error('Each daily post needs a different time.');
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

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const settingsRes = await fetch('/api/v1/settings', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    default_tone: defaultTone,
                    auto_post: isActive,
                    notification_email: notificationEmail,
                    preferred_content_types: preferredContentTypes,
                    default_goal: defaultGoal,
                    default_audience: defaultAudience,
                    default_style: defaultStyle,
                    emoji_density: emojiDensity,
                    auto_format_reach: autoFormatReach,
                    publish_target: targetMode,
                    organization_id: organizationId.trim() || null,
                    max_posts_per_day: maxPostsPerDay,
                }),
            });

            if (!settingsRes.ok) {
                throw new Error(await readErrorMessage(settingsRes));
            }

            const scheduleRes = await fetch('/api/v1/user/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    days_of_week: scheduleDays,
                    time_of_day: timeOfDay,
                    timezone,
                    is_active: isActive,
                    categories: normalizedSelectedCategories,
                    auto_topic: autoTopic,
                }),
            });

            if (!scheduleRes.ok) {
                throw new Error(await readErrorMessage(scheduleRes));
            }

            const schedulePayload = await scheduleRes.json().catch(() => null);

            const localPreferences: LocalPreferences = {
                defaultGoal,
                defaultAudience,
                defaultStyle,
                defaultTone,
                targetMode,
                organizationId: organizationId.trim(),
                emojiDensity,
                autoFormatReach
            };
            localStorage.setItem(PREFERENCES_KEY, JSON.stringify(localPreferences));
            setCategories(normalizedSelectedCategories);
            setAvailableCategories((current) => mergeCategories([...current, ...normalizedSelectedCategories]));
            await loadLinkedInTargets();

            setSuccessMessage(
                schedulePayload?.message || 'Settings saved. Your automation configuration is now updated.'
            );
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
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_38%),linear-gradient(180deg,#ffffff,#f8fafc)] p-6 shadow-sm sm:p-8">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_320px] xl:items-start">
                        <div>
                            <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800 backdrop-blur">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                System Setup
                            </p>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                Automation Settings
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                                Connect LinkedIn, define your publishing rhythm, and set the AI rules once so queue,
                                calendar, and auto-post all follow the same plan.
                            </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Connection</p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">
                                        {isLinkedInConnected ? 'LinkedIn ready' : 'Needs connection'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {isLinkedInConnected ? (linkedinProfile?.name || 'Profile connected') : 'Connect before auto posting'}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cadence</p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">{cadenceSummary}</p>
                                    <p className="mt-1 text-xs text-slate-500">{scheduleSummary}</p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Audience</p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">{defaultAudience}</p>
                                    <p className="mt-1 text-xs text-slate-500">{defaultGoal} goal with {defaultTone} tone</p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Target</p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">{postingTargetLabel}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {categories.length > 0 ? `${categories.length} topic ${categories.length === 1 ? 'category' : 'categories'}` : 'Pick content categories'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] bg-slate-950 p-5 text-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.9)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Setup Progress</p>
                            <div className="mt-3 flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-4xl font-black tracking-tight">{setupScore}/{setupChecks.length}</p>
                                    <p className="mt-1 text-sm text-slate-300">
                                        {setupComplete ? 'Everything needed for automation is in place.' : 'Finish the remaining steps to make auto-post reliable.'}
                                    </p>
                                </div>
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                    setupComplete ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-200'
                                }`}>
                                    {setupComplete ? 'Ready to run' : 'Needs attention'}
                                </span>
                            </div>
                            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 transition-all"
                                    style={{ width: `${(setupScore / setupChecks.length) * 100}%` }}
                                />
                            </div>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Schedule Window</p>
                                    <p className="mt-1 text-sm font-semibold text-white">{scheduleSummary}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Publishing Mode</p>
                                    <p className="mt-1 text-sm font-semibold text-white">{postingTargetLabel}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {successMessage && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {errorMessage}
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(280px,0.78fr)]">
                    <section id="linkedin-workspace" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                                    <Linkedin className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Connection</p>
                                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">LinkedIn Workspace</h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                        This connection controls both manual publishing and everything the scheduler can publish automatically.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => loadLinkedInTargets()}
                                    disabled={isLinkedInLoading}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                                >
                                    {isLinkedInLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-3.5 w-3.5" />
                                    )}
                                    Refresh
                                </button>

                                {isLinkedInConnected ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleConnectLinkedIn}
                                            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100"
                                        >
                                            Reconnect
                                        </button>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Connected
                                        </span>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleConnectLinkedIn}
                                        className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800"
                                    >
                                        Connect LinkedIn
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(260px,0.98fr)]">
                            <div className={`rounded-3xl border p-4 ${
                                isLinkedInConnected
                                    ? 'border-emerald-200 bg-emerald-50/70'
                                    : 'border-slate-200 bg-slate-50'
                            }`}>
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                                        isLinkedInConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500'
                                    }`}>
                                        <UserCircle2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Profile Status</p>
                                        <p className="mt-1 text-lg font-bold text-slate-900">
                                            {isLinkedInConnected ? (linkedinProfile?.name || 'LinkedIn connected') : 'Not connected yet'}
                                        </p>
                                        <p className="mt-2 text-sm text-slate-600">
                                            {isLinkedInConnected
                                                ? (linkedinProfile?.email || linkedinProfile?.urn || 'Manual publishing and auto-posting can use this profile.')
                                                : 'Connect your LinkedIn profile first so the app can schedule and publish posts.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className={`rounded-3xl border p-4 ${
                                hasOrganizationPostingAccess
                                    ? 'border-sky-200 bg-sky-50/80'
                                    : 'border-amber-200 bg-amber-50/80'
                            }`}>
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                                        hasOrganizationPostingAccess ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Page Posting</p>
                                        <p className="mt-1 text-lg font-bold text-slate-900">
                                            {hasOrganizationPostingAccess ? 'Managed pages available' : 'Profile mode only'}
                                        </p>
                                        <p className="mt-2 text-sm text-slate-600">
                                            {hasOrganizationPostingAccess
                                                ? 'Your app has the organization scopes needed for Company Page publishing.'
                                                : 'Managed LinkedIn Pages are not available now. Company Page posting will work only after LinkedIn approves organization permissions and you reconnect.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isLinkedInConnected && (
                            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Managed Pages</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                                            {linkedinOrganizations.length > 0 ? 'Choose a LinkedIn Page' : 'No approved pages available'}
                                        </h3>
                                    </div>
                                    <span className="inline-flex h-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                        {linkedinOrganizations.length} found
                                    </span>
                                </div>

                                {linkedinOrganizations.length > 0 ? (
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                                                className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                                                    organizationId === org.id
                                                        ? 'border-sky-500 bg-white shadow-sm ring-2 ring-sky-100'
                                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-slate-500" />
                                                    <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">ID: {org.id}</p>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4">
                                        <p className="text-sm font-semibold text-slate-900">Managed LinkedIn Pages are not available now</p>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Keep the app in Profile posting mode for now. When LinkedIn approves organization permissions,
                                            reconnect and your pages will appear here.
                                        </p>
                                    </div>
                                )}

                                {linkedinScopes.length > 0 && (
                                    <p className="mt-4 text-xs text-slate-500">
                                        Scopes: {linkedinScopes.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </section>

                    <aside className="h-fit rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-24">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist</p>
                        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900">Current setup status</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            This is the shortest path to a reliable automation setup: connect, choose the schedule, set defaults, then save once.
                        </p>

                        <div className="mt-5 space-y-3">
                            {setupChecks.map((check, index) => (
                                <button
                                    key={check.label}
                                    type="button"
                                    onClick={() => scrollToSection(check.sectionId)}
                                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                                        check.done ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50/80'
                                    } w-full text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2`}
                                >
                                    <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                        check.done ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                                    }`}>
                                        {check.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-semibold ${check.done ? 'text-slate-900' : 'text-slate-700'}`}>{check.label}</p>
                                        <p className={`mt-1 text-xs ${check.done ? 'text-emerald-700' : 'text-slate-500'}`}>
                                            {check.done ? 'Configured and ready.' : 'Still needs attention before the system is fully ready.'}
                                        </p>
                                        <p className="mt-2 text-xs font-semibold text-sky-700">{check.helperText}</p>
                                    </div>
                                    <span className="mt-1 text-xs font-semibold text-slate-500">Go to section</span>
                                </button>
                            ))}
                        </div>

                        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Live Summary</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                    <span>Timezone</span>
                                    <span className="font-semibold text-slate-900">{timezone}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Daily times</span>
                                    <span className="font-semibold text-slate-900">{scheduleSummary}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Posting target</span>
                                    <span className="font-semibold text-slate-900">{postingTargetLabel}</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                    <section id="publishing-rhythm" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                                    <Zap className="h-3.5 w-3.5" />
                                    Auto Posting
                                </p>
                                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Publishing rhythm</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                    Choose when the app should publish and which topic pool it should draw from when auto-topic is enabled.
                                </p>
                            </div>
                            <span className={`inline-flex h-fit rounded-full px-3 py-1 text-xs font-semibold ${
                                isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                                {isActive ? 'Automation On' : 'Automation Off'}
                            </span>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Automation Switch</p>
                                        <p className="mt-1 text-lg font-bold text-slate-900">Turn auto-posting on only when the schedule below is ready</p>
                                        <p className="mt-1 text-sm text-slate-600">Posts will publish using the exact day and time slots you save here.</p>
                                    </div>
                                    <Toggle enabled={isActive} onChange={() => setIsActive((current) => !current)} />
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                                        <Clock3 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">When to publish</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-900">Days, timezone, and daily slots</h3>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="mb-2 block text-sm font-semibold text-slate-800">Active days</label>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                                        {DAYS.map((day) => (
                                            <button
                                                type="button"
                                                key={day.value}
                                                onClick={() => toggleDay(day.value)}
                                                className={`rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all ${
                                                    daysOfWeek.includes(day.value)
                                                        ? 'bg-slate-900 text-white shadow-sm'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <label className="mb-2 block text-sm font-semibold text-slate-800">
                                        <Globe2 className="mr-1 inline h-4 w-4 text-slate-500" />
                                        Timezone
                                    </label>
                                    <select
                                        value={timezone}
                                        onChange={(event) => setTimezone(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    >
                                        {TIMEZONES.map((zone) => (
                                            <option key={zone} value={zone}>
                                                {zone}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Daily schedule</p>
                                            <h4 className="mt-1 text-base font-bold text-slate-900">How many posts per day, and exactly when</h4>
                                        </div>
                                        <div className="flex items-center rounded-2xl bg-slate-200 p-1">
                                            {[1, 2, 3, 4, 5].map((num) => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => {
                                                        const delta = num - maxPostsPerDay;
                                                        if (delta !== 0) adjustMaxPosts(delta);
                                                    }}
                                                    className={`flex h-9 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all ${
                                                        maxPostsPerDay === num
                                                            ? 'bg-white text-sky-700 shadow-sm'
                                                            : 'text-slate-600 hover:bg-slate-300 hover:text-slate-900'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {slotTimes.map((slotTime, idx) => (
                                            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Post {idx + 1}
                                                </span>
                                                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
                                                    <input
                                                        type="time"
                                                        value={slotTime}
                                                        onChange={(e) => setSlotTime(idx, e.target.value)}
                                                        className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none hover:cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {filledSlotTimes.length !== maxPostsPerDay && (
                                        <p className="mt-3 text-xs font-medium text-amber-700">
                                            Choose a time for each enabled daily post before saving.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">What to generate</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-900">Topic categories and auto-topic rules</h3>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {visibleCategories.map((category) => (
                                        <button
                                            type="button"
                                            key={category}
                                            onClick={() => toggleCategory(category)}
                                            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                                                categories.includes(category)
                                                    ? 'bg-sky-700 text-white shadow-sm'
                                                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                                            }`}
                                        >
                                            {category}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                    {availableCategories.length > 10 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllCategories((current) => !current)}
                                            className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                                        >
                                            {showAllCategories ? 'Show fewer categories' : `Show more (${availableCategories.length - 10})`}
                                        </button>
                                    )}
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                        {categories.length} selected
                                    </span>
                                </div>

                                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                                    <p className="text-sm font-semibold text-slate-900">Add custom category</p>
                                    <p className="mt-1 text-sm text-slate-600">Add a topic lane that matches your niche or audience.</p>
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
                                            className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={addCustomCategory}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-800"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add category
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Auto topic mode</p>
                                        <p className="mt-1 text-sm text-slate-600">Rotate topics automatically from the categories you selected above.</p>
                                    </div>
                                    <Toggle enabled={autoTopic} onChange={() => setAutoTopic((current) => !current)} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="generation-profile" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">
                                    <Bot className="h-3.5 w-3.5" />
                                    AI Defaults
                                </p>
                                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Generation profile</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                    These defaults shape tone, audience, format, and destination whenever the app generates content automatically.
                                </p>
                            </div>
                            <span className="inline-flex h-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                {defaultTone} tone
                            </span>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                                        <Bot className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Voice and positioning</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-900">Tell the AI who it is writing for</h3>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                    <div className="xl:col-span-1">
                                        <label className="mb-2 block text-sm font-semibold text-slate-800">Default tone</label>
                                        <select
                                            value={defaultTone}
                                            onChange={(event) => setDefaultTone(event.target.value)}
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {TONES.map((tone) => (
                                                <option key={tone} value={tone}>
                                                    {tone}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-800">Goal</label>
                                        <select
                                            value={defaultGoal}
                                            onChange={(event) => setDefaultGoal(event.target.value)}
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {GOALS.map((goal) => (
                                                <option key={goal} value={goal}>
                                                    {goal}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-800">Audience</label>
                                        <select
                                            value={defaultAudience}
                                            onChange={(event) => setDefaultAudience(event.target.value)}
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {AUDIENCES.map((audience) => (
                                                <option key={audience} value={audience}>
                                                    {audience}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-800">Style</label>
                                        <select
                                            value={defaultStyle}
                                            onChange={(event) => setDefaultStyle(event.target.value)}
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {STYLES.map((style) => (
                                                <option key={style} value={style}>
                                                    {style}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-800">Emoji density</label>
                                        <select
                                            value={emojiDensity}
                                            onChange={(event) => setEmojiDensity(event.target.value as 'None'|'Low'|'Medium'|'High')}
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {EMOJI_LEVELS.map((level) => (
                                                <option key={level} value={level}>
                                                    {level} Emojis
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,rgba(238,242,255,0.95),rgba(248,250,252,1))] p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="pr-8">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">Reach Optimizer</p>
                                        <p className="mt-1 text-lg font-bold text-slate-900">Maximize formatting reach</p>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">
                                            Let the system choose sharper hooks and more scannable formatting when that will give the post better LinkedIn performance.
                                        </p>
                                    </div>
                                    <Toggle enabled={autoFormatReach} onChange={() => setAutoFormatReach((current) => !current)} />
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                                        <Linkedin className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Distribution</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-900">Where generated posts should go</h3>
                                    </div>
                                </div>

                                {!hasOrganizationPostingAccess && (
                                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        Managed LinkedIn Pages are not available now. Use Profile posting until LinkedIn approves Company Page permissions.
                                    </div>
                                )}

                                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {[
                                        { id: 'person', label: 'Profile', disabled: false },
                                        { id: 'organization', label: 'Page', disabled: !hasOrganizationPostingAccess },
                                        { id: 'both', label: 'Both', disabled: !hasOrganizationPostingAccess },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            disabled={opt.disabled}
                                            onClick={() => {
                                                if (!opt.disabled) {
                                                    setTargetMode(opt.id as PublishTarget);
                                                }
                                            }}
                                            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                                                opt.disabled
                                                    ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                                                    : targetMode === opt.id
                                                        ? 'bg-slate-900 text-white shadow-sm'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {(targetMode === 'organization' || targetMode === 'both') && (
                                    <div className="mt-4 space-y-3">
                                        {linkedinOrganizations.length > 0 && (
                                            <select
                                                value={organizationId}
                                                onChange={(event) => setOrganizationId(event.target.value)}
                                                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Content mix</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-900">Preferred post angles and alerts</h3>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {CONTENT_TYPES.map((contentType) => (
                                        <button
                                            type="button"
                                            key={contentType}
                                            onClick={() => toggleContentType(contentType)}
                                            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                                                preferredContentTypes.includes(contentType)
                                                    ? 'bg-indigo-700 text-white shadow-sm'
                                                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                            }`}
                                        >
                                            {contentType}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-4 flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                                    <div className="pr-4">
                                        <p className="text-sm font-semibold text-slate-900">Email notifications</p>
                                        <p className="mt-1 text-sm text-slate-600">Receive important automation and posting alerts.</p>
                                    </div>
                                    <Toggle
                                        enabled={notificationEmail}
                                        onChange={() => setNotificationEmail((current) => !current)}
                                    />
                                </div>

                                <div className="mt-4 rounded-3xl bg-slate-100 p-4">
                                    <div className="flex items-start gap-3">
                                        <CalendarDays className="mt-0.5 h-4 w-4 text-slate-600" />
                                        <p className="text-sm leading-6 text-slate-600">
                                            Posts are scheduled at your exact selected times. After saving, newly auto-generated scheduled posts may take a short moment to appear.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="sticky bottom-4 mt-6">
                    <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-[0_20px_55px_-30px_rgba(15,23,42,0.5)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Save after any schedule or target change</p>
                            <p className="mt-1 text-sm text-slate-600">
                                New posts follow the latest LinkedIn target, timing, tone, and AI defaults only after you save.
                            </p>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
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
