'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
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
    PenSquare,
    CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';

interface BillingPlan {
    enabled: boolean;
    provider: string;
    plan_name: string;
    display_name: string;
    price: number;
    amount_paise: number;
    currency: string;
    billing_period_days?: number;
    plans?: BillingPlanOption[];
}

interface BillingPlanOption {
    plan_name: string;
    display_name: string;
    price: number;
    amount_paise: number;
    original_amount_paise?: number | null;
    currency: string;
    billing_period_days: number;
    checkout_description?: string;
    features: string[];
    is_popular?: boolean;
}

interface DashboardData {
    linkedin_connected: boolean;
    billing: BillingPlan;
    subscription: {
        status: string;
        plan_name?: string;
        price?: number;
        currency?: string;
        trial_end?: string;
        renewal_date?: string;
        last_payment_date?: string;
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
    total_posted?: number;
    posted_today?: number;
}

interface RazorpaySuccessPayload {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface RazorpayCheckoutPayload {
    key_id: string;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
    image?: string;
    description: string;
    prefill: {
        name?: string;
        email?: string;
    };
    notes: Record<string, string>;
    theme: {
        color?: string;
    };
}

interface RazorpayInstance {
    open: () => void;
    on: (event: string, callback: (response: unknown) => void) => void;
}

interface RazorpayConstructor {
    new (options: Record<string, unknown>): RazorpayInstance;
}

declare global {
    interface Window {
        Razorpay?: RazorpayConstructor;
    }
}

export default function UserDashboard() {
    const router = useRouter();
    const [supabase] = useState(() => createClientComponentClient());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardData | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutPlanName, setCheckoutPlanName] = useState<string | null>(null);
    const [couponCode, setCouponCode] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mountedRef = useRef(true);
    const inFlightRef = useRef(false);

    const readResponseError = async (response: Response) => {
        try {
            const payload = await response.json();
            if (typeof payload?.detail === 'string') {
                return payload.detail;
            }
            if (typeof payload?.error === 'string') {
                return payload.error;
            }
        } catch {
            // Fall back to raw text below.
        }

        return (await response.text()) || 'Something went wrong';
    };

    const fetchDashboardData = async (showLoader = true) => {
        if (inFlightRef.current) {
            return;
        }

        inFlightRef.current = true;
        if (showLoader && mountedRef.current) {
            setLoading(true);
        }

        try {
            if (mountedRef.current) {
                setErrorMessage(null);
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace('/login');
                return;
            }

            const response = await fetch('/api/v1/user/dashboard', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                cache: 'no-store',
            });

            if (!mountedRef.current) {
                return;
            }

            if (response.ok) {
                const result = await response.json();
                setData(result);
                return;
            }

            const errorText = await response.text();
            setErrorMessage(errorText || 'Failed to fetch dashboard data');
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            if (mountedRef.current) {
                setErrorMessage('Failed to fetch dashboard data');
            }
        } finally {
            inFlightRef.current = false;
            if (showLoader && mountedRef.current) {
                setLoading(false);
            }
        }
    };

