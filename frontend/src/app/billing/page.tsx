'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    AlertCircle,
    BadgeCheck,
    Calendar,
    CheckCircle2,
    CreditCard,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';

interface BillingPlanOption {
    plan_name: string;
    display_name: string;
    price: number;
    amount_paise: number;
    currency: string;
    billing_period_days: number;
    checkout_description?: string;
    features: string[];
    is_popular?: boolean;
}

interface BillingData {
    enabled: boolean;
    plan_name: string;
    display_name: string;
    price: number;
    amount_paise: number;
    currency: string;
    plans?: BillingPlanOption[];
}

interface Subscription {
    status: string;
    plan_name?: string;
    price?: number;
    currency?: string;
    trial_end?: string;
    renewal_date?: string;
    last_payment_date?: string;
    subscription_start?: string;
}

interface RazorpaySuccessPayload {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface RazorpayConstructor {
    new (options: Record<string, unknown>): {
        open: () => void;
        on: (event: string, callback: (response: unknown) => void) => void;
    };
}

declare global {
    interface Window {
        Razorpay?: RazorpayConstructor;
    }
}

export default function BillingPage() {
    const router = useRouter();
    const [supabase] = useState(() => createClientComponentClient());
    const [loading, setLoading] = useState(true);
    const [billing, setBilling] = useState<BillingData | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [userEmail, setUserEmail] = useState('');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutPlanName, setCheckoutPlanName] = useState<string | null>(null);
    const [couponCode, setCouponCode] = useState('');
    const mountedRef = useRef(true);

