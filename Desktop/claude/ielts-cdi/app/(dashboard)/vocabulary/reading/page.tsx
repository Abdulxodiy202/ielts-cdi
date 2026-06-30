'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, ChevronLeft, Pencil } from 'lucide-react'

/* ── Types ────────────────────────────────────────────────────────── */
interface Word {
  id: string
  word: string
  uzbek_translation: string
  english_definition: string
  example_sentence: string
  category: string
  level: string
}

/* ── Config ───────────────────────────────────────────────────────── */
const PAGE_SIZE = 30

const CEFR_ORDER: Record<string, number> = { A2: 1, B1: 2, B2: 3, C1: 4 }

const LVL_COLORS: Record<string, { bg: string; color: string }> = {
  A2: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  B1: { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
  B2: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  C1: { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
}

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  'Science':     { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  'Environment': { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
  'Health':      { bg: 'rgba(20,184,166,0.1)',  color: '#14b8a6' },
  'Technology':  { bg: 'rgba(99,102,241,0.1)',  color: '#6366f1' },
  'Education':   { bg: 'rgba(139,92,246,0.1)',  color: '#8b5cf6' },
  'Business':    { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  'Society':     { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
  'History':     { bg: 'rgba(180,83,9,0.12)',   color: '#b45309' },
  'Culture':     { bg: 'rgba(236,72,153,0.1)',  color: '#ec4899' },
  'Geography':   { bg: 'rgba(6,182,212,0.1)',   color: '#06b6d4' },
  'Psychology':  { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa' },
}

const LEVELS     = ['Barchasi', 'A2', 'B1', 'B2', 'C1']
const CATEGORIES = [
  'Barchasi', 'Science', 'Environment', 'Health', 'Technology',
  'Education', 'Business', 'Society', 'History', 'Culture', 'Geography', 'Psychology',
]

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
export default function ReadingVocabPage() {
  const router = useRouter()
  const [words,    setWords]    = useState<Word[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)
  const [levelTab, setLevelTab] = useState('Barchasi')
  const [catTab,   setCatTab]   = useState('Barchasi')
  const [notes,      setNotes]      = useState<Record<string, string>>({})
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saved' | 'saving' | 'idle'>>({})
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/vocabulary/reading').then(r => r.ok ? r.json() : { words: [], savedIds: [] }),
      fetch('/api/vocabulary/notes?word_type=reading_vocab').then(r => r.ok ? r.json() : { notes: [] }),
    ]).then(([d, n]) => {
      const raw: Word[] = Array.isArray(d) ? d : (d.words ?? [])
      raw.sort((a, b) => (CEFR_ORDER[a.level] ?? 9) - (CEFR_ORDER[b.level] ?? 9))
      setWords(raw)
      setSavedIds(Array.isArray(d.savedIds) ? d.savedIds : [])
      const map: Record<string, string> = {}
      ;(n.notes ?? []).forEach((item: { word_id: string; note: string }) => { map[item.word_id] = item.note })
      setNotes(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  /* Reset pagination when filter changes */
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [levelTab, catTab])

  const toggleSave = async (wordId: string) => {
    const wasSaved = savedIds.includes(wordId)
    setSavedIds(prev => wasSaved ? prev.filter(id => id !== wordId) : [...prev, wordId])
    try {
      const res = await fetch('/api/vocabulary/reading/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: wordId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { saved } = await res.json()
      setSavedIds(prev => saved ? [...prev.filter(id => id !== wordId), wordId] : prev.filter(id => id !== wordId))
    } catch (err) {
      console.error('[reading] toggleSave error:', err)
      setSavedIds(prev => wasSaved ? [...prev, wordId] : prev.filter(id => id !== wordId))
    }
  }

  const handleNoteChange = (wordId: string, value: string) => {
    setNotes(prev => ({ ...prev, [wordId]: value }))
    if (saveTimers.current[wordId]) clearTimeout(saveTimers.current[wordId])
    saveTimers.current[wordId] = setTimeout(async () => {
      setSaveStatus(prev => ({ ...prev, [wordId]: 'saving' }))
      try {
        await fetch('/api/vocabulary/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word_id: wordId, word_type: 'reading_vocab', note: value }),
        })
        setSaveStatus(prev => ({ ...prev, [wordId]: 'saved' }))
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [wordId]: 'idle' })), 2000)
      } catch {
        setSaveStatus(prev => ({ ...prev, [wordId]: 'idle' }))
      }
    }, 800)
  }

  const isSavedTab = levelTab === 'saved'

  const filtered = useMemo(() => {
    let list = words
    if (isSavedTab) return list.filter(w => savedIds.includes(w.id))
    if (levelTab !== 'Barchasi') list = list.filter(w => w.level === levelTab)
    if (catTab   !== 'Barchasi') list = list.filter(w => w.category === catTab)
    return list
  }, [words, savedIds, isSavedTab, levelTab, catTab])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  /* Level counts */
  const lvlCounts = useMemo(() => {
    const c: Record<string, number> = {}
    words.forEach(w => { c[w.level] = (c[w.level] ?? 0) + 1 })
    return c
  }, [words])

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">

      {/* ── Header ─── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Lug&apos;at</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Reading Vocabulary</span>
        </div>
        <button onClick={() => router.push('/vocabulary')}
          className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={16} /> Lug&apos;at ga qaytish
        </button>

        <div className="flex items-start gap-4 mb-5">
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>📖</div>
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Reading Vocabulary</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>IELTS Reading testlaridan akademik so&apos;zlar</p>
          </div>
        </div>

        {/* Stat bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Jami: <strong style={{ color: 'var(--text-primary)' }}>{words.length}</strong> so&apos;z
          </span>
          {(['A2', 'B1', 'B2', 'C1'] as const).map(lvl => {
            const n = lvlCounts[lvl] ?? 0
            if (!n) return null
            const c = LVL_COLORS[lvl]
            return (
              <span key={lvl} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: c.bg, color: c.color }}>
                {lvl}: {n}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Row 1: Level + Saqlangan ─── */}
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
        <button onClick={() => setLevelTab('saved')}
          className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5"
          style={{
            background: isSavedTab ? 'rgba(239,68,68,0.1)' : 'var(--bg-secondary)',
            color:      isSavedTab ? '#ef4444' : 'var(--text-secondary)',
            border:     isSavedTab ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)',
          }}>
          <Heart size={11} fill={isSavedTab ? '#ef4444' : 'none'} />
          Saqlangan{savedIds.length > 0 ? ` (${savedIds.length})` : ''}
        </button>
      </div>

      {/* ── Row 2: Category filter ─── */}
      {!isSavedTab && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {CATEGORIES.map(cat => {
            const cc     = cat !== 'Barchasi' ? CAT_COLORS[cat] : null
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
      )}
      {isSavedTab && <div className="mb-6" />}

      {/* ── Filter result count ─── */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} ta so&apos;z topildi
          {visibleCount < filtered.length && ` · ${visible.length} ta ko'rsatilmoqda`}
        </p>
      )}

      {/* ── Word cards ─── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 130 }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">{isSavedTab ? '❤️' : '🔍'}</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {isSavedTab
              ? "Hali saqlangan so'zlar yo'q — yurak tugmasini bosing"
              : words.length === 0 ? "Hali so'zlar qo'shilmagan" : "Bu filtrlarga mos so'z topilmadi"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visible.map(w => {
              const cc      = CAT_COLORS[w.category] ?? { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
              const lc      = LVL_COLORS[w.level]    ?? { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
              const isSaved = savedIds.includes(w.id)
              return (
                <div key={w.id} className="rounded-2xl p-5 transition-all hover:shadow-md"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-bold" style={{ fontSize: 17, color: 'var(--text-primary)' }}>{w.word}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cc.bg, color: cc.color }}>{w.category}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: lc.bg, color: lc.color }}>{w.level}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setOpenNoteId(openNoteId === w.id ? null : w.id)}
                        className="relative w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110"
                        style={{
                          background: notes[w.id] ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                        }}>
                        <Pencil size={13} style={{ color: notes[w.id] ? 'var(--accent)' : 'var(--text-muted)', transition: 'color .15s' }} />
                        {notes[w.id] && (
                          <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                        )}
                      </button>
                      <button onClick={() => toggleSave(w.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110"
                        style={{ background: isSaved ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <Heart size={15}
                          fill={isSaved ? '#ef4444' : 'none'}
                          style={{ color: isSaved ? '#ef4444' : 'var(--text-muted)', transition: 'color .15s, fill .15s' }} />
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2 mb-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-muted)' }}>O&apos;zbekcha</span>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{w.uzbek_translation}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-muted)' }}>Ta&apos;rif</span>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{w.english_definition}</span>
                    </div>
                  </div>

                  <div style={{ borderLeft: `3px solid ${cc.color}`, paddingLeft: 12, paddingTop: 4, paddingBottom: 4 }}>
                    <span className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-muted)' }}>Misol</span>
                    <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                      &ldquo;<HighlightedSentence sentence={w.example_sentence} word={w.word} />&rdquo;
                    </p>
                  </div>

                  {/* Note accordion */}
                  <div style={{ overflow: 'hidden', maxHeight: openNoteId === w.id ? 260 : 0, transition: 'max-height 0.25s ease' }}>
                    <div style={{ borderTop: '1px dashed var(--border)', marginTop: 12, paddingTop: 10 }}>
                      <textarea
                        value={notes[w.id] ?? ''}
                        onChange={e => handleNoteChange(w.id, e.target.value)}
                        onInput={e => {
                          const el = e.currentTarget
                          el.style.height = 'auto'
                          el.style.height = Math.min(el.scrollHeight, 200) + 'px'
                        }}
                        placeholder="Bu so'z haqida eslatma yozing..."
                        rows={3}
                        style={{
                          width: '100%', minHeight: 80, maxHeight: 200,
                          background: 'transparent', border: 'none', outline: 'none',
                          resize: 'none', fontSize: 13, lineHeight: 1.6,
                          color: 'var(--text-secondary)', fontFamily: 'inherit',
                        }}
                      />
                      <div className="flex items-center justify-between" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        <button onClick={() => setOpenNoteId(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}>
                          × Yopish
                        </button>
                        <span style={{ color: saveStatus[w.id] === 'saved' ? '#22c55e' : 'var(--text-muted)' }}>
                          {saveStatus[w.id] === 'saving' ? 'Saqlanmoqda...' : saveStatus[w.id] === 'saved' ? '✓ Saqlandi' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Load more ─── */}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 mt-8">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                Ko&apos;proq yuklash ({filtered.length - visibleCount} ta qoldi)
              </button>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {visible.length} / {filtered.length}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
