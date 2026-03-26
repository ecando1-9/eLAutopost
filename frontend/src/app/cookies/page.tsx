import Link from 'next/link';
import { ArrowLeft, Cookie } from 'lucide-react';

export const metadata = {
    title: 'Cookie Policy — eLAutopost AI',
    description: 'How eLAutopost AI uses cookies and browser storage.',
};

export default function CookiesPolicyPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
            <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                    <Link href="/" className="flex items-center gap-2 font-bold text-white tracking-tight text-lg">
                        <span className="text-indigo-400">eL</span>Autopost
                        <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-300">AI</span>
                    </Link>
                    <Link href="/" className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 transition-all">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Link>
                </div>
            </nav>

            <div className="mx-auto max-w-4xl px-6 py-16">
                <div className="mb-10 flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 ring-1 ring-amber-500/40">
                        <Cookie className="h-7 w-7 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Legal</p>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Cookie Policy</h1>
                        <p className="mt-1 text-sm text-slate-400">Last updated: March 2026 · Operated by eCan Tech eSolutions</p>
                    </div>
                </div>

                <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-200">
                    eLAutopost AI uses cookies and browser storage to keep your account secure and your experience smooth. Here&apos;s exactly what we store and why.
                </div>

                <div className="space-y-5 text-sm leading-relaxed text-slate-300">
                    <CookieTable categories={[
                        {
                            type: 'Essential Cookies',
                            purpose: 'Login session management, CSRF protection, API authentication',
                            storage: 'Secure HTTP-Only Cookie',
                            required: true,
                        },
                        {
                            type: 'Preference Storage',
                            purpose: 'Remembers UI selections like emoji density, tone, goal, audience defaults',
                            storage: 'localStorage (browser)',
                            required: false,
                        },
                        {
                            type: 'Auth Token Cache',
                            purpose: 'Supabase session token for fast, seamless re-authentication without re-login',
                            storage: 'localStorage (browser)',
                            required: true,
                        },
                        {
                            type: 'Analytics Cookies',
                            purpose: 'Anonymous usage tracking to help improve app performance and UX',
                            storage: 'Browser Cookie',
                            required: false,
                        },
                    ]} />

                    {[
                        {
                            title: 'How to Control Cookies',
                            body: 'You can clear browser cookies and localStorage at any time via your browser settings. Clearing essential cookies will sign you out. Clearing preference storage will reset your UI defaults but will not affect your account or schedule.',
                        },
                        {
                            title: 'Third-Party Cookies',
                            body: 'We integrate with Supabase and Google services. These providers may set their own cookies subject to their privacy policies. We do not use third-party advertising cookies or tracking pixels.',
                        },
                        {
                            title: 'Cookie Consent',
                            body: 'When you first use eLAutopost AI, you will be presented with a cookie consent banner. Accepting allows analytics cookies to be set. Rejecting non-essential cookies does not affect core account functionality.',
                        },
                        {
                            title: 'Contact',
                            body: 'Questions about cookies? Email ecando976@gmail.com.',
                        },
                    ].map(({ title, body }) => (
                        <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-6">
                            <h2 className="mb-3 text-base font-bold text-white">{title}</h2>
                            <p>{body}</p>
                        </div>
                    ))}
                </div>
            </div>

            <LegalFooter />
        </main>
    );
}

function CookieTable({ categories }: {
    categories: { type: string; purpose: string; storage: string; required: boolean }[];
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04]">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Type</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Purpose</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Storage</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Required</th>
                    </tr>
                </thead>
                <tbody>
                    {categories.map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.05] last:border-0">
                            <td className="px-5 py-4 font-semibold text-white">{row.type}</td>
                            <td className="px-5 py-4 text-slate-400">{row.purpose}</td>
                            <td className="px-5 py-4 text-slate-400">{row.storage}</td>
                            <td className="px-5 py-4">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.required ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-400'}`}>
                                    {row.required ? 'Required' : 'Optional'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function LegalFooter() {
    return (
        <footer className="border-t border-white/10 mt-16 px-6 py-8">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
                <p>© {new Date().getFullYear()} eCan Tech eSolutions. All rights reserved.</p>
                <div className="flex gap-4">
                    {[
                        { href: '/privacy', label: 'Privacy Policy' },
                        { href: '/terms', label: 'Terms & Conditions' },
                        { href: '/refund', label: 'Refund Policy' },
                        { href: '/cookies', label: 'Cookie Policy' },
                    ].map((item) => (
                        <Link key={item.href} href={item.href} className="hover:text-white transition-colors">{item.label}</Link>
                    ))}
                </div>
            </div>
        </footer>
    );
}
