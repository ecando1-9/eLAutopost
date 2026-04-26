'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2, AlertCircle, User, Briefcase, Zap, ArrowLeft, MailCheck } from 'lucide-react';
import {
    getBrowserAuthRedirectUrl,
    getEmailConfirmationMessage,
    getFriendlyAuthErrorMessage,
    getResendConfirmationMessage,
    normalizeEmail,
    resendConfirmationEmail,
    shouldOfferConfirmationResend,
} from '@/lib/auth-email';

export default function AuthPage() {
    const router = useRouter();
    const [supabase] = useState(() => createClientComponentClient());
    const [activeTab, setActiveTab] = useState<'user' | 'employee'>('user');
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
    const [resendingConfirmation, setResendingConfirmation] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setInfo(null);
        setPendingVerificationEmail(null);

        const authEmail = normalizeEmail(email);

        try {
            if (isSignup) {
                const { error, data } = await supabase.auth.signUp({
                    email: authEmail,
                    password,
                    options: {
                        emailRedirectTo: getBrowserAuthRedirectUrl(window.location.origin),
                        data: {
                            full_name: fullName.trim(),
                        },
                    },
                });

                if (error) throw error;

                if (data.session) {
                    router.push('/dashboard');
                    router.refresh();
                    return;
                }

                setPendingVerificationEmail(authEmail);
                setInfo(getEmailConfirmationMessage(authEmail));
                setPassword('');
                setIsSignup(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password,
                });

                if (error) throw error;

                if (activeTab === 'employee') {
                    const { data: { user } } = await supabase.auth.getUser();

                    if (user) {
                        const { data: roleData } = await supabase
                            .from('roles')
                            .select('role')
                            .eq('user_id', user.id)
                            .single();

                        if (roleData?.role === 'admin') {
                            router.push('/admin/dashboard');
                        } else {
                            await supabase.auth.signOut();
                            throw new Error('Access denied. Admin privileges required.');
                        }
                    }
                } else {
                    router.push('/dashboard');
                }

                router.refresh();
            }
        } catch (err: unknown) {
            setError(getFriendlyAuthErrorMessage(err));
            if (authEmail && shouldOfferConfirmationResend(err)) {
                setPendingVerificationEmail(authEmail);
                setInfo('Verify your email first, then come back here to sign in.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResendConfirmation = async () => {
        if (!pendingVerificationEmail) {
            return;
        }

        setResendingConfirmation(true);
        setError(null);

        try {
            const { error: resendError } = await resendConfirmationEmail({
                supabase,
                email: pendingVerificationEmail,
                origin: window.location.origin,
            });

            if (resendError) throw resendError;

            setInfo(getResendConfirmationMessage(pendingVerificationEmail));
        } catch (err: unknown) {
            setError(getFriendlyAuthErrorMessage(err));
        } finally {
            setResendingConfirmation(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
            <button
                onClick={() => router.push('/')}
                className="absolute top-6 left-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-white/50"
            >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Home
            </button>

            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-2xl">
                        <Zap className="h-9 w-9" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                    {isSignup ? 'Create your account' : 'Sign in to AutoPost AI'}
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    {isSignup ? 'Verify your email before your first password login' : 'Welcome back!'}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                {!isSignup && (
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setActiveTab('user')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'user'
                                ? 'bg-white text-blue-600 shadow-lg border-2 border-blue-600'
                                : 'bg-white/50 text-gray-600 hover:bg-white/80 border-2 border-transparent'
                                }`}
                        >
                            <User className="h-5 w-5" />
                            User Login
                        </button>
                        <button
                            onClick={() => setActiveTab('employee')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'employee'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                : 'bg-white/50 text-gray-600 hover:bg-white/80 border-2 border-transparent'
                                }`}
                        >
                            <Briefcase className="h-5 w-5" />
                            Employee Login
                        </button>
                    </div>
                )}

                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-200">
                    <form className="space-y-6" onSubmit={handleAuth}>
                        {info && (
                            <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                                <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>{info}</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        {pendingVerificationEmail && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <p className="text-sm text-gray-700">
                                    Need another confirmation email for <span className="font-semibold">{pendingVerificationEmail}</span>?
                                </p>
                                <button
                                    type="button"
                                    onClick={handleResendConfirmation}
                                    disabled={resendingConfirmation}
                                    className="mt-3 inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {resendingConfirmation ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Resending...
                                        </>
                                    ) : (
                                        'Resend confirmation email'
                                    )}
                                </button>
                            </div>
                        )}

                        {isSignup && (
                            <div>
                                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                                    Full Name
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="fullName"
                                        name="fullName"
                                        type="text"
                                        autoComplete="name"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email address
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full justify-center rounded-lg border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 px-4 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isSignup ? 'Creating account...' : 'Signing in...'}
                                    </>
                                ) : (
                                    <>
                                        {isSignup ? 'Create Account' : activeTab === 'employee' ? 'Sign in as Employee' : 'Sign in'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-white px-2 text-gray-500">
                                    {isSignup ? 'Already have an account?' : "Don't have an account?"}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <button
                                onClick={() => {
                                    setIsSignup(!isSignup);
                                    setError(null);
                                }}
                                className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                            >
                                {isSignup ? 'Sign in instead' : 'Create a new account'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
