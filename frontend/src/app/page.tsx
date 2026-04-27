'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    ArrowRight,
    Calendar,
    CheckCircle2,
    FileText,
    Gauge,
    Instagram,
    Linkedin,
    LockKeyhole,
    PenTool,
    ShieldCheck,
    Sparkles,
    Timer,
    Zap,
} from 'lucide-react';

const features = [
    {
        icon: Sparkles,
        title: 'AI Strategy Engine',
        description: 'Choose your goal, audience, and tone. eLAutopost turns that into hooks, captions, and content angles built for LinkedIn growth.',
    },
    {
        icon: Calendar,
        title: '30-Day Content Calendar',
        description: 'Plan a full month of topics across authority, education, proof, and engagement so you always know what to publish next.',
    },
    {
        icon: Timer,
        title: 'Smart Auto-Post Scheduler',
        description: 'Schedule approved posts safely with controlled publishing windows and clear upcoming-post visibility.',
    },
    {
        icon: FileText,
        title: 'Premium PDF Carousels',
        description: 'Convert insights into polished multi-page PDF carousel content without opening a separate design tool.',
    },
    {
        icon: Gauge,
        title: 'Engagement Scoring',
        description: 'Review content quality signals before publishing so posts are easier to scan, understand, and act on.',
    },
    {
        icon: ShieldCheck,
        title: 'Security-First Workflow',
        description: 'Email verification, strong passwords, rate limits, secure headers, and admin-only controls protect the account flow.',
    },
];

const plans = [
    {
        name: 'Starter',
        subtitle: 'Perfect for dipping your toes in',
        price: '₹99',
        cta: 'Go with Starter',
        href: '/signup',
        featured: false,
        features: [
            '1 Post Per Day Limit',
            'Basic Content Generation',
            'Manual Publishing',
            'Standard Email Support',
        ],
    },
    {
        name: 'Pro Growth Engine',
        subtitle: 'The complete suite for brand growth',
        price: '₹299',
        cta: 'Start 30-Day Free Trial',
        href: '/signup',
        featured: true,
        features: [
            'Full AI Strategy Engine',
            'Smart Auto-Post Scheduler',
            'Premium PDF Carousels',
            '30-Day Content Calendar',
            'Engagement Scoring',
        ],
    },
];

const securityItems = [
    'Verified email before first password login',
    'Strong password rules with min/max length',
    'Rate limits for login, admin, billing, and API routes',
    'Security headers, same-origin API checks, and admin route protection',
];