    const formatDate = (value?: string) => {
        if (!value) return '—';
        return new Date(value).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
        });
    };

    const readResponseError = async (res: Response) => {
        try {
            const p = await res.json();
            return typeof p?.detail === 'string' ? p.detail : typeof p?.error === 'string' ? p.error : 'Something went wrong';
        } catch {
            return (await res.text()) || 'Something went wrong';
        }
    };

    useEffect(() => {
        mountedRef.current = true;
        const load = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { router.replace('/login'); return; }
                setUserEmail(session.user?.email || '');
                const token = session.access_token;

                const [planRes, dashRes] = await Promise.all([
                    fetch('/api/v1/billing/plan', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
                    fetch('/api/v1/user/dashboard', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
                ]);

                if (planRes.ok) setBilling(await planRes.json());
                if (dashRes.ok) {
                    const d = await dashRes.json();
                    setSubscription(d.subscription || null);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        };
        load();
        return () => { mountedRef.current = false; };
    }, [supabase, router]);

    const handleStartCheckout = async (planName?: string) => {
        if (!billing?.enabled) { toast.error('Razorpay is not configured on the server.'); return; }
        if (!window.Razorpay) { toast.error('Razorpay is still loading. Please try again.'); return; }

        const selectedPlanName = planName || billing.plan_name;
        setCheckoutPlanName(selectedPlanName);
        setCheckoutLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('/api/v1/billing/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ plan_name: selectedPlanName, coupon_code: couponCode.trim() || undefined }),
            });

            if (!res.ok) throw new Error(await readResponseError(res));
            const checkoutData = await res.json();

            const rzp = new window.Razorpay({
                key: checkoutData.key_id,
                amount: checkoutData.amount,
                currency: checkoutData.currency,
                name: checkoutData.name,
                image: checkoutData.image || `${window.location.origin}/eLautopost_logo.png`,
                description: checkoutData.description,
                order_id: checkoutData.order_id,
                prefill: checkoutData.prefill,
                notes: checkoutData.notes,
                theme: checkoutData.theme,
                modal: { ondismiss: () => setCheckoutLoading(false) },
                handler: async (payment: RazorpaySuccessPayload) => {
                    try {
                        const { data: { session: s } } = await supabase.auth.getSession();
                        const verifyRes = await fetch('/api/v1/billing/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token}` },
                            body: JSON.stringify(payment),
                        });
                        if (!verifyRes.ok) throw new Error(await readResponseError(verifyRes));
                        toast.success('🎉 Payment successful! Your plan is now active.');
                        // Reload subscription
                        const dashRes = await fetch('/api/v1/user/dashboard', { headers: { Authorization: `Bearer ${s?.access_token}` }, cache: 'no-store' });
                        if (dashRes.ok) { const d = await dashRes.json(); setSubscription(d.subscription || null); }
                    } catch (e: any) {
                        toast.error(e?.message || 'Payment succeeded but verification failed.');
                    } finally {
                        setCheckoutLoading(false);
                    }
                },
            });
            rzp.on('payment.failed', (e: any) => {
                toast.error(e?.error?.description || 'Payment failed. Please try again.');
                setCheckoutLoading(false);
            });
            rzp.open();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to start checkout');
            setCheckoutLoading(false);
            setCheckoutPlanName(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
        );
    }

    const isTrialActive = subscription?.status === 'trial';
    const isSubscribed = subscription?.status === 'active';
    const hasAccess = isTrialActive || isSubscribed;
    const billingEnabled = !!billing?.enabled;
    const billingPlans = billing?.plans?.length ? billing.plans : billing ? [{
        plan_name: billing.plan_name, display_name: billing.display_name,
        price: billing.price, amount_paise: billing.amount_paise, currency: billing.currency,
        billing_period_days: 30, checkout_description: 'Monthly LinkedIn automation', features: [], is_popular: true,
    }] : [];

    const statusColor = isSubscribed ? 'emerald' : isTrialActive ? 'sky' : 'red';
    const statusLabel = isSubscribed ? 'Active' : isTrialActive ? 'Trial' : 'Expired';
    const statusIcon = isSubscribed ? <BadgeCheck className="h-5 w-5" /> : isTrialActive ? <ShieldCheck className="h-5 w-5" /> : <XCircle className="h-5 w-5" />;

    return (
        <AppShell title="Billing & Subscription" description="Manage your plan, view payment history, and upgrade or extend your subscription.">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

            <div className="space-y-6">
                {/* Status card */}
                <div className={`rounded-2xl border p-6 ${isSubscribed ? 'border-emerald-200 bg-emerald-50' : isTrialActive ? 'border-sky-200 bg-sky-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isSubscribed ? 'bg-emerald-100 text-emerald-700' : isTrialActive ? 'bg-sky-100 text-sky-700' : 'bg-red-100 text-red-700'}`}>
                                {statusIcon}
                            </div>
                            <div>
                                <p className={`text-xs font-semibold uppercase tracking-widest ${isSubscribed ? 'text-emerald-600' : isTrialActive ? 'text-sky-600' : 'text-red-600'}`}>
                                    Subscription Status
                                </p>
                                <p className="mt-0.5 text-2xl font-black text-slate-900">{statusLabel}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                            <div>
                                <p className="text-slate-500">Plan</p>
                                <p className="font-semibold text-slate-900 capitalize">{subscription?.plan_name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">{isSubscribed ? 'Renews' : isTrialActive ? 'Trial ends' : 'Expired'}</p>
                                <p className="font-semibold text-slate-900">
                                    {isSubscribed ? formatDate(subscription?.renewal_date) : formatDate(subscription?.trial_end)}
                                </p>
                            </div>
                            {subscription?.last_payment_date && (
                                <div>
                                    <p className="text-slate-500">Last payment</p>
                                    <p className="font-semibold text-slate-900">{formatDate(subscription.last_payment_date)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Trial features reminder */}
                {isTrialActive && (
                    <div className="rounded-2xl border border-sky-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start gap-3">
                            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                            <div>
                                <p className="font-semibold text-slate-900">You're on a Free Trial — All features are enabled</p>
                                <p className="mt-1 text-sm text-slate-600">
                                    Enjoy full access to AI content generation, auto-posting, and calendar scheduling.
                                    Upgrade before your trial ends to keep everything running.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Expired warning */}
                {!hasAccess && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-900">Access Expired</p>
                            <p className="mt-1 text-sm text-red-700">Your trial or paid period has ended. Subscribe to resume auto-posting and AI generation.</p>
                        </div>
                    </div>
                )}

                {/* Plans */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
                                {isSubscribed ? 'Extend or Change Plan' : 'Choose Your Plan'}
                            </p>
                            <h2 className="mt-1 text-2xl font-black text-slate-900">
                                {isSubscribed ? 'Manage Subscription' : 'Subscribe to Continue'}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                placeholder="Coupon code"
                                className="w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                            />
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                        {billingPlans.map((plan) => (
                            <div
                                key={plan.plan_name}
                                className={`relative rounded-2xl border p-5 transition-shadow hover:shadow-md ${plan.is_popular ? 'border-sky-300 bg-gradient-to-br from-sky-50 to-indigo-50' : 'border-slate-200 bg-white'}`}
                            >
                                {plan.is_popular && (
                                    <span className="absolute right-4 top-4 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white">
                                        Most Popular
                                    </span>
                                )}
                                <p className="text-lg font-bold text-slate-900">{plan.display_name}</p>
                                <p className="mt-1 text-sm text-slate-500">{plan.checkout_description || 'LinkedIn automation subscription'}</p>
                                <div className="mt-4 flex items-end gap-1">
                                    <span className="text-4xl font-black text-slate-900">₹{(plan.amount_paise / 100).toFixed(0)}</span>
                                    <span className="pb-1 text-sm text-slate-500">/ {plan.billing_period_days} days</span>
                                </div>
                                {plan.features.length > 0 && (
                                    <ul className="mt-5 space-y-2">
                                        {plan.features.map((f) => (
                                            <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleStartCheckout(plan.plan_name)}
                                    disabled={!billingEnabled || checkoutLoading}
                                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${plan.is_popular ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg hover:shadow-xl' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                                >
                                    {checkoutLoading && checkoutPlanName === plan.plan_name ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CreditCard className="h-4 w-4" />
                                    )}
                                    {billingEnabled
                                        ? isSubscribed ? 'Extend Plan' : isTrialActive ? 'Upgrade Now' : 'Subscribe'
                                        : 'Billing Not Ready'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* What's included */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900">What's included in every plan</h3>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            'AI-powered post generation',
                            'Auto-publishing to LinkedIn',
                            'Content calendar & scheduling',
                            'Multiple topic categories',
                            'Razorpay secure payments',
                            'Email notifications',
                        ].map((f) => (
                            <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                {f}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Security note */}
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Payments are processed securely by Razorpay. We never store your card details.
                    All transactions are verified using HMAC-SHA256 signatures.
                </div>
            </div>
        </AppShell>
    );
}
