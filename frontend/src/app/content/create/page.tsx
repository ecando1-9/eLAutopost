'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Loader2,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Download,
    Share2,
    Calendar,
    FileText,
    Target,
    Users,
    PenTool,
    MessageSquare,
    Copy,
    Check,
    ChevronRight,
    RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import AppShell from '@/components/AppShell';

// Define Step Types
type Step = 1 | 2 | 3 | 4 | 5;

// Define Form Data
interface FormData {
    topic: string;
    goal: string;
    audience: string;
    style: string;
    instructions: string;
    tone: string;
}

type PublishTarget = 'person' | 'organization' | 'both';

interface LocalPreferences {
    defaultGoal?: string;
    defaultAudience?: string;
    defaultStyle?: string;
    defaultTone?: string;
    targetMode?: PublishTarget;
    organizationId?: string;
}

// Wizard Options
const goals = [
    { id: 'Reach', label: 'Increase Reach', icon: Target, desc: 'Optimized for impressions and virality' },
    { id: 'Knowledge', label: 'Educate Audience', icon: Sparkles, desc: 'Clear explanations and insights' },
    { id: 'Authority', label: 'Build Authority', icon: CheckCircle2, desc: 'Expert frameworks and lessons' },
    { id: 'Discussion', label: 'Start Discussion', icon: MessageSquare, desc: 'Engaging questions and hot takes' },
    { id: 'Promotion', label: 'Promote Product', icon: Share2, desc: 'Subtle value-driven promotion' },
    { id: 'Research', label: 'Share Research', icon: FileText, desc: 'Data-backed findings and trends' },
];

const audiences = [
    { id: 'Founders', label: 'Founders', icon: Users },
    { id: 'Developers', label: 'Developers', icon: Users },
    { id: 'Recruiters', label: 'Recruiters', icon: Users },
    { id: 'Students', label: 'Students', icon: Users },
    { id: 'Marketers', label: 'Marketers', icon: Users },
    { id: 'General Professionals', label: 'General Professionals', icon: Users },
];

const styles = [
    { id: 'Storytelling', label: 'Storytelling', icon: PenTool, desc: 'A narrative approach' },
    { id: 'List Format', label: 'List Format', icon: FileText, desc: 'Bite-sized bullet points' },
    { id: 'Framework', label: 'Framework', icon: Target, desc: 'Step-by-step systems' },
    { id: 'Question Format', label: 'Question Format', icon: MessageSquare, desc: 'Audience engagement focused' },
    { id: 'Opinion / Hot Take', label: 'Opinion / Hot Take', icon: AlertCircle, desc: 'Bold and controversial' },
    { id: 'Carousel slides', label: 'Carousel slides', icon: FileText, desc: 'Graphic-friendly slides' },
];

const tones = ['Professional', 'Casual', 'Bold', 'Witty', 'Academic'];

function CreateContentPageFallback() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
    );
}

export default function CreateContentPage() {
    return (
        <Suspense fallback={<CreateContentPageFallback />}>
            <CreateContentPageContent />
        </Suspense>
    );
}

function CreateContentPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClientComponentClient();
    
    // UI State
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSavingPost, setIsSavingPost] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState<FormData>({
        topic: '',
        goal: 'Authority',
        audience: 'General Professionals',
        style: 'Carousel slides',
        instructions: '',
        tone: 'Professional'
    });
    
    // Results State
    const [result, setResult] = useState<any>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [targetMode, setTargetMode] = useState<PublishTarget>('person');
    const [organizationId, setOrganizationId] = useState('');
    const [scheduledAt, setScheduledAt] = useState(() => {
        const base = new Date();
        base.setDate(base.getDate() + 1);
        base.setHours(9, 0, 0, 0);
        const tzOffsetMs = base.getTimezoneOffset() * 60000;
        return new Date(base.getTime() - tzOffsetMs).toISOString().slice(0, 16);
    });

    // Template/Theme Data
    const templates = [
        { id: 'indigo', name: 'Pro Indigo', bg: 'bg-indigo-600', text: 'text-white', border: 'border-indigo-400', label: 'text-indigo-300' },
        { id: 'emerald', name: 'Emerald Growth', bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-400', label: 'text-emerald-300' },
        { id: 'slate', name: 'Dark Executive', bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-600', label: 'text-slate-400' },
        { id: 'minimal', name: 'Clean White', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-200', label: 'text-gray-500' },
        { id: 'gradient', name: 'Sunset Gradient', bg: 'bg-gradient-to-br from-orange-400 to-pink-600', text: 'text-white', border: 'border-white/20', label: 'text-orange-100' },
    ];
    const [activeTheme, setActiveTheme] = useState(templates[0]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('elautopost.preferences.v1');
            if (raw) {
                const prefs: LocalPreferences = JSON.parse(raw);
                const normalizedTone = prefs.defaultTone
                    ? `${prefs.defaultTone.charAt(0).toUpperCase()}${prefs.defaultTone.slice(1).toLowerCase()}`
                    : undefined;
                setFormData((prev) => ({
                    ...prev,
                    goal: prefs.defaultGoal || prev.goal,
                    audience: prefs.defaultAudience || prev.audience,
                    style: prefs.defaultStyle || prev.style,
                    tone: normalizedTone || prev.tone,
                }));
                if (prefs.targetMode) {
                    setTargetMode(prefs.targetMode);
                }
                if (prefs.organizationId) {
                    setOrganizationId(prefs.organizationId);
                }
            }
        } catch (error) {
            console.error('Failed to load local preferences:', error);
        }
    }, []);

    useEffect(() => {
        const qpTopic = searchParams.get('topic');
        const qpGoal = searchParams.get('goal');
        const qpDate = searchParams.get('scheduleDate');

        if (qpTopic) {
            setFormData((prev) => ({ ...prev, topic: qpTopic }));
        }
        if (qpGoal) {
            setFormData((prev) => ({ ...prev, goal: qpGoal }));
        }
        if (qpDate) {
            const parsed = new Date(qpDate);
            if (!Number.isNaN(parsed.getTime())) {
                parsed.setHours(9, 0, 0, 0);
                const tzOffsetMs = parsed.getTimezoneOffset() * 60000;
                setScheduledAt(
                    new Date(parsed.getTime() - tzOffsetMs).toISOString().slice(0, 16)
                );
            }
        }
    }, [searchParams]);

    useEffect(() => {
        const loadBackendDefaults = async () => {
            try {
                const response = await fetch('/api/v1/settings', { cache: 'no-store' });
                if (!response.ok) return;
                const settings = await response.json();
                if (settings.default_tone) {
                    const normalizedTone =
                        String(settings.default_tone).charAt(0).toUpperCase() +
                        String(settings.default_tone).slice(1).toLowerCase();
                    setFormData((prev) => ({ ...prev, tone: normalizedTone }));
                }
            } catch (error) {
                console.error('Failed to load backend defaults:', error);
            }
        };
        loadBackendDefaults();
    }, []);

    // Navigation
    const nextStep = () => setCurrentStep((prev) => (prev < 5 ? (prev + 1) as Step : prev));
    const prevStep = () => setCurrentStep((prev) => (prev > 1 ? (prev - 1) as Step : prev));

    // Handle Content Generation
    const handleGenerate = async () => {
        if (!formData.topic.trim()) {
            toast.error('Please enter a topic');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setPdfUrl(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/v1/content/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    topic: formData.topic,
                    goal: formData.goal,
                    audience: formData.audience,
                    style: formData.style,
                    tone: formData.tone.toLowerCase(),
                    instructions: formData.instructions
                })
            });

            if (!response.ok) throw new Error('Generation failed');
            
            const data = await response.json();
            setResult(data);
            setCurrentStep(5);
            toast.success('Content Strategist has prepared your post!');
        } catch (err: any) {
            setError(err.message);
            toast.error('Failed to generate content strategy');
        } finally {
            setLoading(false);
        }
    };

    // Handle PDF Generation
    const generatePdf = async () => {
        if (!result) return;
        
        setIsGeneratingPdf(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/v1/content/generate/carousel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    hook: result.hook,
                    caption: result.caption,
                    slides: result.slides,
                    author_name: session?.user?.email?.split('@')[0] || 'LinkedIn Creator',
                    theme: activeTheme.id
                })
            });

            if (!response.ok) throw new Error('PDF Generation failed');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            setPdfUrl(url);
            
            // Auto download
            const a = document.createElement('a');
            a.href = url;
            a.download = `carousel_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            toast.success('PDF Carousel ready for download!');
        } catch (err) {
            toast.error('Failed to generate PDF');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Caption copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    const buildPostPayload = () => {
        if (!result) return null;

        const normalizedType = String(result.content_type || 'insight').toLowerCase();
        const allowedTypes = ['alert', 'curiosity', 'insight', 'future'];
        const contentType = allowedTypes.includes(normalizedType) ? normalizedType : 'insight';

        const cta = result.cta ? `\n\n${result.cta}` : '';
        const hashtags = Array.isArray(result.hashtags) && result.hashtags.length > 0
            ? `\n\n${result.hashtags.map((h: string) => `#${String(h).replace(/^#/, '')}`).join(' ')}`
            : '';

        return {
            topic: formData.topic,
            hook: result.hook || 'LinkedIn update',
            image_prompt: result.image_prompt || `Professional LinkedIn visual for ${formData.topic}`,
            caption: `${result.caption || ''}${cta}${hashtags}`.trim(),
            content_type: contentType,
            image_url: null,
            target: targetMode === 'organization' ? 'organization' : 'person',
            organization_id: organizationId || null
        };
    };

    const createDraftPost = async (
        override?: { target?: 'person' | 'organization'; organizationId?: string }
    ): Promise<string> => {
        const payload = buildPostPayload();
        if (!payload) {
            throw new Error('No generated content to save');
        }

        const finalPayload = {
            ...payload,
            target: override?.target || payload.target,
            organization_id: override?.organizationId ?? payload.organization_id,
        };

        const response = await fetch('/api/v1/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to create draft');
        }

        const created = await response.json();
        return created.id;
    };

    const publishDraftPost = async (
        postId: string,
        target: 'person' | 'organization',
        orgId?: string
    ) => {
        const response = await fetch(`/api/v1/posts/${postId}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target,
                organization_id: target === 'organization' ? (orgId || '') : undefined,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to publish post');
        }
    };

    const scheduleDraftPost = async (
        postId: string,
        scheduledDateTime: string
    ) => {
        const iso = new Date(scheduledDateTime).toISOString();
        const response = await fetch(`/api/v1/posts/${postId}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduled_at: iso }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to schedule post');
        }
    };

    const handleSaveDraft = async () => {
        setIsSavingPost(true);
        try {
            if ((targetMode === 'organization' || targetMode === 'both') && !organizationId.trim()) {
                throw new Error('Please enter Organization/Page ID for page posting.');
            }

            if (targetMode === 'both') {
                await createDraftPost({ target: 'person' });
                await createDraftPost({ target: 'organization', organizationId: organizationId.trim() });
            } else if (targetMode === 'organization') {
                await createDraftPost({ target: 'organization', organizationId: organizationId.trim() });
            } else {
                await createDraftPost({ target: 'person' });
            }

            toast.success('Draft saved to your queue');
            router.push('/posts');
        } catch (err: any) {
            toast.error(err.message || 'Failed to save draft');
        } finally {
            setIsSavingPost(false);
        }
    };

    const handleSchedulePost = async () => {
        setIsSavingPost(true);
        try {
            if (!scheduledAt) {
                throw new Error('Please choose a schedule date and time.');
            }
            if ((targetMode === 'organization' || targetMode === 'both') && !organizationId.trim()) {
                throw new Error('Please enter Organization/Page ID for page posting.');
            }

            if (targetMode === 'both') {
                const postA = await createDraftPost({ target: 'person' });
                const postB = await createDraftPost({ target: 'organization', organizationId: organizationId.trim() });
                await scheduleDraftPost(postA, scheduledAt);
                await scheduleDraftPost(postB, scheduledAt);
            } else if (targetMode === 'organization') {
                const postId = await createDraftPost({ target: 'organization', organizationId: organizationId.trim() });
                await scheduleDraftPost(postId, scheduledAt);
            } else {
                const postId = await createDraftPost({ target: 'person' });
                await scheduleDraftPost(postId, scheduledAt);
            }

            toast.success('Post scheduled successfully');
            router.push('/posts');
        } catch (err: any) {
            toast.error(err.message || 'Failed to schedule post');
        } finally {
            setIsSavingPost(false);
        }
    };

    const handlePostNow = async () => {
        setIsSavingPost(true);
        try {
            if ((targetMode === 'organization' || targetMode === 'both') && !organizationId.trim()) {
                throw new Error('Please enter Organization/Page ID for page posting.');
            }

            if (targetMode === 'both') {
                const personPostId = await createDraftPost({ target: 'person' });
                await publishDraftPost(personPostId, 'person');

                const orgPostId = await createDraftPost({
                    target: 'organization',
                    organizationId: organizationId.trim()
                });
                await publishDraftPost(orgPostId, 'organization', organizationId.trim());
            } else if (targetMode === 'organization') {
                const postId = await createDraftPost({
                    target: 'organization',
                    organizationId: organizationId.trim()
                });
                await publishDraftPost(postId, 'organization', organizationId.trim());
            } else {
                const postId = await createDraftPost({ target: 'person' });
                await publishDraftPost(postId, 'person');
            }

            toast.success('Posted to LinkedIn');
            router.push('/posts');
        } catch (err: any) {
            toast.error(err.message || 'Failed to publish post');
        } finally {
            setIsSavingPost(false);
        }
    };

    // UI Components
    const OptionCard = ({ item, selected, onClick }: any) => {
        const Icon = item.icon;
        return (
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClick}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 ${
                    selected === item.id 
                    ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                    : 'border-gray-100 bg-white hover:border-indigo-200'
                }`}
            >
                <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${selected === item.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className={`font-semibold ${selected === item.id ? 'text-indigo-900' : 'text-gray-900'}`}>
                            {item.label}
                        </h3>
                        {item.desc && <p className="text-xs text-gray-500 mt-1">{item.desc}</p>}
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <AppShell title="Create Content" description="Generate strategy-first LinkedIn posts with templates." hidePageHeader>
            <div className="max-w-5xl mx-auto px-0 py-4">
                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Creation Wizard</p>
                            <h1 className="text-2xl font-extrabold text-slate-900">Build your next LinkedIn post</h1>
                        </div>
                        <div className="flex space-x-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <div
                                    key={s}
                                    className={`h-1.5 w-8 rounded-full transition-all duration-500 ${
                                        currentStep >= s ? 'bg-indigo-600' : 'bg-gray-200'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <AnimatePresence mode="wait">
                    {/* STEP 1: GOAL */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-extrabold text-gray-900">What's your primary goal?</h2>
                                <p className="text-gray-500">The strategist will optimize the tone and structure based on this.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {goals.map(g => (
                                    <OptionCard 
                                        key={g.id} 
                                        item={g} 
                                        selected={formData.goal} 
                                        onClick={() => { setFormData({...formData, goal: g.id}); nextStep(); }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: AUDIENCE */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-extrabold text-gray-900">Who are you writing for?</h2>
                                <p className="text-gray-500">Tailoring the complexity and vocabulary to your readers.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {audiences.map(a => (
                                    <OptionCard 
                                        key={a.id} 
                                        item={a} 
                                        selected={formData.audience} 
                                        onClick={() => { setFormData({...formData, audience: a.id}); nextStep(); }}
                                    />
                                ))}
                            </div>
                            
                            <div className="flex justify-center">
                                <button onClick={prevStep} className="flex items-center text-gray-500 hover:text-gray-700">
                                    <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: STYLE */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-extrabold text-gray-900">Choose a content style</h2>
                                <p className="text-gray-500">Pick a format that resonates with your brand voice.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {styles.map(s => (
                                    <OptionCard 
                                        key={s.id} 
                                        item={s} 
                                        selected={formData.style} 
                                        onClick={() => { setFormData({...formData, style: s.id}); nextStep(); }}
                                    />
                                ))}
                            </div>
                            
                            <div className="flex justify-center space-x-8">
                                <button onClick={prevStep} className="flex items-center text-gray-500 hover:text-gray-700">
                                    <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 4: TOPIC & INSTRUCTIONS */}
                    {currentStep === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-2xl mx-auto space-y-8"
                        >
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-extrabold text-gray-900">Nearly there!</h2>
                                <p className="text-gray-500">What's today's big idea?</p>
                            </div>

                            <div className="space-y-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Topic</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. The future of AI Agents in 2025"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                                        value={formData.topic}
                                        onChange={(e) => setFormData({...formData, topic: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Voice Tone</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tones.map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setFormData({...formData, tone: t})}
                                                className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                                                    formData.tone === t 
                                                    ? 'bg-indigo-600 text-white' 
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 text-gray-700">Custom Instructions (Optional)</label>
                                    <textarea 
                                        rows={3}
                                        placeholder="e.g. Focus on cybersecurity risks for small startups..."
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none"
                                        value={formData.instructions}
                                        onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                                    />
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={loading || !formData.topic.trim()}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            <span>The Strategist is thinking...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-5 w-5" />
                                            <span>Generate Strategy & Post</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="flex justify-center">
                                <button onClick={prevStep} className="flex items-center text-gray-500 hover:text-gray-700">
                                    <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 5: RESULTS */}
                    {currentStep === 5 && result && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                                    <Sparkles className="h-6 w-6 text-indigo-600 mr-2" />
                                    Your Strategy is Ready
                                </h2>
                                <button 
                                    onClick={() => setCurrentStep(1)}
                                    className="text-sm text-indigo-600 font-semibold hover:text-indigo-700 flex items-center"
                                >
                                    <RefreshCw className="h-4 w-4 mr-1" /> Start New
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left: Post Preview & Caption */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-xl space-y-6">
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Viral Hook</h3>
                                            <p className="text-2xl font-black text-gray-900 leading-tight">
                                                {result.hook}
                                            </p>
                                        </div>

                                        <div className="space-y-4 border-t border-gray-100 pt-6">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">LinkedIn Caption</h3>
                                                <button 
                                                    onClick={() => copyToClipboard(result.caption + "\n\n" + result.cta + "\n\n" + result.hashtags.join(' '))}
                                                    className="p-2 hover:bg-gray-100 rounded-lg text-indigo-600 transition-colors"
                                                >
                                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                {result.caption}
                                            </p>
                                            <p className="font-bold text-indigo-600 italic">
                                                {result.cta}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {result.hashtags.map((h: string) => (
                                                    <span key={h} className="text-sm font-medium text-gray-400">#{h}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                            Posting Target & Schedule
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {[
                                                { id: 'person', label: 'My Profile' },
                                                { id: 'organization', label: 'LinkedIn Page' },
                                                { id: 'both', label: 'Both' },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setTargetMode(opt.id as PublishTarget)}
                                                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                                        targetMode === opt.id
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {(targetMode === 'organization' || targetMode === 'both') && (
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                                    Organization/Page ID
                                                </label>
                                                <input
                                                    type="text"
                                                    value={organizationId}
                                                    onChange={(e) => setOrganizationId(e.target.value)}
                                                    placeholder="e.g. 123456789"
                                                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-600 outline-none"
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                                Schedule Date & Time
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={scheduledAt}
                                                onChange={(e) => setScheduledAt(e.target.value)}
                                                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-600 outline-none"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Default is tomorrow 09:00, you can change this.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <button 
                                            onClick={generatePdf}
                                            disabled={isGeneratingPdf}
                                            className="p-4 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-indigo-600 hover:text-indigo-600 transition-all group"
                                        >
                                            {isGeneratingPdf ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform" />}
                                            <span className="text-xs font-bold">Download PDF</span>
                                        </button>
                                        <button
                                            onClick={handlePostNow}
                                            disabled={isSavingPost}
                                            className="p-4 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-blue-600 hover:text-blue-600 transition-all group disabled:opacity-60"
                                        >
                                            <Share2 className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform text-blue-600" />
                                            <span className="text-xs font-bold">Post Now</span>
                                        </button>
                                        <button
                                            onClick={handleSchedulePost}
                                            disabled={isSavingPost}
                                            className="p-4 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-indigo-600 hover:text-indigo-600 transition-all group disabled:opacity-60"
                                        >
                                            <Calendar className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform text-indigo-600" />
                                            <span className="text-xs font-bold">Schedule</span>
                                        </button>
                                        <button
                                            onClick={handleSaveDraft}
                                            disabled={isSavingPost}
                                            className="p-4 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-green-600 hover:text-green-600 transition-all group disabled:opacity-60"
                                        >
                                            <CheckCircle2 className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform text-green-600" />
                                            <span className="text-xs font-bold">Save Draft</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Carousel Preview & Template Picker */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Visual Template</h3>
                                    </div>
                                    <div className="flex gap-2 mb-6 flex-wrap">
                                        {templates.map(t => (
                                            <button 
                                                key={t.id}
                                                onClick={() => setActiveTheme(t)}
                                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${t.bg} ${activeTheme.id === t.id ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'border-transparent'}`}
                                                title={t.name}
                                            />
                                        ))}
                                    </div>

                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-6">Carousel Preview (6 Slides)</h3>
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {result.slides.map((s: string, i: number) => (
                                            <motion.div 
                                                key={i}
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                className={`p-6 rounded-xl shadow-lg border-l-4 min-h-[140px] flex flex-col justify-between ${activeTheme.bg} ${activeTheme.border}`}
                                            >
                                                <p className={`${activeTheme.text} font-bold leading-tight`}>{s}</p>
                                                <div className="flex justify-between items-center mt-4">
                                                    <span className={`text-[10px] uppercase tracking-widest font-bold ${activeTheme.label}`}>Slide {i+1}</span>
                                                    <ChevronRight className={`h-4 w-4 ${activeTheme.label}`} />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Custom scrollbar styles */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #CBD5E1;
                }
            `}</style>
        </AppShell>
    );
}
