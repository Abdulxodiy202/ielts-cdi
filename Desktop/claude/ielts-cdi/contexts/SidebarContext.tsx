'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Sidebar collapsed holatini bir joyda saqlaydigan kontekst.
// Holat localStorage'da yashaydi -- F5'dan keyin ham eslab qoladi.
// Sidebar o'zi `--sidebar-width` CSS varni yozgani uchun main-content
// margin'i o'z-o'zidan harakatlantiriladi (globals.css'da transition
// tayyor). Iste'molchilar odatda faqat toggle tugmasi uchun ishlatadi.

const COLLAPSED_KEY = 'sidebar-collapsed'

interface SidebarCtx {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarCtx>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)

  // Sinxronlash: F5'dan keyin oldingi qiymatni tiklaydi. Client-only,
  // shuning uchun boshlang'ich render doim `false` bilan boshlanadi ---
  // gidratsion mismatch chiqmaydi.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(COLLAPSED_KEY) : null
    if (saved === 'true') setCollapsedState(true)
  }, [])

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v)
    if (typeof window !== 'undefined') {
      localStorage.setItem(COLLAPSED_KEY, String(v))
    }
  }

  const toggle = () => setCollapsed(!collapsed)

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarCtx {
  return useContext(SidebarContext)
}
