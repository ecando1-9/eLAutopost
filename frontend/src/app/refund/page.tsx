import Link from 'next/link';
import { ArrowLeft, RefreshCcw } from 'lucide-react';

export const metadata = {
    title: 'Refund Policy — eLAutopost AI',
    description: 'Refund and cancellation policy for eLAutopost AI by eCan Tech eSolutions.',
};

export default function RefundPage() {
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
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-500/40">
                        <RefreshCcw className="h-7 w-7 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Financial</p>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Refund Policy</h1>
                        <p className="mt-1 text-sm text-slate-400">Last updated: March 2026</p>
                    </div>
                </div>

                <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                        <h2 className="mb-2 text-base font-bold text-emerald-300">Our Commitment</h2>
                        <p>We want you to be completely satisfied with eLAutopost AI. If you&apos;re not happy, we&apos;ll do our best to make it right.</p>
                    </div>

                    {[
                        {
                            title: 'Trial Period',
                            body: 'New users may be eligible for a trial period as specified during signup. No charges apply during the trial. You may cancel at any time before the trial ends without any fees.',
                        },
                        {
                            title: '7-Day Refund Window',
                            body: 'If you are unsatisfied with your paid subscription, you may request a full refund within 7 days of your first charge. Requests must be submitted via email to ecando976@gmail.com with your registered email address and reason for cancellation.',
                        },
                        {
                            title: 'Non-Refundable Scenarios',
                            body: 'Refunds are not available after the 7-day window has passed, for accounts terminated due to Terms of Service violations, or for partial subscription months after cancellation.',
                        },
                        {
                            title: 'Cancellation',
                            body: 'You may cancel your subscription at any time from the Settings page. Cancellation stops future billing but does not automatically trigger a refund. Access continues until the end of the current billing period.',
                        },
                        {
                            title: 'Processing Time',
                            body: 'Approved refunds are processed within 5–10 business days and will be returned to your original payment method. Bank processing times may vary.',
                        },
                        {
                            title: 'Contact for Refund Requests',
                            body: 'Email us at ecando976@gmail.com or call +91 8897337784. Please include your full name, registered email, and subscription details.',
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
