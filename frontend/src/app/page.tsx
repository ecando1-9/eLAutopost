'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
    ArrowRight, 
    Sparkles, 
    Zap, 
    CheckCircle2, 
    Globe,
    Linkedin,
    Instagram,
    LineChart,
    Calendar,
    PenTool
} from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
    const features = [
        {
            icon: <Zap className="h-6 w-6 text-blue-600" />,
            title: "AI Strategy Engine",
            description: "We don't just generate text. Tell us your goal (Reach, Sales, Authority), and our engine writes engaging hooks and predicts optimal strategies."
        },
        {
            icon: <PenTool className="h-6 w-6 text-indigo-600" />,
            title: "Automated Carousels",
            description: "Instantly convert your text insights into beautifully designed, multi-page PDF carousels without opening any external design software."
        },
        {
            icon: <Calendar className="h-6 w-6 text-violet-600" />,
            title: "30-Day Content Planner",
            description: "Say goodbye to writer's block. Generate a full month of strategic topics categorized for maximum audience growth and interaction."
        }
    ];

    const faqs = [
        {
            question: "Is there a free trial?",
            answer: "Yes! Every new user gets a full free trial with premium access to experience our tools."
        },
        {
            question: "What is the difference between Starter and Pro?",
            answer: "Starter (₹99) is for simple, manual daily posting. Pro (₹299) unlocks the full Growth Engine, engagement scoring, and auto-scheduling."
        },
        {
            question: "Are my accounts safe from bans?",
            answer: "Absolutely. We enforce strict human-like API dispatching (8-hour delays) to ensure your account is never flagged for spam."
        }
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
            {/* Gradient Header */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-50 to-transparent -z-10" />

            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <img 
                            src="/eLautopost_logo.png" 
                            alt="eLAutopost AI Logo" 
                            className="h-10 w-auto object-contain"
                        />
                        <span className="text-xl font-bold tracking-tight text-slate-900 hidden sm:inline-block">eLAutopost AI</span>
                    </div>

                    <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
                        <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a>
                    </div>

                    <div className="flex items-center space-x-4">
                        <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                            Log in
                        </Link>
                        <Link href="/signup" className="h-10 px-5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-semibold flex items-center transition-all shadow-md shadow-blue-600/20 hover:shadow-lg">
                            Start Free Trial
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-24 pb-20 px-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-4xl mx-auto space-y-8"
                >
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold shadow-sm">
                        <Sparkles className="h-4 w-4" />
                        <span>The Ultimate Growth Operating System</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
                        Scale your reach. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                            Zero busywork.
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        eLAutopost AI plans, writes, and schedules high-engagement LinkedIn content for busy professionals and growing brands.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <Link href="/signup" className="w-full sm:w-auto h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center transition-all shadow-lg shadow-blue-600/30">
                            Get Started Free
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                        <a href="#pricing" className="w-full sm:w-auto h-14 px-8 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-semibold flex items-center justify-center transition-all shadow-sm">
                            View Pricing
                        </a>
                    </div>
                </motion.div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-6 bg-white border-y border-slate-200">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Crafted for serious growth.</h2>
                        <p className="text-slate-600 max-w-xl mx-auto text-lg">Powerful tools built into a seamless, elegant workflow.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-8 hover:shadow-lg transition-all hover:-translate-y-1">
                                <div className="h-12 w-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center mb-6">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section - 99 vs 299 Anchoring */}
            <section id="pricing" className="py-24 px-6 relative bg-slate-50">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Transparent Pricing.</h2>
                        <p className="text-slate-600 max-w-xl mx-auto text-lg">Start small, upgrade when you need the full power.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto">
                        
                        {/* Starter Plan */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-10 shadow-sm">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900">Starter</h3>
                                    <p className="text-slate-500 mt-2">Perfect for dipping your toes in</p>
                                </div>
                                <div className="flex items-baseline text-slate-900">
                                    <span className="text-5xl font-extrabold">₹99</span>
                                    <span className="text-slate-500 ml-2 font-medium">/month</span>
                                </div>
                                <ul className="space-y-4 pt-6 mt-6 border-t border-slate-100">
                                    {['1 Post Per Day Limit', 'Basic Content Generation', 'Manual Publishing', 'Standard Email Support'].map(item => (
                                        <li key={item} className="flex items-center space-x-3 text-slate-700 font-medium">
                                            <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/signup" className="block w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-bold text-center transition-colors mt-8">
                                    Go with Starter
                                </Link>
                            </div>
                        </div>

                        {/* Pro Plan */}
                        <div className="bg-blue-600 rounded-3xl p-1 shadow-2xl shadow-blue-600/20 transform md:scale-105 z-10 relative">
                            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[23px] p-10 relative overflow-hidden h-full">
                                <div className="absolute top-0 right-8 bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-b-lg tracking-wider uppercase">
                                    Most Popular
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Pro Growth Engine</h3>
                                        <p className="text-blue-200 mt-2">The complete suite for brand growth</p>
                                    </div>
                                    <div className="flex items-baseline text-white">
                                        <span className="text-5xl font-extrabold">₹299</span>
                                        <span className="text-blue-200 ml-2 font-medium">/month</span>
                                    </div>
                                    <ul className="space-y-4 pt-6 mt-6 border-t border-white/10">
                                        {[
                                            'Full AI Strategy Engine',
                                            'Smart Auto-Post Scheduler',
                                            'Premium PDF Carousels',
                                            '30-Day Content Calendar',
                                            'Engagement Scoring'
                                        ].map(item => (
                                            <li key={item} className="flex items-center space-x-3 text-white font-medium">
                                                <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Link href="/signup" className="block w-full py-4 bg-white hover:bg-blue-50 text-blue-900 rounded-xl font-bold text-center transition-colors mt-8 shadow-md">
                                        Start Free Trial
                                    </Link>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

             {/* FAQ Section */}
             <section id="faq" className="py-24 px-6 relative bg-white border-t border-slate-200">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-3xl font-bold text-slate-900">Questions?</h2>
                    </div>

                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <div key={i} className="bg-slate-50 border border-slate-100 p-6 rounded-2xl hover:border-slate-300 transition-colors">
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{faq.question}</h3>
                                <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Premium Footer */}
            <footer className="bg-slate-900 border-t border-slate-800 pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center space-x-2 text-white mb-6">
                                <img 
                                    src="/eLautopost_logo.png" 
                                    alt="eLAutopost AI Logo" 
                                    className="h-10 w-auto object-contain brightness-0 invert"
                                />
                                <span className="font-bold text-xl tracking-tight hidden sm:inline-block">eLAutopost AI</span>
                            </div>
                            <p className="text-slate-400 max-w-sm mb-8 leading-relaxed">
                                Building the tools modern professionals need to scale their brands with authenticity and pure automation.
                            </p>
                        </div>
                        
                        <div>
                            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider">Product</h3>
                            <ul className="space-y-4 text-sm text-slate-400 font-medium">
                                <li><a href="#features" className="hover:text-blue-400 transition-colors">Features</a></li>
                                <li><a href="#pricing" className="hover:text-blue-400 transition-colors">Pricing</a></li>
                                <li><Link href="/login" className="hover:text-blue-400 transition-colors">Login</Link></li>
                                <li><Link href="/signup" className="hover:text-blue-400 transition-colors">Sign Up</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider">Legal</h3>
                            <ul className="space-y-4 text-sm text-slate-400 font-medium">
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Cookie Policy</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Contact</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-slate-500 text-sm font-medium">
                            © {new Date().getFullYear()} eLAutopost AI. All rights reserved.
                        </p>
                        
                        <div className="flex items-center space-x-6 text-sm">
                            <a 
                                href="https://ecantechesolutions.vercel.app/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center text-slate-400 hover:text-white transition-all font-semibold group"
                            >
                                <img 
                                    src="https://res.cloudinary.com/dur6fkyoz/image/upload/v1773518487/ChatGPT_Image_Nov_17_2025_07_19_54_AM_ifltwd.png" 
                                    alt="eCantech Logo" 
                                    className="h-6 w-auto mr-2 group-hover:scale-105 transition-transform rounded-sm"
                                />
                                eCantech eSolutions
                            </a>
                            
                            <div className="flex items-center space-x-4 border-l border-slate-700 pl-6">
                                <a 
                                    href="https://www.linkedin.com/in/ecantech-esolutions-436a71383/" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-[#0A66C2] transition-colors"
                                    aria-label="LinkedIn"
                                >
                                    <Linkedin className="h-5 w-5" />
                                </a>
                                <a 
                                    href="https://www.instagram.com/ecantech_esolutions/" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-pink-500 transition-colors"
                                    aria-label="Instagram"
                                >
                                    <Instagram className="h-5 w-5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
