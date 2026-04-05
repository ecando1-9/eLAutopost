import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
    title: 'Privacy Policy — eLAutopost AI',
    description: 'How eLAutopost AI by eCan Tech eSolutions collects, uses, and protects your data.',
};

export default function PrivacyPolicyPage() {
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
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 ring-1 ring-indigo-500/40">
                        <ShieldCheck className="h-7 w-7 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Legal</p>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Privacy Policy</h1>
                        <p className="mt-1 text-sm text-slate-400">Last updated: March 2026 · Operated by eCan Tech eSolutions</p>
                    </div>
                </div>

                <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                    {[
                        {
                            title: '1. Information We Collect',
                            body: 'We collect only the data needed to deliver our service: your account profile (name, email), LinkedIn OAuth tokens, automation settings, generated post content, and scheduling metadata. We do not collect sensitive personal data beyond what is necessary for authentication and content automation.',
                        },
                        {
                            title: '2. How We Use Your Data',
                            body: 'Your data is used to authenticate your account, generate AI content tailored to your preferences, schedule and publish posts to your LinkedIn profile, and send you service-related notifications (if enabled). We do not use your data for advertising.',
                        },
                        {
                            title: '3. LinkedIn Token Security',
                            body: 'LinkedIn OAuth tokens are stored securely server-side using encrypted storage. Tokens are never exposed to the frontend. We use the minimum required LinkedIn API scopes to operate the Service. Tokens expire periodically and require re-authentication.',
                        },
                        {
                            title: '4. Data Isolation',
                            body: 'All user-generated posts, settings, and scheduling data are scoped strictly to your user account. No data from one user&apos;s account is accessible by another user.',
                        },
                        {
                            title: '5. Third-Party Services',
                            body: 'We integrate with LinkedIn (for posting), Supabase (for data storage), and Google Gemini (for AI content generation). Each third party has its own privacy policy. We do not share your personal data with third parties for marketing.',
                        },
                        {
                            title: '6. Data Retention',
                            body: 'Your data is retained for as long as your account is active. Upon account deletion, all personal data and generated content is permanently removed within 30 days.',
                        },
                        {
                            title: '7. Your Rights',
                            body: 'You have the right to access, correct, export, or delete your personal data at any time. To exercise these rights, contact us at ecando976@gmail.com.',
                        },
                        {
                            title: '8. Security',
                            body: 'We implement industry-standard security measures including encrypted data storage, secure HTTPS connections, and role-based access controls. Admin actions are logged for audit and security review.',
                        },
                        {
                            title: '9. Children\'s Privacy',
                            body: 'eLAutopost AI is not intended for users under 18 years of age. We do not knowingly collect data from minors.',
                        },
                        {
                            title: '10. Contact',
                            body: 'For privacy-related queries, contact eCan Tech eSolutions at ecando976@gmail.com or +91 8897337784, Hyderabad, Telangana, India.',
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
