'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Zap, CheckCircle2, ChevronRight, Loader2, PlayCircle, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ContentCalendarPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [calendarGenerated, setCalendarGenerated] = useState(false);
    
    // Mock Data for the 30-day plan
    const generateMockCalendar = () => {
        const categories = ['Authority', 'Story', 'Framework', 'Discussion', 'SaaS Tip'];
        const topics = [
            'Biggest misconception about AI',
            'How I learned to code faster',
            '3-step framework for founders',
            'Is remote work dead? Thoughts?',
            'Why 90% of SaaS fail in year 1',
            'The power of anti-gravity tools',
            'My biggest failure and the lesson',
            'Stop using ChatGPT like a search engine',
            'The future of LinkedIn growth',
            'Unconventional advice for juniors'
        ];
        
        return Array.from({ length: 30 }).map((_, i) => ({
            day: i + 1,
            category: categories[Math.floor(Math.random() * categories.length)],
            topic: topics[Math.floor(Math.random() * topics.length)],
            format: Math.random() > 0.5 ? 'Carousel' : 'Text Post',
            status: i === 0 ? 'Ready' : 'Draft'
        }));
    };

    const [calendar, setCalendar] = useState<any[]>([]);

    const handleGenerate = () => {
        setLoading(true);
        // Simulate API call to strategy engine
        setTimeout(() => {
            setCalendar(generateMockCalendar());
            setCalendarGenerated(true);
            setLoading(false);
        }, 2000);
    };

    const handleGeneratePost = (topic: string, goal: string) => {
        // Route to the wizard with pre-filled parameters via query string
        router.push(`/content/create?topic=${encodeURIComponent(topic)}&goal=${encodeURIComponent(goal)}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <CalendarIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">AI Content Calendar</h1>
                            <p className="text-sm text-gray-500">Your 30-Day LinkedIn Strategy</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                {!calendarGenerated ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl mx-auto mt-12 bg-white rounded-3xl p-10 border border-gray-200 shadow-xl text-center"
                    >
                        <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                            <Zap className="h-10 w-10 text-indigo-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Never run out of ideas again.</h2>
                        <p className="text-gray-600 mb-8 text-lg">
                            Click below to generate a hyper-personalized 30-day LinkedIn content plan designed for growth, engagement, and authority building.
                        </p>
                        
                        <div className="bg-gray-50 rounded-2xl p-6 text-left mb-8 border border-gray-100">
                            <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">The strategy includes:</h3>
                            <ul className="space-y-3">
                                {['Mondays: Authority building', 'Wednesdays: Deep-dive Carousels', 'Fridays: Personal storytelling'].map((item, i) => (
                                    <li key={i} className="flex items-center text-gray-600 text-sm">
                                        <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-3" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button 
                            onClick={handleGenerate}
                            disabled={loading}
                            className="w-full py-4 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin h-6 w-6 mr-2" />
                                    Analyzing niche & generating plan...
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="h-6 w-6 mr-2" />
                                    Generate 30-Day Calendar
                                </>
                            )}
                        </button>
                    </motion.div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-gray-900">Your Strategic Content Plan</h2>
                            <div className="bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-semibold border border-green-200 flex items-center">
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Plan Active
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {calendar.map((item, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                            Day {item.day}
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-semibold ${
                                            item.category === 'Authority' ? 'bg-blue-50 text-blue-700' :
                                            item.category === 'Story' ? 'bg-purple-50 text-purple-700' :
                                            item.category === 'Discussion' ? 'bg-orange-50 text-orange-700' :
                                            'bg-indigo-50 text-indigo-700'
                                        }`}>
                                            {item.category}
                                        </div>
                                    </div>
                                    
                                    <h3 className="font-bold text-gray-900 text-lg mb-2 leading-tight">
                                        {item.topic}
                                    </h3>
                                    
                                    <p className="text-sm text-gray-500 mb-6 flex items-center">
                                        <span className="w-2 h-2 rounded-full bg-gray-300 mr-2"></span>
                                        Format: <span className="font-semibold ml-1">{item.format}</span>
                                    </p>
                                    
                                    <button 
                                        onClick={() => handleGeneratePost(item.topic, item.category)}
                                        className="w-full py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center group-hover:shadow-md"
                                    >
                                        <Zap className="h-4 w-4 mr-2" />
                                        Generate with AI
                                        <ChevronRight className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </main>
        </div>
    );
}
