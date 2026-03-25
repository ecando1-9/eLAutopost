'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body className="bg-slate-50">
                <main className="min-h-screen flex items-center justify-center p-6">
                    <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
                        <h1 className="text-lg font-bold text-slate-900">Critical Application Error</h1>
                        <p className="mt-2 text-sm text-slate-600">
                            Please try refreshing this page.
                        </p>
                        <p className="mt-2 text-xs text-red-700 break-words">
                            {error?.message || 'Unknown error'}
                        </p>
                        <button
                            type="button"
                            onClick={() => reset()}
                            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            Reload
                        </button>
                    </div>
                </main>
            </body>
        </html>
    );
}

