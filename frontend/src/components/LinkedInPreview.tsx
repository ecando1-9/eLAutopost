'use client';

import { useState } from 'react';
import { X, Eye, ThumbsUp, MessageCircle, Share2, Send, MoreHorizontal } from 'lucide-react';

interface LinkedInPreviewProps {
    hook: string;
    caption: string;
    cta?: string;
    hashtags?: string[];
    authorName?: string;
    authorAvatar?: string;
    onClose: () => void;
}

export default function LinkedInPreview({
    hook,
    caption,
    cta,
    hashtags = [],
    authorName = 'You',
    authorAvatar,
    onClose,
}: LinkedInPreviewProps) {
    const [expanded, setExpanded] = useState(false);
    const fullText = [caption, cta, hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')]
        .filter(Boolean)
        .join('\n\n');
    const lines = fullText.split('\n');
    const collapsed = lines.slice(0, 4).join('\n');
    const shouldCollapse = lines.length > 4;

    const initials = authorName
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between bg-white rounded-t-2xl px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-blue-600" />
                        <h2 className="text-base font-bold text-gray-900">LinkedIn Preview</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* LinkedIn Card */}
                <div className="bg-[#F3F2EF] px-4 py-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-[500px] mx-auto">
                        {/* Author Row */}
                        <div className="flex items-start gap-3 p-4 pb-2">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {authorAvatar ? (
                                    <img src={authorAvatar} className="h-12 w-12 rounded-full object-cover" alt={authorName} />
                                ) : (
                                    initials
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 leading-tight">{authorName}</p>
                                <p className="text-xs text-gray-500">LinkedIn Creator · 1st</p>
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                    Just now · 🌐
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="px-3 py-1 rounded-full border border-blue-600 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors">
                                    + Follow
                                </button>
                                <button className="p-1 text-gray-400 hover:text-gray-600">
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Hook */}
                        <div className="px-4 pt-2 pb-1">
                            <p className="text-sm font-bold text-gray-900 uppercase tracking-wide leading-snug">
                                {hook}
                            </p>
                        </div>

                        {/* Caption */}
                        <div className="px-4 pb-3">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                {expanded ? fullText : collapsed}
                            </p>
                            {shouldCollapse && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="text-xs text-gray-500 font-semibold mt-1 hover:underline"
                                >
                                    {expanded ? '…see less' : '…see more'}
                                </button>
                            )}
                        </div>

                        {/* Engagement Bar */}
                        <div className="border-t border-gray-100 px-4 py-1">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                <div className="flex items-center gap-1">
                                    <span>👍 ❤️ 💡</span>
                                    <span>47 reactions</span>
                                </div>
                                <span>12 comments · 5 reposts</span>
                            </div>
                            <div className="flex items-center justify-around border-t border-gray-100 pt-1">
                                {[
                                    { icon: ThumbsUp, label: 'Like' },
                                    { icon: MessageCircle, label: 'Comment' },
                                    { icon: Share2, label: 'Repost' },
                                    { icon: Send, label: 'Send' },
                                ].map(({ icon: Icon, label }) => (
                                    <button
                                        key={label}
                                        className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs text-gray-600 font-semibold hover:bg-gray-100 transition-colors"
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-4">
                        This is a simulated preview. Actual appearance may vary.
                    </p>
                </div>
            </div>
        </div>
    );
}
