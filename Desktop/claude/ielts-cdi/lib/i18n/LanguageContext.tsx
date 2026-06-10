'use client'

import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react'
import en from '@/messages/en.json'
import uz from '@/messages/uz.json'

export type Lang = 'en' | 'uz'

/* ── Resolve a dotted key, e.g. 'nav.dashboard' ──────────────────────── */
function resolve(obj: Record<string, unknown>, key: string): string {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return key
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : key
}

/* ── Context types ───────────────────────────────────────────────────── */
interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  /** Translate a dotted key with optional variable substitution.
   *  e.g. t('mock.upcomingSessions', { count: 3 }) */
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LangCtx>({
  lang: 'uz',
  setLang: () => {},
  t: (key) => key,
})

/* ── Provider ────────────────────────────────────────────────────────── */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('uz')

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang | null
    if (stored === 'en' || stored === 'uz') {
      setLangState(stored)
    } else {
      // Detect browser language: uz or ru → Uzbek, otherwise English
      const bl = navigator.language.toLowerCase()
      setLangState(bl.startsWith('uz') || bl.startsWith('ru') ? 'uz' : 'en')
    }
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const msgs = lang === 'en' ? en : uz
      let result = resolve(msgs as unknown as Record<string, unknown>, key)
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return result
    },
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

/* ── Hook ────────────────────────────────────────────────────────────── */
export function useLanguage(): LangCtx {
  return useContext(LanguageContext)
}
