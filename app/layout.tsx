import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { SidebarProvider } from '@/contexts/SidebarContext'

// Sahifa hydrate bo'lishidan OLDIN data-theme atributini qo'yib qo'yadi,
// shunda foydalanuvchi avval "dark" temani tanlagan bo'lsa, birinchi
// render'da default OQ ("Ocean Blue") fondan ko'k/to'q temaga bir lahza
// "yalt etib" o'tish (FOUC) bo'lmaydi. ThemeProvider'dagi useEffect
// keyinroq shu bilan sync bo'ladi.
//
// MUHIM: bu ATAYLAB oddiy `<script>` (next/script'ning `Script`
// komponenti EMAS) -- brauzer buni HTML'ni parslashda duch kelgan
// zahoti, hech qanday kechikishsiz, SINXRON tarzda ishga tushiradi va
// undan keyingi <body> render qilinishidan OLDIN to'xtatib turadi.
// `next/script`'ning `beforeInteractive` strategiyasi "hydratsiyadan
// oldin" kafolatlaydi, lekin amalda ba'zan <body> allaqachon (default
// OQ tema bilan) chizib ulgurgandan KEYIN ishga tushishi mumkin edi --
// aynan shu "oq tez ko'k bo'lib qolish" muammosining sababi shu edi.
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
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