const faqs = [
    {
        question: 'Is there a free trial?',
        answer: 'Yes. Every new user gets a 30-day free trial to explore the premium workflow before choosing a paid plan.',
    },
    {
        question: 'What is the difference between Starter and Pro?',
        answer: 'Starter is for simple daily manual posting. Pro unlocks the full growth engine, auto-scheduling, carousels, calendar planning, and engagement scoring.',
    },
    {
        question: 'Are my accounts safe from bans?',
        answer: 'The app is designed around controlled publishing, clear review steps, and safe API usage patterns instead of spam-style automation.',
    },
];

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-3">
                        <img
                            src="/eLautopost_logo.png"
                            alt="eLAutopost AI Logo"
                            className="h-10 w-10 rounded-lg object-contain"
                        />
                        <span className="hidden text-lg font-bold tracking-tight text-slate-950 sm:inline">eLAutopost AI</span>
                    </Link>

                    <div className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
                        <a href="#features" className="hover:text-sky-700">Features</a>
                        <a href="#pricing" className="hover:text-sky-700">Pricing</a>
                        <a href="#security" className="hover:text-sky-700">Security</a>
                        <a href="#faq" className="hover:text-sky-700">FAQ</a>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-sky-700">
                            Log in
                        </Link>
                        <Link href="/signup" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">
                            Start Free Trial
                        </Link>
                    </div>
                </div>
            </nav>

            <section className="relative overflow-hidden border-b border-slate-200 bg-white">
                <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-3xl"
                    >
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800">
                            <Zap className="h-4 w-4" />
                            30-day free trial for new users
                        </div>
                        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">
                            Scale your LinkedIn reach without busywork.
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                            eLAutopost AI helps professionals and growing brands plan, write, score, schedule, and publish LinkedIn content from one focused workspace.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link href="/signup" className="inline-flex h-12 items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-bold text-white shadow-lg shadow-sky-600/20 hover:bg-sky-700">
                                Create Account
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                            <a href="#pricing" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-slate-800 hover:bg-slate-50">
                                View Pricing
                            </a>
                        </div>
                    </motion.div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 shadow-2xl">
                        <div className="rounded-xl bg-white p-5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <img src="/eLautopost_logo.png" alt="eLAutopost AI" className="h-9 w-9 rounded-lg object-contain" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-950">Growth Workspace</p>
                                        <p className="text-xs text-slate-500">Plan · Write · Schedule</p>
                                    </div>
                                </div>
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Ready</span>
                            </div>
                            <div className="mt-5 space-y-3">
                                {[
                                    ['AI Hook', 'Your next client is already reading LinkedIn.'],
                                    ['Calendar', '30 strategic topics prepared'],
                                    ['Carousel', 'PDF draft ready for review'],
                                    ['Scheduler', 'Next post queued safely'],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">{label}</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="features" className="bg-slate-50 px-4 py-20 sm:px-6">
                <div className="mx-auto max-w-7xl">
                    <div className="max-w-2xl">
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-700">Features</p>
                        <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">A clear workflow for serious LinkedIn growth.</h2>
                        <p className="mt-4 text-slate-600">Everything is built so users understand what to create, why it matters, and when it will publish.</p>
                    </div>
                    <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <div key={feature.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mt-5 text-lg font-bold text-slate-950">{feature.title}</h3>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="pricing" className="border-y border-slate-200 bg-white px-4 py-20 sm:px-6">
                <div className="mx-auto max-w-5xl">
                    <div className="text-center">
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-700">Pricing</p>
                        <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">Start small, upgrade when growth needs more power.</h2>
                    </div>

                    <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {plans.map((plan) => (
                            <div
                                key={plan.name}
                                className={`relative rounded-2xl border p-7 shadow-sm ${plan.featured ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}
                            >
                                {plan.featured && (
                                    <span className="absolute right-5 top-5 rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">
                                        Most Popular
                                    </span>
                                )}
                                <h3 className="text-2xl font-bold text-slate-950">{plan.name}</h3>
                                <p className="mt-2 text-sm text-slate-600">{plan.subtitle}</p>
                                <div className="mt-6 flex items-end gap-2">
                                    <span className="text-5xl font-extrabold text-slate-950">{plan.price}</span>
                                    <span className="pb-2 text-sm font-semibold text-slate-500">/month</span>
                                </div>
                                <ul className="mt-7 space-y-3 border-t border-slate-200 pt-6">
                                    {plan.features.map((item) => (
                                        <li key={item} className="flex items-start gap-3 text-sm font-medium text-slate-700">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={plan.href}
                                    className={`mt-7 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-bold ${plan.featured ? 'bg-sky-600 text-white hover:bg-sky-700' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                                >
                                    {plan.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="security" className="bg-slate-50 px-4 py-20 sm:px-6">
                <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-700">Security</p>
                        <h2 className="mt-3 text-3xl font-bold text-slate-950">Built with OWASP-style account safety in mind.</h2>
                        <p className="mt-4 text-slate-600">The application protects account creation, login, admin actions, and API requests with practical layered controls.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {securityItems.map((item) => (
                            <div key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-5">
                                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
                                <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="faq" className="border-t border-slate-200 bg-white px-4 py-20 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="text-center text-3xl font-bold text-slate-950">Questions?</h2>
                    <div className="mt-10 space-y-4">
                        {faqs.map((faq) => (
                            <div key={faq.question} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                                <h3 className="font-bold text-slate-950">{faq.question}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="bg-slate-950 px-4 py-12 text-white sm:px-6">
                <div className="mx-auto max-w-7xl">
                    <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3">
                                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
                                    <img src="/eLautopost_logo.png" alt="eLAutopost AI Logo" className="h-10 w-10 object-contain" />
                                </span>
                                <span className="text-xl font-bold">eLAutopost AI</span>
                            </div>
                            <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
                                Tools for modern professionals to scale LinkedIn content with strategy, consistency, and secure automation.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide">Product</h3>
                            <ul className="mt-5 space-y-3 text-sm text-slate-400">
                                <li><a href="#features" className="hover:text-white">Features</a></li>
                                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                                <li><Link href="/login" className="hover:text-white">Login</Link></li>
                                <li><Link href="/signup" className="hover:text-white">Sign Up</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide">Legal</h3>
                            <ul className="mt-5 space-y-3 text-sm text-slate-400">
                                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                                <li><Link href="/cookies" className="hover:text-white">Cookie Policy</Link></li>
                                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-10 flex flex-col gap-5 border-t border-slate-800 pt-6 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm text-slate-500">© {new Date().getFullYear()} eLAutopost AI. All rights reserved.</p>
                        <div className="flex items-center gap-5">
                            <a
                                href="https://ecantechesolutions.vercel.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"
                            >
                                <img
                                    src="https://res.cloudinary.com/dur6fkyoz/image/upload/v1773518487/ChatGPT_Image_Nov_17_2025_07_19_54_AM_ifltwd.png"
                                    alt="eCantech Logo"
                                    className="h-7 w-7 rounded bg-white object-contain"
                                />
                                eCantech eSolutions
                            </a>
                            <a href="https://www.linkedin.com/in/ecantech-esolutions-436a71383/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-slate-400 hover:text-white">
                                <Linkedin className="h-5 w-5" />
                            </a>
                            <a href="https://www.instagram.com/ecantech_esolutions/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-slate-400 hover:text-white">
                                <Instagram className="h-5 w-5" />
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
