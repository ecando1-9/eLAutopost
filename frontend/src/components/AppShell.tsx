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
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                                        active
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
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

            <footer className="border-t border-slate-200 bg-white/80">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <p>{new Date().getFullYear()} eLAutopost AI. Built for consistent LinkedIn growth.</p>
                    <div className="flex items-center gap-4">
                        <Link href="/privacy" className="hover:text-slate-900">
                            Privacy
                        </Link>
                        <Link href="/cookies" className="hover:text-slate-900">
                            Cookies
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
