'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, X, Sparkles, BookOpen, AlertTriangle, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Collection { id: string; name: string; created_at: string }
interface Word {
  id: string
  collection_id: string
  word: string
  uzbek_translation: string | null
  definition: string | null
  example: string | null
  extra: Record<string, string> | null
  source: string
  created_at: string
}

const SETUP_SQL = `create table if not exists public.vocab_collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
alter table public.vocab_collections enable row level security;
create policy "vocab_collections_all" on public.vocab_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.vocab_words (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  collection_id uuid references public.vocab_collections(id) on delete cascade not null,
  word text not null,
  uzbek_translation text,
  definition text,
  example text,
  extra jsonb,
  source text default 'manual',
  created_at timestamptz default now()
);
alter table public.vocab_words enable row level security;
create policy "vocab_words_all" on public.vocab_words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`

const EMPTY_MANUAL = { word: '', uzbek: '', definition: '', example: '' }

export default function LibraryPage() {
  const { t } = useLanguage()

  const [collections, setCollections]     = useState<Collection[]>([])
  const [words, setWords]                 = useState<Word[]>([])
  const [loading, setLoading]             = useState(true)
  const [dbMissing, setDbMissing]         = useState(false)
  const [expanded, setExpanded]           = useState<string | null>(null)
  const [newName, setNewName]             = useState('')
  const [creating, setCreating]           = useState(false)
  const [createError, setCreateError]     = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Manual word form
  const [showManual, setShowManual]       = useState(false)
  const [manual, setManual]               = useState(EMPTY_MANUAL)
  const [addingManual, setAddingManual]   = useState(false)
  const [manualError, setManualError]     = useState<string | null>(null)

  // AI generator
  const [wordInput, setWordInput]         = useState('')
  const [targetCol, setTargetCol]         = useState<string | null>(null)
  const [generating, setGenerating]       = useState(false)
  const [generated, setGenerated]         = useState<Record<string, string> | null>(null)
  const [genError, setGenError]           = useState<string | null>(null)
  const [genNoKey, setGenNoKey]           = useState(false)
  const [saving, setSaving]               = useState(false)
  const [copiedSql, setCopiedSql]         = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setDbMissing(false)
    const [colRes, wordRes] = await Promise.all([
      fetch('/api/vocab/collections'),
      fetch('/api/vocab/words'),
    ])
    if (colRes.status === 503) { setDbMissing(true); setLoading(false); return }
    const cols = colRes.ok  ? await colRes.json()  : []
    const ws   = wordRes.ok ? await wordRes.json() : []
    setCollections(Array.isArray(cols) ? cols : [])
    setWords(Array.isArray(ws) ? ws : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (collections.length > 0 && !expanded) setExpanded(collections[0].id)
  }, [collections.length])

  // Reset manual form when switching collections
  useEffect(() => { setManual(EMPTY_MANUAL); setManualError(null); setShowManual(false) }, [expanded])

  async function createCollection() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)
    const res = await fetch('/api/vocab/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const col = await res.json()
      setCollections(prev => [...prev, col])
      setExpanded(col.id)
      setNewName('')
    } else {
      const d = await res.json().catch(() => ({}))
      if (d.error === 'TABLE_NOT_FOUND' || res.status === 503) {
        setDbMissing(true)
      } else {
        setCreateError(d.error ?? `Error ${res.status}`)
      }
    }
    setCreating(false)
  }

  async function deleteCollection(id: string) {
    const res = await fetch(`/api/vocab/collections/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCollections(prev => prev.filter(c => c.id !== id))
      setWords(prev => prev.filter(w => w.collection_id !== id))
      if (expanded === id) setExpanded(null)
    }
    setDeleteConfirm(null)
  }

  async function deleteWord(id: string) {
    const res = await fetch(`/api/vocab/words/${id}`, { method: 'DELETE' })
    if (res.ok) setWords(prev => prev.filter(w => w.id !== id))
  }

  async function addManualWord() {
    if (!manual.word.trim() || !manual.uzbek.trim() || !expanded) return
    setAddingManual(true)
    setManualError(null)
    const res = await fetch('/api/vocab/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection_id: expanded,
        word: manual.word.trim(),
        uzbek_translation: manual.uzbek.trim(),
        definition: manual.definition.trim() || null,
        example: manual.example.trim() || null,
        source: 'manual',
      }),
    })
    if (res.ok) {
      const w = await res.json()
      setWords(prev => [w, ...prev])
      setManual(EMPTY_MANUAL)
      setShowManual(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setManualError(d.error ?? 'Xatolik yuz berdi')
    }
    setAddingManual(false)
  }

  async function generateWord() {
    if (!wordInput.trim()) return
    setGenerating(true)
    setGenerated(null)
    setGenError(null)
    setGenNoKey(false)
    const res = await fetch('/api/vocab/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: wordInput.trim() }),
    })
    if (res.ok) {
      setGenerated(await res.json())
    } else {
      const d = await res.json().catch(() => ({}))
      if (d.error === 'NO_API_KEY' || res.status === 503) {
        setGenNoKey(true)
      } else {
        setGenError(d.error ?? 'Generation failed')
      }
    }
    setGenerating(false)
  }

  async function saveGeneratedWord() {
    if (!generated || !targetCol) return
    setSaving(true)
    const res = await fetch('/api/vocab/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection_id: targetCol,
        word: generated.word,
        uzbek_translation: generated.uzbek_translation,
        definition: generated.definition,
        example: generated.example,
        extra: generated.collocations ? { collocations: generated.collocations } : null,
        source: 'ai_generated',
      }),
    })
    if (res.ok) {
      const w = await res.json()
      setWords(prev => [w, ...prev])
      setGenerated(null)
      setWordInput('')
      setExpanded(targetCol)
    }
    setSaving(false)
  }

  function copySQL() {
    navigator.clipboard.writeText(SETUP_SQL)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (dbMissing) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            <Link href="/vocabulary" className="hover:underline">{t('vocabulary.title')}</Link>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.library')}</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>📖 {t('vocabulary.library')}</h1>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <div className="flex items-center gap-2 font-semibold mb-2" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={18} /> {t('vocabulary.tableMissing')}
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.tableMissingDesc')}</p>
          <pre className="text-xs p-4 rounded-lg overflow-x-auto mb-3"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            {SETUP_SQL}
          </pre>
          <div className="flex gap-2">
            <button onClick={copySQL} className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: 'var(--accent)', color: 'white' }}>
              {copiedSql ? <><Check size={14} /> {t('vocabulary.copied')}</> : <><Copy size={14} /> {t('vocabulary.copySql')}</>}
            </button>
            <button onClick={loadAll} className="text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              {t('vocabulary.retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const activeCol = collections.find(c => c.id === expanded)
  const colWords  = words.filter(w => w.collection_id === expanded)

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">{t('vocabulary.title')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.library')}</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>📖 {t('vocabulary.library')}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.libraryDesc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Collections list ── */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            {t('vocabulary.collections')} ({collections.length})
          </h2>

          {/* Create new collection */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value); setCreateError(null) }}
              onKeyDown={e => e.key === 'Enter' && createCollection()}
              placeholder={t('vocabulary.newCollection')}
              className="input-field text-sm flex-1 py-2"
            />
            <button onClick={createCollection} disabled={creating || !newName.trim()}
              className="btn-primary px-3 py-2 disabled:opacity-50">
              {creating
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Plus size={16} />}
            </button>
          </div>

          {createError && (
            <p className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {createError}
            </p>
          )}

          {collections.length === 0 ? (
            <div className="py-8 text-center rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <BookOpen size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('vocabulary.noCollections')}<br />{t('vocabulary.createOne')}</p>
            </div>
          ) : (
            collections.map(col => {
              const wc = words.filter(w => w.collection_id === col.id).length
              const isExp = expanded === col.id
              return (
                <div key={col.id}>
                  <button
                    onClick={() => setExpanded(isExp ? null : col.id)}
                    className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                    style={{
                      background: isExp ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                      border: `1px solid ${isExp ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>📁</span>
                      <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                      <span className="text-xs shrink-0 px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                        {wc}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {deleteConfirm === col.id ? (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => deleteCollection(col.id)}
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ background: 'var(--error)', color: 'white' }}>
                            {t('vocabulary.delete')}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ color: 'var(--text-muted)' }}>
                            {t('vocabulary.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setDeleteConfirm(col.id) }}
                          className="p-1 rounded" style={{ color: 'var(--error)' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                      {isExp ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* ── Right: Word list + forms ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* AI Word Generator */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <Sparkles size={15} /> {t('vocabulary.aiGenerator')}
            </h2>

            {genNoKey ? (
              <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>⚙️ API Key sozlanmagan</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.aiKeyMissing')}</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={wordInput}
                    onChange={e => { setWordInput(e.target.value); setGenerated(null); setGenError(null) }}
                    onKeyDown={e => e.key === 'Enter' && generateWord()}
                    placeholder={t('vocabulary.enterWord')}
                    className="input-field text-sm flex-1 py-2"
                  />
                  <button onClick={generateWord} disabled={generating || !wordInput.trim()}
                    className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50">
                    {generating
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Sparkles size={14} />}
                    {generating ? t('vocabulary.generating') : t('vocabulary.generate')}
                  </button>
                </div>

                {genError && (
                  <p className="text-sm py-2 px-3 rounded-lg mb-2"
                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {genError}
                  </p>
                )}

                {generated && (
                  <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p className="font-bold text-lg" style={{ color: 'var(--accent)' }}>{generated.word}</p>
                    <p className="text-sm">
                      <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.translation')}: </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{generated.uzbek_translation}</span>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.definition')}: </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{generated.definition}</span>
                    </p>
                    <p className="text-sm italic">
                      <span className="not-italic font-medium" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.example')}: </span>
                      <span style={{ color: 'var(--text-muted)' }}>"{generated.example}"</span>
                    </p>
                    {generated.collocations && (
                      <p className="text-sm">
                        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.collocations')}: </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{generated.collocations}</span>
                      </p>
                    )}
                    <div className="pt-2 flex items-center gap-2">
                      <select value={targetCol ?? ''} onChange={e => setTargetCol(e.target.value)}
                        className="input-field text-sm py-1.5 flex-1">
                        <option value="">{t('vocabulary.chooseCollection')}</option>
                        {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button onClick={saveGeneratedWord} disabled={saving || !targetCol}
                        className="btn-primary text-sm px-3 py-1.5 disabled:opacity-50">
                        {saving ? t('vocabulary.saving') : t('vocabulary.save')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Collection word list */}
          {activeCol ? (
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
                📁 {activeCol.name} — {t('vocabulary.wordCount').replace('{count}', String(colWords.length))}
              </h2>

              {/* ── Manual add form ── */}
              <div className="mb-3 rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <button
                  onClick={() => { setShowManual(v => !v); setManualError(null) }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  <span className="flex items-center gap-2">
                    <Plus size={15} /> {t('vocabulary.addWord')}
                  </span>
                  {showManual ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {showManual && (
                  <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="pt-3 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={manual.word}
                        onChange={e => setManual(p => ({ ...p, word: e.target.value }))}
                        placeholder={t('vocabulary.wordEn')}
                        className="input-field text-sm py-2"
                      />
                      <input
                        type="text"
                        value={manual.uzbek}
                        onChange={e => setManual(p => ({ ...p, uzbek: e.target.value }))}
                        placeholder={t('vocabulary.wordUz')}
                        className="input-field text-sm py-2"
                      />
                    </div>
                    <input
                      type="text"
                      value={manual.definition}
                      onChange={e => setManual(p => ({ ...p, definition: e.target.value }))}
                      placeholder={t('vocabulary.wordDef')}
                      className="input-field w-full text-sm py-2"
                    />
                    <input
                      type="text"
                      value={manual.example}
                      onChange={e => setManual(p => ({ ...p, example: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addManualWord()}
                      placeholder={t('vocabulary.wordEx')}
                      className="input-field w-full text-sm py-2"
                    />
                    {manualError && (
                      <p className="text-xs" style={{ color: 'var(--error)' }}>{manualError}</p>
                    )}
                    <button
                      onClick={addManualWord}
                      disabled={addingManual || !manual.word.trim() || !manual.uzbek.trim()}
                      className="btn-primary text-sm px-4 py-2 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {addingManual
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : null}
                      {t('vocabulary.addWordBtn')}
                    </button>
                  </div>
                )}
              </div>

              {/* Word list */}
              {colWords.length === 0 ? (
                <div className="py-10 text-center rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <p className="text-sm">{t('vocabulary.noWords')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {colWords.map(w => (
                    <div key={w.id} className="rounded-xl px-4 py-3 group flex gap-3"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold" style={{ color: 'var(--accent)' }}>{w.word}</span>
                          {w.uzbek_translation && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w.uzbek_translation}</span>
                          )}
                          {w.source === 'ai_generated' && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                              style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
                              <Sparkles size={9} /> AI
                            </span>
                          )}
                          {w.source === 'irregular_verb' && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                              🔄 verb
                            </span>
                          )}
                        </div>
                        {w.definition && (
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{w.definition}</p>
                        )}
                        {w.example && (
                          <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>"{w.example}"</p>
                        )}
                        {w.extra?.past && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {t('vocabulary.pastSimple')}: <strong>{w.extra.past}</strong> · {t('vocabulary.pastParticiple')}: <strong>{w.extra.participle}</strong>
                          </p>
                        )}
                        {w.extra?.collocations && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {t('vocabulary.collocations')}: {w.extra.collocations}
                          </p>
                        )}
                      </div>
                      <button onClick={() => deleteWord(w.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 self-start shrink-0 transition-opacity"
                        style={{ color: 'var(--error)' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : collections.length > 0 ? (
            <div className="py-10 text-center rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <p className="text-sm">{t('vocabulary.selectCollection')}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
