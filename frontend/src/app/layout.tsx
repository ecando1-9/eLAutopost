import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'LinkedIn Content Automation',
    description: 'AI-powered content generation for LinkedIn',
}

import { Toaster } from 'react-hot-toast'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Toaster position="top-right" />
                {children}
            </body>
        </html>
    )
}
