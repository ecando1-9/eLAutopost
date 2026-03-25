export default function CookiesPolicyPage() {
    return (
        <main className="min-h-screen bg-slate-50 py-12">
            <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900">Cookie Policy</h1>
                <p className="mt-3 text-sm text-slate-700">
                    eLAutopost uses cookies and similar storage for authentication, security, and
                    product analytics. Essential cookies are required to keep your account signed in.
                </p>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    <li>Essential cookies: login session, security, API protection.</li>
                    <li>Preference storage: remembers UI selections and automation defaults.</li>
                    <li>Analytics cookies: helps us improve app quality and performance.</li>
                </ul>
                <p className="mt-4 text-sm text-slate-700">
                    You can clear browser storage at any time. Rejecting non-essential cookies does
                    not disable core account functionality.
                </p>
            </div>
        </main>
    );
}

