import './globals.css'
import type { Metadata } from 'next'
import { Manrope, Sora } from 'next/font/google'
import CookieConsentBanner from '@/components/CookieConsentBanner';

const manrope = Manrope({
    subsets: ['latin'],
    variable: '--font-sans',
})

const sora = Sora({
    subsets: ['latin'],
    variable: '--font-display',
})

export const metadata: Metadata = {
    title: 'eLAutopost AI',
    description: 'AI-powered LinkedIn content automation platform',
}

import { Toaster } from 'react-hot-toast'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={`${manrope.variable} ${sora.variable} font-sans`}>
                <Toaster position="top-right" />
                {children}
                <CookieConsentBanner />
            </body>
        </html>
    )
}
