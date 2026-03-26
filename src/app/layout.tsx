import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Monitor CETEL — GCM',
  description: 'Monitor de Vagas DEAC — CETEL',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Monitor CETEL' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
