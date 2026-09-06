import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { SidebarProvider } from '@/contexts/SidebarContext'

// MUHIM (FOUC -- "oq keyin ko'k" muammosining ILDIZIDAN tuzatilishi):
// avval tema faqat brauzerdagi localStorage'da saqlanardi, va uni JS
// (hatto eng tez skript bilan ham) hydratsiyadan OLDIN o'qib bo'lmasdi
// -- chunki SERVER umuman localStorage'ni ko'ra olmaydi. Natijada
// SERVER doim standart (OQ) temani chiqarardi, va faqat brauzerda JS
// ishga tushgach ko'k temaga "sakrardi" -- xoh script sinxron bo'lsin.
//
// ENDI tema COOKIE'ga HAM yoziladi (ThemeProvider'da). Cookie -- server
// HAM o'qiy oladigan yagona joy. Shuning uchun bu yerda (Server
// Component) cookie'dan tema o'qiladi va <html data-theme="..."> ATTRIBUTI
// TO'G'RIDAN-TO'G'RI SERVER TOMONIDA, birinchi HTML baytidayoq to'g'ri
// qiymat bilan chiqadi. JS umuman kerak emas, kutish yo'q -- demak
// FOUC STRUKTURAVIY jihatdan mumkin emas endi (birinchi marta tashrif
// buyurgan, cookie hali yo'q foydalanuvchi uchun "light" -- bu ham
// to'g'ri, chunki loyiha qoidasiga ko'ra yangi foydalanuvchi uchun
// standart tema OQ bo'lishi kerak).
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('ielts-theme')?.value
  const theme = themeCookie === 'dark' ? 'dark' : 'light'

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body className={inter.className}>
        <LanguageProvider>
          <ThemeProvider initialTheme={theme}>
            <SidebarProvider>{children}</SidebarProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
