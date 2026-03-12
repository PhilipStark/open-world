import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Open World — AI Civilization Simulator',
  description: 'An open-source world where autonomous AI agents live, evolve, and surprise you.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white min-h-screen antialiased">{children}</body>
    </html>
  )
}
