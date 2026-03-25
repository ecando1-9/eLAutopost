'use client';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
                <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
                <p className="mt-2 text-sm text-slate-600">
                    We hit an unexpected error while loading this page.
                </p>
                <p className="mt-2 text-xs text-red-700 break-words">
                    {error?.message || 'Unknown error'}
                </p>
                <button
                    type="button"
                    onClick={() => reset()}
                    className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                    Try Again
                </button>
            </div>
        </main>
    );
}

