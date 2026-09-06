'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
})

// MUHIM (FOUC tuzatish): endi SERVER o'zi `app/layout.tsx`da cookie'dan
// o'qib, to'g'ri `data-theme` bilan HTML'ni chiqaradi -- shuning uchun
// bu Provider'ning boshlang'ich qiymati `initialTheme` prop orqali
// SERVER'da hisoblangan qiymatdan olinadi (localStorage'dan emas, u
// faqat brauzerda mavjud). Shu tufayli birinchi renderda hech qanday
// "oq keyin ko'k" sakrashi bo'lmaydi -- server va client boshidanoq
// bir xil (to'g'ri) temani ko'rsatadi.
export function ThemeProvider({
  children,
  initialTheme = 'light',
}: {
  children: React.ReactNode
  initialTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ielts-theme', theme)
    // Keyingi tashriflarda SERVER ham to'g'ri temani bilishi uchun
    // cookie'ga ham yozamiz (localStorage serverga ko'rinmaydi).
    document.cookie = `ielts-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`
  }, [theme])

  const setTheme = (t: Theme) => setThemeState(t)

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
