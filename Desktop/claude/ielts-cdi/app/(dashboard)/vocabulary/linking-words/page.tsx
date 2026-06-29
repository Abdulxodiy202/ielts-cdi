'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'

/* ── Types ────────────────────────────────────────────────────────── */
interface Word {
  id: string
  word: string
  uzbek_translation: string
  english_definition: string
  example_sentence: string
  category: string
  level: string
  is_saved: boolean
}

/* ── Badge config ─────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  'Addition':    { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
  'Contrast':    { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
  'Cause/Effect':{ bg: 'rgba(139,92,246,0.1)',  color: '#8b5cf6' },
  'Sequence':    { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  'Emphasis':    { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  'Example':     { bg: 'rgba(20,184,166,0.1)',  color: '#14b8a6' },
  'Concession':  { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
}

const LVL_COLORS: Record<string, { bg: string; color: string }> = {
  'beginner':     { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  'elementary':   { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
  'intermediate': { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  'advanced':     { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
}

const LEVELS     = ['Barchasi', 'Beginner', 'Elementary', 'Intermediate', 'Advanced']
const CATEGORIES = ['Barchasi', 'Addition', 'Contrast', 'Cause/Effect', 'Sequence', 'Emphasis', 'Example', 'Concession']

/* ── Highlight word in sentence ──────────────────────────────────── */
function HighlightedSentence({ sentence, word }: { sentence: string; word: string }) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts   = sentence.split(new RegExp(`(${escaped})`, 'i'))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === word.toLowerCase()
          ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{p}</strong>
          : p
      )}
    </>
  )
}

/* ── Main component ───────────────────────────────────────────────── */
export default function LinkingWordsPage() {
  const [words,    setWords]    = useState<Word[]>([])
  const [loading,  setLoading]  = useState(true)
  const [levelTab, setLevelTab] = useState('Barchasi')
  const [catTab,   setCatTab]   = useState('Barchasi')
  const [saving,   setSaving]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/vocabulary/linking-words')
      .then(r => r.json())
      .then(d => { setWords(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => words.filter(w => {
    const lvlOk = levelTab === 'Barchasi' || w.level.toLowerCase() === levelTab.toLowerCase()
    const catOk = catTab   === 'Barchasi' || w.category === catTab
    return lvlOk && catOk
  }), [words, levelTab, catTab])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    words.forEach(w => { c[w.level] = (c[w.level] ?? 0) + 1 })
    return c
  }, [words])

  const toggleSave = async (w: Word) => {
    if (saving === w.id) return
    setSaving(w.id)
    const res = await fetch('/api/vocabulary/linking-words/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_id: w.id }),
    })
    if (res.ok) {
      const { saved } = await res.json()
      setWords(prev => prev.map(x => x.id === w.id ? { ...x, is_saved: saved } : x))
    }
    setSaving(null)
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">

      {/* ── Header ─── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Lug'at</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Linking Words</span>
        </div>

        <div className="flex items-start gap-4 mb-5">
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>🔗</div>
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Linking Words
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              IELTS yozma va og'zaki nutqda bog'lovchi so'zlar
            </p>
          </div>
        </div>

        {/* Stat bar */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-medium px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Jami: <strong style={{ color: 'var(--text-primary)' }}>{words.length}</strong> so'z
          </span>
          {['beginner','elementary','intermediate','advanced'].map(lvl => {
            const n = counts[lvl] ?? 0
            if (!n) return null
            const c = LVL_COLORS[lvl]
            return (
              <span key={lvl} className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                style={{ background: c.bg, color: c.color }}>
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)}: {n}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Level filter tabs ─── */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {LEVELS.map(lv => (
          <button key={lv} onClick={() => setLevelTab(lv)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{
              background: levelTab === lv ? 'var(--accent)' : 'var(--bg-secondary)',
              color:      levelTab === lv ? '#fff' : 'var(--text-secondary)',
              border:     levelTab === lv ? 'none' : '1px solid var(--border)',
            }}>
            {lv}
          </button>
        ))}
      </div>

      {/* ── Category filter tabs ─── */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {CATEGORIES.map(cat => {
          const cc = cat !== 'Barchasi' ? CAT_COLORS[cat] : null
          const active = catTab === cat
          return (
            <button key={cat} onClick={() => setCatTab(cat)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                background: active ? (cc?.bg ?? 'var(--accent)') : 'var(--bg-secondary)',
                color:      active ? (cc?.color ?? '#fff') : 'var(--text-muted)',
                border:     active ? `1px solid ${cc?.color ?? 'var(--accent)'}` : '1px solid var(--border)',
              }}>
              {cat}
            </button>
          )
        })}
      </div>

      {/* ── Word cards ─── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 130 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {words.length === 0 ? 'Hali so\'zlar qo\'shilmagan' : 'Bu filtrlarga mos so\'z topilmadi'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(w => {
            const cc = CAT_COLORS[w.category] ?? { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
            const lc = LVL_COLORS[w.level] ?? { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
            return (
              <div key={w.id} className="rounded-2xl p-5 transition-all hover:shadow-md"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-bold" style={{ fontSize: 17, color: 'var(--text-primary)' }}>
                      {w.word}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: cc.bg, color: cc.color }}>
                      {w.category}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{ background: lc.bg, color: lc.color }}>
                      {w.level}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleSave(w)}
                    disabled={saving === w.id}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 disabled:opacity-50"
                    style={{ background: w.is_saved ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <Heart size={15}
                      fill={w.is_saved ? '#ef4444' : 'none'}
                      style={{ color: w.is_saved ? '#ef4444' : 'var(--text-muted)', transition: 'all .2s' }} />
                  </button>
                </div>

                {/* Translations / definition */}
                <div className="grid sm:grid-cols-2 gap-2 mb-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                      style={{ color: 'var(--text-muted)' }}>O'zbekcha</span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{w.uzbek_translation}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                      style={{ color: 'var(--text-muted)' }}>Ta'rif</span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{w.english_definition}</span>
                  </div>
                </div>

                {/* Example sentence */}
                <div style={{
                  borderLeft: `3px solid ${cc.color}`,
                  paddingLeft: 12, paddingTop: 4, paddingBottom: 4,
                }}>
                  <span className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: 'var(--text-muted)' }}>Misol</span>
                  <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                    "<HighlightedSentence sentence={w.example_sentence} word={w.word} />"
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
