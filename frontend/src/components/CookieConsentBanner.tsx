'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'elautopost.cookie-consent.v1';

export default function CookieConsentBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            const existing = localStorage.getItem(CONSENT_KEY);
            if (!existing) {
                setVisible(true);
            }
        } catch {
            setVisible(true);
        }
    }, []);

    const saveConsent = (choice: 'accepted' | 'rejected') => {
        try {
            localStorage.setItem(CONSENT_KEY, JSON.stringify({
                choice,
                at: new Date().toISOString(),
            }));
        } catch {
            // no-op
        }
        setVisible(false);
    };

    if (!visible) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:left-auto sm:max-w-md">
            <p className="text-sm font-semibold text-slate-900">Cookie Preferences</p>
            <p className="mt-1 text-xs text-slate-600">
                We use cookies for login sessions, security, and analytics to improve the product.
                By continuing, you can accept or reject non-essential cookies.
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
                Read our <Link href="/cookies" className="text-sky-700 hover:underline">Cookie Policy</Link> and{' '}
                <Link href="/privacy" className="text-sky-700 hover:underline">Privacy Policy</Link>.
            </p>
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={() => saveConsent('rejected')}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                    Reject
                </button>
                <button
                    type="button"
                    onClick={() => saveConsent('accepted')}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                    Accept
                </button>
            </div>
        </div>
    );
}

