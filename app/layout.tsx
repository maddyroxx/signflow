import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SignFlow — Speak. Sign. Flow.',
  description: 'Indian Sign Language, made accessible. Translate spoken or typed English into verified ISL gloss with a real-time coordinated 3D humanoid avatar.',
  keywords: [
    'Indian Sign Language',
    'ISL',
    'ISL Translator',
    'SignFlow',
    '3D Avatar Signing',
    'Accessibility',
    'Deaf Community',
    'Speech to ISL',
  ],
  authors: [{ name: 'SignFlow Team' }],
  icons: {
    icon: '/icon.svg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#6C4CE8',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
