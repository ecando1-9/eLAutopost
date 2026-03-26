'use client';

import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';

const EMOJI_CATEGORIES: Record<string, string[]> = {
    '🔥 Popular': ['🚀', '💡', '🎯', '✅', '⚡', '🙌', '👏', '🤝', '💪', '🔥', '🌟', '✨', '🎉', '💥', '🏆'],
    '😊 Faces': ['😊', '🙂', '😎', '🤔', '😍', '🥳', '😅', '🤗', '😤', '💯'],
    '👍 Gestures': ['👍', '👎', '🤞', '☝️', '✌️', '🖐️', '👋', '🙏', '💪', '🤜'],
    '💼 Business': ['💼', '📊', '📈', '📉', '💰', '🏢', '📝', '🎤', '📣', '🔔'],
    '🌍 World': ['🌍', '🌎', '🌱', '♻️', '🌊', '☀️', '🌙', '⭐', '🌈', '🎪'],
    '❤️ Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💖'],
    '✏️ Marks': ['✅', '❌', '⭕', '❗', '❓', '➡️', '⬆️', '🔴', '🟢', '🟡'],
};

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
    const [open, setOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="p-2 rounded-lg text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 transition-all"
                title="Add emoji"
            >
                <Smile className="h-5 w-5" />
            </button>

            {open && (
                <div className="absolute bottom-10 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 w-72 overflow-hidden">
                    {/* Category Tabs */}
                    <div className="flex overflow-x-auto gap-1 p-2 bg-gray-50 border-b border-gray-100">
                        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategory(cat)}
                                className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                                    activeCategory === cat
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {cat.split(' ')[0]}
                            </button>
                        ))}
                    </div>

                    {/* Emoji Grid */}
                    <div className="p-3 grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                        {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                    onSelect(emoji);
                                    setOpen(false);
                                }}
                                className="text-xl hover:bg-gray-100 rounded-lg p-1 transition-colors leading-none"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
