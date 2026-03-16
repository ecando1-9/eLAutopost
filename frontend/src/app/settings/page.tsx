'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    Settings as SettingsIcon,
    Clock,
    Calendar,
    Globe,
    Zap,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Linkedin
} from 'lucide-react';

export default function SettingsPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Schedule settings
    const [isActive, setIsActive] = useState(false);
    const [daysOfWeek, setDaysOfWeek] = useState<string[]>(['MON', 'WED', 'FRI']);
    const [timeOfDay, setTimeOfDay] = useState('09:00');
    const [timezone, setTimezone] = useState('Asia/Kolkata');
    const [categories, setCategories] = useState<string[]>(['AI']);
    const [autoTopic, setAutoTopic] = useState(true);
    
    // Auth & Integration Info
    const [userId, setUserId] = useState<string | null>(null);
    const [isLinkedInConnected, setIsLinkedInConnected] = useState(false);

    const days = [
        { value: 'MON', label: 'Monday' },
        { value: 'TUE', label: 'Tuesday' },
        { value: 'WED', label: 'Wednesday' },
        { value: 'THU', label: 'Thursday' },
        { value: 'FRI', label: 'Friday' },
        { value: 'SAT', label: 'Saturday' },
        { value: 'SUN', label: 'Sunday' }
    ];

    const availableCategories = ['AI', 'Cybersecurity', 'Tech Updates', 'Tools', 'Career'];

    const timezones = [
        'Asia/Kolkata',
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo',
        'Australia/Sydney'
    ];

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            
            // Get user info to check integrations
            const userResponse = await supabase.auth.getUser();
            if (userResponse.data.user) {
                setUserId(userResponse.data.user.id);
                // Also fetch full profile from our backend to check linkedin_connected
                try {
                    const profileRes = await fetch(`/api/v1/auth/me?user_id=${userResponse.data.user.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        setIsLinkedInConnected(profileData.linkedin_connected);
                    }
                } catch (e) {
                    console.error("Failed to fetch profile", e);
                }
            }

            const response = await fetch('/api/v1/user/schedule', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.schedule) {
                    setIsActive(data.schedule.is_active);
                    setDaysOfWeek(data.schedule.days_of_week);
                    setTimeOfDay(data.schedule.time_of_day);
                    setTimezone(data.schedule.timezone);
                    setCategories(data.schedule.categories || ['AI']);
                    setAutoTopic(data.schedule.auto_topic);
                }
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            const response = await fetch('/api/v1/user/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    days_of_week: daysOfWeek,
                    time_of_day: timeOfDay,
                    timezone,
                    is_active: isActive,
                    categories,
                    auto_topic: autoTopic
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save settings');
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (day: string) => {
        if (daysOfWeek.includes(day)) {
            setDaysOfWeek(daysOfWeek.filter(d => d !== day));
        } else {
            setDaysOfWeek([...daysOfWeek, day]);
        }
    };

    const toggleCategory = (category: string) => {
        if (categories.includes(category)) {
            setCategories(categories.filter(c => c !== category));
        } else {
            setCategories([...categories, category]);
        }
    };

    const handleConnectLinkedIn = () => {
        if (!userId) {
            setError("User not identified. Please wait for settings to finish loading.");
            return;
        }
        // Redirect to Backend LinkedIn OAuth Flow
        window.location.href = `/api/v1/auth/linkedin?user_id=${userId}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-500 mt-2">Configure your automation preferences</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Success/Error Messages */}
                {success && (
                    <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mr-3" />
                        <p className="text-sm text-green-800">Settings saved successfully!</p>
                    </div>
                )}

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {/* Auto-Posting Toggle */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mr-4">
                                <Zap className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Auto-Posting</h2>
                                <p className="text-sm text-gray-500">Automatically post scheduled content</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsActive(!isActive)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Posting Schedule */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Calendar className="h-5 w-5 mr-2 text-gray-600" />
                        Posting Schedule
                    </h2>

                    {/* Days of Week */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Days of Week
                        </label>
                        <div className="grid grid-cols-7 gap-2">
                            {days.map(day => (
                                <button
                                    key={day.value}
                                    onClick={() => toggleDay(day.value)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${daysOfWeek.includes(day.value)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {day.label.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time of Day */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Posting Time
                        </label>
                        <input
                            type="time"
                            value={timeOfDay}
                            onChange={(e) => setTimeOfDay(e.target.value)}
                            className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Posts will be published around this time (±20 minutes for natural variation)
                        </p>
                    </div>

                    {/* Timezone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Globe className="h-4 w-4 inline mr-1" />
                            Timezone
                        </label>
                        <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {timezones.map(tz => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content Preferences */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <SettingsIcon className="h-5 w-5 mr-2 text-gray-600" />
                        Content Preferences
                    </h2>

                    {/* Categories */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Preferred Categories
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {availableCategories.map(category => (
                                <button
                                    key={category}
                                    onClick={() => toggleCategory(category)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${categories.includes(category)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Auto Topic */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-gray-900">Auto Topic Selection</h3>
                            <p className="text-sm text-gray-500">Automatically select trending topics</p>
                        </div>
                        <button
                            onClick={() => setAutoTopic(!autoTopic)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoTopic ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoTopic ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* LinkedIn Connection */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 mb-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <Linkedin className="h-12 w-12 mr-4" />
                            <div>
                                <h2 className="text-lg font-semibold">LinkedIn Account</h2>
                                <p className="text-sm text-blue-100">
                                    {isLinkedInConnected ? "Your LinkedIn account is connected and ready for posting." : "Connect your LinkedIn account to enable posting"}
                                </p>
                            </div>
                        </div>
                        {isLinkedInConnected ? (
                            <button className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold cursor-default flex items-center">
                                <CheckCircle2 className="h-5 w-5 mr-2" /> Connected
                            </button>
                        ) : (
                            <button 
                                onClick={handleConnectLinkedIn}
                                className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                            >
                                Connect LinkedIn
                            </button>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                                Save Settings
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
