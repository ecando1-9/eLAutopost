import Link from 'next/link';
import { ArrowLeft, Mail, Phone, MapPin, Linkedin, Instagram } from 'lucide-react';

export const metadata = {
    title: 'Contact & Social — eLAutopost AI by eCan Tech eSolutions',
    description: 'Get in touch with eCan Tech eSolutions — email, phone, address, LinkedIn, and Instagram.',
};

const CONTACT = {
    email: 'ecando976@gmail.com',
    phone: '+91 8897337784',
    location: 'Hyderabad, Telangana, India',
    linkedin: 'https://www.linkedin.com/in/ecantech-esolutions-436a71383/',
    instagram: 'https://www.instagram.com/ecantech_esolutions/',
};

export default function ContactPage() {
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

            <div className="mx-auto max-w-4xl px-6 py-20">
                {/* Header */}
                <div className="mb-14 text-center">
                    <p className="mb-3 inline-block rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-400">
                        eCan Tech eSolutions
                    </p>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                        Get in <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Touch</span>
                    </h1>
                    <p className="mt-4 text-base text-slate-400 max-w-xl mx-auto">
                        We&apos;re here to help. Reach out via any channel below and we&apos;ll respond promptly.
                    </p>
                </div>

                {/* Contact Cards */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-12">
                    <ContactCard
                        icon={<Mail className="h-6 w-6 text-indigo-400" />}
                        label="Email Us"
                        value={CONTACT.email}
                        href={`mailto:${CONTACT.email}`}
                        color="indigo"
                    />
                    <ContactCard
                        icon={<Phone className="h-6 w-6 text-emerald-400" />}
                        label="Call Us"
                        value={CONTACT.phone}
                        href={`tel:${CONTACT.phone}`}
                        color="emerald"
                    />
                    <ContactCard
                        icon={<MapPin className="h-6 w-6 text-violet-400" />}
                        label="Our Location"
                        value={CONTACT.location}
                        color="violet"
                    />
                </div>

                {/* Socials */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
                    <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-slate-500">Follow Us</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <SocialCard
                            icon={<Linkedin className="h-7 w-7" />}
                            platform="LinkedIn"
                            handle="eCan Tech eSolutions"
                            url={CONTACT.linkedin}
                            gradient="from-[#0077b5] to-[#00a0dc]"
                        />
                        <SocialCard
                            icon={<Instagram className="h-7 w-7" />}
                            platform="Instagram"
                            handle="@ecantech_esolutions"
                            url={CONTACT.instagram}
                            gradient="from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888]"
                        />
                    </div>
                </div>

                {/* Office Hours */}
                <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Office Hours</p>
                    <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Monday – Friday</span>
                            <span className="font-semibold text-white">9:00 AM – 6:00 PM IST</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Saturday</span>
                            <span className="font-semibold text-white">10:00 AM – 2:00 PM IST</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Sunday</span>
                            <span className="text-slate-500 italic">Closed</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Email Response</span>
                            <span className="font-semibold text-emerald-400">Within 24 hours</span>
                        </div>
                    </div>
                </div>
            </div>

            <LegalFooter />
        </main>
    );
}

function ContactCard({
    icon, label, value, href, color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    href?: string;
    color: 'indigo' | 'emerald' | 'violet';
}) {
    const ring = {
        indigo: 'ring-indigo-500/30 bg-indigo-500/10 group-hover:ring-indigo-500/60',
        emerald: 'ring-emerald-500/30 bg-emerald-500/10 group-hover:ring-emerald-500/60',
        violet: 'ring-violet-500/30 bg-violet-500/10 group-hover:ring-violet-500/60',
    }[color];

    const card = (
        <div className={`group flex h-full flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-6 transition-all hover:border-white/20 hover:bg-white/[0.08]`}>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-all ${ring}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-white break-all">{value}</p>
            </div>
        </div>
    );

    return href ? <a href={href} className="no-underline">{card}</a> : card;
}

function SocialCard({
    icon, platform, handle, url, gradient,
}: {
    icon: React.ReactNode;
    platform: string;
    handle: string;
    url: string;
    gradient: string;
}) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-white/20 hover:bg-white/[0.07]"
        >
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{platform}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white">{handle}</p>
                <p className="mt-0.5 text-xs text-slate-500 group-hover:text-indigo-400 transition-colors">View Profile →</p>
            </div>
        </a>
    );
}

function LegalFooter() {
    return (
        <footer className="border-t border-white/10 mt-8 px-6 py-8">
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
