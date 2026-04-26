'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2, AlertCircle, MailCheck, Shield } from 'lucide-react';
import { adminService } from '@/services/admin';
import {
    getFriendlyAuthErrorMessage,
    getResendConfirmationMessage,
    normalizeEmail,
    resendConfirmationEmail,
    shouldOfferConfirmationResend,
} from '@/lib/auth-email';

export default function AdminLoginPage() {
    const router = useRouter();
    const [supabase] = useState(() => createClientComponentClient());
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
    const [resendingConfirmation, setResendingConfirmation] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setInfo(null);
        setPendingVerificationEmail(null);

        const loginEmail = normalizeEmail(email);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password,
            });

            if (error) throw error;

            await adminService.getCurrentAdmin();
            router.push('/admin/dashboard');
            router.refresh();
        } catch (err: unknown) {
            await supabase.auth.signOut();
            setError(getFriendlyAuthErrorMessage(err));
            if (loginEmail && shouldOfferConfirmationResend(err)) {
                setPendingVerificationEmail(loginEmail);
                setInfo('Verify the admin email first, then sign in again.');
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
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-2xl">
                        <Shield className="h-9 w-9" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
                    Admin Portal
                </h2>
                <p className="mt-2 text-center text-sm text-gray-300">
                    Authorized access only
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white/10 backdrop-blur-lg py-8 px-4 shadow-2xl sm:rounded-lg sm:px-10 border border-white/20">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {info && (
                            <div className="flex items-start gap-2 rounded-lg border border-blue-400/40 bg-blue-500/15 p-3 text-sm text-blue-100">
                                <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>{info}</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-900/50 p-3 text-sm text-red-200">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        {pendingVerificationEmail && (
                            <div className="rounded-lg border border-white/20 bg-white/5 p-4">
                                <p className="text-sm text-gray-200">
                                    Need another verification email for <span className="font-semibold text-white">{pendingVerificationEmail}</span>?
                                </p>
                                <button
                                    type="button"
                                    onClick={handleResendConfirmation}
                                    disabled={resendingConfirmation}
                                    className="mt-3 inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
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

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                                Admin Email
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
                                    className="block w-full appearance-none rounded-lg border border-white/30 bg-white/10 backdrop-blur px-3 py-2 text-white placeholder-gray-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-blue-400 sm:text-sm"
                                    placeholder="admin@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full appearance-none rounded-lg border border-white/30 bg-white/10 backdrop-blur px-3 py-2 text-white placeholder-gray-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-blue-400 sm:text-sm"
                                    placeholder="********"
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
                                        Authenticating...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="mr-2 h-4 w-4" />
                                        Sign in as Admin
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/20" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-transparent px-2 text-gray-300">
                                    Not an admin?
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <a
                                href="/login"
                                className="text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors"
                            >
                                Go to user login
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
