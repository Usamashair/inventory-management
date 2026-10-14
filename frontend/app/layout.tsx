import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import ToastHost from '@/components/toast-host'
import './globals.css'

const rexapackFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-rexapack',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Rexapack Portal',
  description: 'Manage Rexapack inventory, quotations, artwork, orders and invoices',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f7f6' },
    { media: '(prefers-color-scheme: dark)', color: '#f4f7f6' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`light ${rexapackFont.variable}`} suppressHydrationWarning>
      <body className={`${rexapackFont.className} antialiased`} suppressHydrationWarning>
        {children}
        <ToastHost />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
