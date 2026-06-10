import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IELTS Pro — Band 9 Starts Here',
  description: 'IELTS Pro — Uzbekistondagi eng yaxshi IELTS tayyorgarlik platformasi. Reading, Listening, Writing va Mock test.',
  keywords: 'IELTS, IELTS Uzbekistan, IELTS test, IELTS preparation, band 9',
  openGraph: {
    title: 'IELTS Pro',
    description: 'Uzbekistondagi eng yaxshi IELTS tayyorgarlik platformasi',
    url: 'https://ielts-cdi.vercel.app',
    siteName: 'IELTS Pro',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <LanguageProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