    const handleStartCheckout = async (planName?: string) => {
        if (!data?.billing?.enabled) {
            toast.error('Razorpay is not configured on the server yet.');
            return;
        }

        if (!window.Razorpay) {
            toast.error('Razorpay Checkout is still loading. Please try again.');
            return;
        }

        const selectedPlanName = planName || data.billing.plan_name;
        setCheckoutPlanName(selectedPlanName);
        setCheckoutLoading(true);
        try {
            const response = await fetch('/api/v1/billing/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    plan_name: selectedPlanName,
                    coupon_code: couponCode.trim() || undefined,
                }),
            });

            if (!response.ok) {
                throw new Error(await readResponseError(response));
            }

            const checkoutData: RazorpayCheckoutPayload = await response.json();
            const checkoutLogo = checkoutData.image || `${window.location.origin}/eLautopost_logo.png`;

            const razorpay = new window.Razorpay({
                key: checkoutData.key_id,
                amount: checkoutData.amount,
                currency: checkoutData.currency,
                name: checkoutData.name,
                image: checkoutLogo,
                description: checkoutData.description,
                order_id: checkoutData.order_id,
                prefill: checkoutData.prefill,
                notes: checkoutData.notes,
                theme: checkoutData.theme,
                modal: {
                    ondismiss: () => setCheckoutLoading(false),
                },
                handler: async (paymentResponse: RazorpaySuccessPayload) => {
                    try {
                        const verifyResponse = await fetch('/api/v1/billing/verify', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(paymentResponse),
                        });

                        if (!verifyResponse.ok) {
                            throw new Error(await readResponseError(verifyResponse));
                        }

                        toast.success('Payment successful. Your plan is active now.');
                        await fetchDashboardData(false);
                    } catch (error: any) {
                        toast.error(error?.message || 'Payment succeeded, but verification failed.');
                    } finally {
                        setCheckoutLoading(false);
                    }
                },
            });

            razorpay.on('payment.failed', (event: any) => {
                const failureMessage = event?.error?.description || 'Payment failed. Please try again.';
                toast.error(failureMessage);
                setCheckoutLoading(false);
            });

            razorpay.open();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to start checkout');
            setCheckoutLoading(false);
            setCheckoutPlanName(null);
        }
    };

    useEffect(() => {
        mountedRef.current = true;

        const initialize = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.replace('/login');
                    return;
                }

                if (!mountedRef.current) return;
                await fetchDashboardData();
            } catch (error) {
                console.error('Failed to initialize dashboard:', error);
                if (mountedRef.current) {
                    setErrorMessage('Failed to load your dashboard. Please refresh.');
                    setLoading(false);
                }
            }
        };

        initialize();

        const onFocus = () => {
            if (document.visibilityState === 'visible') {
                void fetchDashboardData(false);
            }
        };
        window.addEventListener('focus', onFocus);
        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void fetchDashboardData(false);
            }
        }, 60000);

        return () => {
            mountedRef.current = false;
            window.removeEventListener('focus', onFocus);
            window.clearInterval(intervalId);
        };
    }, [router, supabase]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const formatBillingDate = (value?: string) => {
        if (!value) {
            return 'Not set';
        }

        return new Date(value).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Convert raw plan_name/status slugs into readable labels
    const formatPlanLabel = (slug?: string): string => {
        if (!slug) return 'Free Trial';
        const map: Record<string, string> = {
            monthly_trial: 'Free Trial',
            trial: 'Free Trial',
            free_trial: 'Free Trial',
            active: 'Active',
            expired: 'Expired',
            pro: 'Pro',
            monthly: 'Monthly',
            starter: 'Starter',
        };
        return map[slug.toLowerCase()] ?? slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const isTrialActive = data?.subscription?.status === 'trial';
    const isSubscribed = data?.subscription?.status === 'active';
    const hasAccess = isTrialActive || isSubscribed;
    const billingEnabled = !!data?.billing?.enabled;
    const billingPlans = data?.billing?.plans?.length
        ? data.billing.plans
        : data?.billing
            ? [{
                plan_name: data.billing.plan_name,
                display_name: data.billing.display_name,
                price: data.billing.price,
                amount_paise: data.billing.amount_paise,
                currency: data.billing.currency,
                billing_period_days: data.billing.billing_period_days || 30,
                checkout_description: 'Monthly LinkedIn automation subscription',
                features: [],
                is_popular: true,
            }]
            : [];
    const checkoutButtonLabel = isSubscribed
        ? 'Extend 30 Days'
        : isTrialActive
            ? 'Upgrade to Pro'
            : 'Start Pro Plan';
    const planWindowLabel = isTrialActive
        ? 'Trial ends'
        : isSubscribed
            ? 'Renews on'
            : 'Last access ended';
    const planWindowValue = isTrialActive
        ? formatBillingDate(data?.subscription?.trial_end)
        : isSubscribed
            ? formatBillingDate(data?.subscription?.renewal_date)
            : formatBillingDate(data?.subscription?.renewal_date || data?.subscription?.trial_end);

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
            <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

            <div className="space-y-8">
                {/* Subscription Status Banner */}
                {errorMessage && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                        {errorMessage}
                    </div>
                )}

                {!hasAccess && (
                    <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                            <div>
                                <h3 className="text-sm font-medium text-yellow-800">Subscription Required</h3>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Your trial or paid window has ended. Complete payment to continue using automation features.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleStartCheckout()}
                                disabled={!billingEnabled || checkoutLoading}
                                className="md:ml-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                {billingEnabled ? 'Pay with Razorpay' : 'Billing Not Ready'}
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
                                <p className="text-sm text-gray-500">Total Posted</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {data?.total_posted || 0}
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
                                <p className="text-sm text-gray-500">Posted Today</p>
                                <p className="text-2xl font-bold text-emerald-600 mt-1">
                                    {data?.posted_today || 0}
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

                {/* Billing section — only show when NOT on active subscription */}
                {!isSubscribed && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Billing</p>
                                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                                    {isTrialActive ? 'Upgrade to Pro' : 'Choose Your Plan'}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {planWindowLabel}: {planWindowValue} · {formatPlanLabel(data?.subscription?.status)}
                                </p>
                            </div>
                            <input
                                value={couponCode}
                                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                                placeholder="Coupon code"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 md:w-52"
                            />
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                            {billingPlans.map((plan) => (
                                <div
                                    key={plan.plan_name}
                                    className={`relative rounded-xl border p-5 ${plan.is_popular ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200 bg-white'}`}
                                >
                                    {plan.is_popular && (
                                        <span className="absolute right-4 top-4 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white">
                                            Most Popular
                                        </span>
                                    )}
                                    <p className="text-lg font-bold text-slate-900">{plan.display_name}</p>
                                    <p className="mt-1 text-sm text-slate-600">{plan.checkout_description}</p>
                                    <div className="mt-5">
                                        {/* Crossed-out original price + badge */}
                                        {plan.original_amount_paise && plan.original_amount_paise > plan.amount_paise && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm text-slate-400 line-through">₹{(plan.original_amount_paise / 100).toFixed(0)}</span>
                                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                                                    {Math.round(((plan.original_amount_paise - plan.amount_paise) / plan.original_amount_paise) * 100)}% OFF
                                                </span>
                                            </div>
                                        )}
                                        {/* Actual price */}
                                        <div className="flex items-end gap-1">
                                            <span className="text-3xl font-bold text-slate-950">₹{(plan.amount_paise / 100).toFixed(0)}</span>
                                            <span className="pb-1 text-sm font-medium text-slate-500">/month</span>
                                        </div>
                                    </div>
                                    <ul className="mt-5 space-y-2">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={() => handleStartCheckout(plan.plan_name)}
                                        disabled={!billingEnabled || checkoutLoading}
                                        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${plan.is_popular ? 'bg-sky-600 text-white hover:bg-sky-700' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                                    >
                                        {checkoutLoading && checkoutPlanName === plan.plan_name ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                        {billingEnabled ? (plan.plan_name === 'starter' ? 'Go with Starter' : checkoutButtonLabel) : 'Waiting for Billing Setup'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Subscribed users: show a clean summary card linking to /billing */}
                {isSubscribed && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                            <div>
                                <p className="font-semibold text-emerald-900">Active Subscription</p>
                                <p className="text-sm text-emerald-700">
                                    Your plan is active · Renews {planWindowValue}
                                </p>
                            </div>
                        </div>
                        <a
                            href="/billing"
                            className="shrink-0 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                        >
                            Manage Plan →
                        </a>
                    </div>
                )}


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
