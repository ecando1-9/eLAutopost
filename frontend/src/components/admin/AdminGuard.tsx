'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { adminService } from '@/services/admin';
import { Loader2 } from 'lucide-react';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const supabase = createClientComponentClient();

    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.push('/login');
                    return;
                }

                // Verify admin role with backend
                await adminService.getCurrentAdmin();
                setIsLoading(false);
            } catch (error) {
                console.error('Admin check failed:', error);
                router.push('/'); // Redirect to home if not admin
            }
        };

        checkAdmin();
    }, [router, supabase]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600 font-medium">Verifying admin access...</p>
            </div>
        );
    }

    return <>{children}</>;
}
