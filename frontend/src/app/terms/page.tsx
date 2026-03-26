import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata = {
    title: 'Terms & Conditions — eLAutopost AI',
    description: 'Read the Terms & Conditions for using eLAutopost AI, a product by eCan Tech eSolutions.',
};

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
            {/* Top nav bar */}
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
                        <FileText className="h-7 w-7 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Legal</p>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Terms &amp; Conditions</h1>
                        <p className="mt-1 text-sm text-slate-400">Last updated: March 2026</p>
                    </div>
                </div>

                <div className="space-y-8 text-sm leading-relaxed text-slate-300">
                    <Section title="1. Acceptance of Terms">
                        By accessing or using eLAutopost AI ("Service") operated by eCan Tech eSolutions, you agree to be bound by these Terms & Conditions. If you do not agree, please discontinue use immediately.
                    </Section>
                    <Section title="2. Service Description">
                        eLAutopost AI is a LinkedIn content automation platform that uses artificial intelligence to generate, schedule, and publish posts on behalf of registered users. The Service requires a valid LinkedIn account and active subscription.
                    </Section>
                    <Section title="3. Account Responsibility">
                        You are solely responsible for maintaining the confidentiality of your credentials, your LinkedIn account security, and all activity that occurs under your account. You must notify us immediately of any unauthorized access.
                    </Section>
                    <Section title="4. Acceptable Use">
                        You agree not to misuse the Service. Prohibited activities include using the platform to post spam, defamatory, illegal, or misleading content on LinkedIn; attempting to reverse-engineer the platform; reselling access without authorization; or violating LinkedIn's own Terms of Service.
                    </Section>
                    <Section title="5. Subscription & Billing">
                        Subscriptions are billed according to the plan you select. All fees are non-refundable except as outlined in our Refund Policy. We reserve the right to modify pricing with 30 days' notice.
                    </Section>
                    <Section title="6. LinkedIn API Compliance">
                        eLAutopost AI is built on LinkedIn's official API. Your use of the Service is subject to LinkedIn's own Terms of Service. We are not responsible for any changes LinkedIn makes to its API, access policies, or platform features that may affect Service functionality.
                    </Section>
                    <Section title="7. Data & Privacy">
                        Your use of the Service is also governed by our <Link href="/privacy" className="text-indigo-400 underline hover:text-indigo-300">Privacy Policy</Link>. We do not sell or share personal data with third parties for advertising purposes.
                    </Section>
                    <Section title="8. Limitation of Liability">
                        eCan Tech eSolutions shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, including any lost business, lost followers, or LinkedIn account restrictions.
                    </Section>
                    <Section title="9. Termination">
                        We reserve the right to suspend or terminate accounts that violate these Terms, with or without notice. You may cancel your subscription at any time from your account settings.
                    </Section>
                    <Section title="10. Governing Law">
                        These Terms shall be governed by the laws of Telangana, India. Any disputes shall be subject to the exclusive jurisdiction of courts in Hyderabad, Telangana.
                    </Section>
                    <Section title="11. Contact">
                        For any legal queries, contact us at <a href="mailto:ecando976@gmail.com" className="text-indigo-400 underline hover:text-indigo-300">ecando976@gmail.com</a>.
                    </Section>
                </div>
            </div>
            <LegalFooter />
        </main>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-6">
            <h2 className="mb-3 text-base font-bold text-white">{title}</h2>
            <p className="text-slate-300">{children}</p>
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
