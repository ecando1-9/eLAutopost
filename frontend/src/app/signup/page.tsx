'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2, AlertCircle, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: signUpError, data } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            });

            if (signUpError) throw signUpError;

            if (data.session) {
                router.push('/dashboard');
                router.refresh();
            } else {
                setError('Please check your email to confirm your account.');
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthLogin = async (provider: 'google' | 'linkedin_oidc') => {
        setOauthLoading(provider);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/v1/callback`
                }
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message);
            setOauthLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900 selection:bg-blue-100 relative">
            
            {/* Ambient Background Gradient */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-50 to-transparent z-0" />

            {/* Left Side - Auth Form */}
            <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-[480px] z-10">
                <div className="mx-auto w-full max-w-sm lg:w-96 bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                    <div className="flex justify-center mb-8 cursor-pointer" onClick={() => router.push('/')}>
                        <img 
                            src="/eLautopost_logo.png" 
                            alt="eLAutopost AI Logo" 
                            className="h-12 w-auto object-contain"
                        />
                    </div>

                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                            Start Your Journey
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            Already have an account?{' '}
                            <Link href="/login" className="text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                                Log in instantly
                            </Link>
                        </p>
                    </div>

                    <div className="mt-8">
                        {error && (
                            <div className={`mb-6 flex items-center gap-2 p-3 text-sm rounded-xl border ${error.includes('check your email') ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <button
                                onClick={() => handleOAuthLogin('google')}
                                disabled={!!oauthLoading}
                                className="w-full h-11 flex justify-center items-center px-4 border border-slate-200 rounded-xl bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                            >
                                {oauthLoading === 'google' ? <Loader2 className="animate-spin h-5 w-5 mr-3" /> : (
                                    <svg className="h-5 w-5 mr-3" aria-hidden="true" viewBox="0 0 24 24">
                                        <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                                        <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                                        <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                                        <path d="M12.0004 24C15.2404 24 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24 12.0004 24Z" fill="#34A853" />
                                    </svg>
                                )}
                                Sign Up with Google
                            </button>

                            <button
                                onClick={() => handleOAuthLogin('linkedin_oidc')}
                                disabled={!!oauthLoading}
                                className="w-full h-11 flex justify-center items-center px-4 rounded-xl bg-[#0A66C2] text-sm font-semibold text-white hover:bg-[#004182] transition-colors shadow-md disabled:opacity-50"
                            >
                                {oauthLoading === 'linkedin_oidc' ? <Loader2 className="animate-spin h-5 w-5 mr-3 text-white" /> : (
                                    <svg className="h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                    </svg>
                                )}
                                Sign Up with LinkedIn
                            </button>
                        </div>

                        <div className="mt-8 relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-slate-100" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-slate-400 font-medium">Or create an account with email</span>
                            </div>
                        </div>

                        <form className="mt-8 space-y-5" onSubmit={handleSignup}>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="fullName" className="sr-only">Full Name</label>
                                    <input
                                        id="fullName"
                                        name="fullName"
                                        type="text"
                                        placeholder="Full Name"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="block w-full h-11 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 placeholder-slate-400 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="email" className="sr-only">Email address</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="Email address"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full h-11 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 placeholder-slate-400 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="sr-only">Password</label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="Password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full h-11 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 placeholder-slate-400 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:text-sm transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full h-11 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all font-bold"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating account...
                                    </>
                                ) : (
                                    'Create Account - ₹99/mo'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Right Side - Marketing */}
            <div className="hidden lg:flex relative w-0 flex-1 border-l border-slate-200 z-10 bg-white items-center justify-center p-12 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-3xl -z-10" />
                
                <div className="max-w-xl mx-auto space-y-12">
                    <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-2 shadow-sm text-blue-700 font-semibold mb-2">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-sm">Cancel at Any Time</span>
                    </div>

                    <h2 className="text-5xl text-slate-900 font-extrabold tracking-tight leading-tight">
                        Transform your brand reach in minutes.
                    </h2>
                    
                    <ul className="space-y-6">
                        {[
                            '7-Day Zero Commitment Trial',
                            'AI Strategy Coach Included',
                            'Spam-Protected Safe Infrastructure'
                        ].map((item, i) => (
                            <li key={i} className="flex items-center text-slate-600 font-medium">
                                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mr-4 shrink-0 shadow-sm border border-blue-100 text-blue-600">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <span className="text-lg">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
