import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { SidebarProvider } from '@/contexts/SidebarContext'

// Sahifa hydrate bo'lishidan OLDIN (beforeInteractive) data-theme
// atributini qo'yib qo'yadi, shunda birinchi render'da qorong'i temadan
// (default :root qiymatlari) yorug' "Ocean Blue" temaga sakrash (FOUC)
// bo'lmaydi. ThemeProvider'dagi useEffect keyinroq shu bilan sync bo'ladi.
const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('ielts-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`

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
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT_SCRIPT}</Script>
      </head>
      <body className={inter.className}>
        <LanguageProvider>
          <ThemeProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
