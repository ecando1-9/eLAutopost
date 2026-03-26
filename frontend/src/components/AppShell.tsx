'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    CalendarDays,
    ClipboardList,
    LayoutDashboard,
    Loader2,
    LogOut,
    Menu,
    PenSquare,
    Settings,
    ShieldCheck,
    X,
} from 'lucide-react';

type ShellNavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
};

interface AppShellProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    hidePageHeader?: boolean;
    contentClassName?: string;
}

export default function AppShell({
    children,
    title,
    description,
    action,
    hidePageHeader = false,
    contentClassName = '',
}: AppShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');

    const navItems = useMemo<ShellNavItem[]>(
        () => [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/content/create', label: 'Create', icon: PenSquare },
            { href: '/calendar', label: 'Calendar', icon: CalendarDays },
            { href: '/posts', label: 'Queue', icon: ClipboardList },
            { href: '/settings', label: 'Settings', icon: Settings },
            { href: '/requirements', label: 'Requirements', icon: ShieldCheck },
        ],
        []
    );

    useEffect(() => {
        const loadUser = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            setUserEmail(session?.user?.email || '');
        };
        void loadUser();
    }, [supabase]);

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard';
        }
        return pathname === href || pathname.startsWith(`${href}/`);
    };

    const handleSignOut = async () => {
        setSigningOut(true);
        try {
            await supabase.auth.signOut();
            router.push('/login');
        } finally {
            setSigningOut(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f8fb] text-slate-900">
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_#dbeafe_0%,_#f4f8fb_40%,_#f4f8fb_100%)]" />

            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <img
                                src="/eLautopost_logo.png"
                                alt="eLAutopost AI"
                                className="h-9 w-auto object-contain"
                            />
                            <span className="hidden text-base font-bold tracking-tight text-slate-900 sm:inline">
                                eLAutopost AI
                            </span>
                        </Link>
                    </div>

                    <nav className="hidden items-center gap-1 md:flex">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    title={item.label}
                                    className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors ${
                                        active
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                                >
                                    <Icon className="h-4 w-4 flex-shrink-0" />
                                    <span className="hidden lg:inline">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-2">
                        {userEmail && (
                            <p className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 lg:block">
                                {userEmail}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={signingOut}
                            className="hidden items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 md:inline-flex disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {signingOut ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <LogOut className="h-4 w-4" />
                            )}
                            Sign out
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen((prev) => !prev)}
                            className="inline-flex rounded-lg border border-slate-300 p-2 text-slate-700 md:hidden"
                            aria-label="Toggle navigation menu"
                        >
                            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                {mobileMenuOpen && (
                    <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
                        <nav className="space-y-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                                            active
                                                ? 'bg-slate-900 text-white'
                                                : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <button
                                type="button"
                                onClick={handleSignOut}
                                disabled={signingOut}
                                className="flex w-full items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {signingOut ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <LogOut className="h-4 w-4" />
                                )}
                                Sign out
                            </button>
                        </nav>
                    </div>
                )}
            </header>

            <main className={`mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${contentClassName}`}>
                {!hidePageHeader && (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Workspace
                                </p>
                                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
                                {description ? (
                                    <p className="mt-2 text-sm text-slate-600">{description}</p>
                                ) : null}
                            </div>
                            {action ? <div>{action}</div> : null}
                        </div>
                    </div>
                )}
                {children}
            </main>

            <footer className="border-t border-slate-200 bg-white">
                <div className="mx-auto max-w-7xl px-4 pt-10 pb-6 sm:px-6 lg:px-8">
                    {/* Top row: 3 columns */}
                    <div className="grid gap-8 sm:grid-cols-3">
                        {/* Brand */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg font-extrabold tracking-tight text-slate-900">
                                    <span className="text-indigo-600">eL</span>Autopost
                                </span>
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-600">AI</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
                                AI-powered LinkedIn content automation. Built for consistent growth.
                            </p>
                            <p className="mt-3 text-[11px] text-slate-400">A product by eCan Tech eSolutions</p>
                            {/* Social Icons */}
                            <div className="mt-4 flex gap-3">
                                <a
                                    href="https://www.linkedin.com/in/ecantech-esolutions-436a71383/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0077b5] text-white hover:opacity-80 transition-opacity"
                                    aria-label="LinkedIn"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M4.98 3.5C4.98 4.881 3.87 6 2.5 6S.02 4.881.02 3.5C.02 2.12 1.13 1 2.5 1s2.48 1.12 2.48 2.5zM.48 8.5h4V24h-4V8.5zm7.14 0h3.83v2.13h.05c.53-1 1.84-2.06 3.78-2.06 4.04 0 4.79 2.66 4.79 6.12V24h-4v-8.44c0-2.01-.04-4.6-2.8-4.6-2.8 0-3.23 2.19-3.23 4.45V24h-4V8.5z"/>
                                    </svg>
                                </a>
                                <a
                                    href="https://www.instagram.com/ecantech_esolutions/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 text-white hover:opacity-80 transition-opacity"
                                    aria-label="Instagram"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                    </svg>
                                </a>
                            </div>
                        </div>

                        {/* Legal Links */}
                        <div>
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Legal</p>
                            <ul className="space-y-2">
                                {[
                                    { href: '/privacy', label: 'Privacy Policy' },
                                    { href: '/terms', label: 'Terms & Conditions' },
                                    { href: '/refund', label: 'Refund Policy' },
                                    { href: '/cookies', label: 'Cookie Policy' },
                                ].map(({ href, label }) => (
                                    <li key={href}>
                                        <Link href={href} className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                                            {label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Contact */}
                        <div>
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Contact</p>
                            <ul className="space-y-2 text-xs text-slate-500">
                                <li>
                                    <a href="mailto:ecando976@gmail.com" className="hover:text-indigo-600 transition-colors">
                                        ecando976@gmail.com
                                    </a>
                                </li>
                                <li>
                                    <a href="tel:+918897337784" className="hover:text-indigo-600 transition-colors">
                                        +91 8897337784
                                    </a>
                                </li>
                                <li className="text-slate-400">Hyderabad, Telangana, India</li>
                                <li className="pt-1">
                                    <Link href="/contact" className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
                                        Contact &amp; Social →
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="mt-8 border-t border-slate-100 pt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[11px] text-slate-400">
                            © {new Date().getFullYear()} eCan Tech eSolutions. All rights reserved.
                        </p>
                        <div className="flex items-center gap-4">
                            <Link href="/requirements" className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 transition-colors">
                                <ShieldCheck className="h-3.5 w-3.5" /> Requirements
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
