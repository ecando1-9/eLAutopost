export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-slate-50 py-12">
            <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
                <p className="mt-3 text-sm text-slate-700">
                    We store only the data required to deliver core features: account profile,
                    settings, generated content, scheduling metadata, and LinkedIn OAuth tokens.
                </p>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    <li>LinkedIn tokens are stored server-side and never exposed in the frontend.</li>
                    <li>User-generated posts and settings are scoped by user id.</li>
                    <li>Admin actions are logged for audit and security review.</li>
                </ul>
                <p className="mt-4 text-sm text-slate-700">
                    Contact support to request account data review or deletion.
                </p>
            </div>
        </main>
    );
}

