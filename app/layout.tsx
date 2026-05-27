// ============================================
// ROOT LAYOUT — required by Next.js
// Wraps every page in the app
// ============================================

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DentaRecord',
  description: 'Dental clinic management for Ethiopian clinics',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}