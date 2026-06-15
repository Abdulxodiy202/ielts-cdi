'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { IRREGULAR_VERBS, type IrregularVerb } from '@/lib/data/irregular-verbs'
import { Search, X, BookPlus, Check, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Collection { id: string; name: string }

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function IrregularVerbsPage() {
  const { t } = useLanguage()

  const [search, setSearch]           = useState('')
  const [letter, setLetter]           = useState<string | null>(null)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [addingVerb, setAddingVerb]   = useState<IrregularVerb | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [colLoading, setColLoading]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    let list = IRREGULAR_VERBS
    if (letter) list = list.filter(v => v.base[0].toUpperCase() === letter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(v =>
        v.base.includes(q) || v.past.includes(q) || v.participle.includes(q) ||
        v.uzbek.toLowerCase().includes(q) || v.definition.toLowerCase().includes(q)
      )
    }
    return list
  }, [search, letter])

  useEffect(() => {
    if (!addingVerb) return
    setColLoading(true)
    fetch('/api/vocab/collections')
      .then(r => r.json())
      .then(d => setCollections(Array.isArray(d) ? d : []))
      .finally(() => setColLoading(false))
  }, [addingVerb])

  useEffect(() => {
    if (!addingVerb) return
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setAddingVerb(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [addingVerb])

  async function addToCollection(collectionId: string) {
    if (!addingVerb) return
    setSaving(true)
    try {
      const res = await fetch('/api/vocab/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_id: collectionId,
          word: addingVerb.base,
          uzbek_translation: addingVerb.uzbek,
          definition: `${addingVerb.definition} | Past: ${addingVerb.past} · Participle: ${addingVerb.participle}`,
          example: addingVerb.example,
          source: 'irregular_verb',
        }),
      })
      if (res.ok) {
        setSaved(addingVerb.id)
        setTimeout(() => { setSaved(null); setAddingVerb(null) }, 1200)
      }
    } finally {
      setSaving(false)
    }
  }

  const activeLetter = letter && ALPHABET.includes(letter) ? letter : null

  const verbCountText = search || activeLetter
    ? `${filtered.length} ${filtered.length === 1 ? t('vocabulary.verbs') : t('vocabulary.verbs')} — "${search || activeLetter}"`
    : `${filtered.length} ${t('vocabulary.verbs')}`

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">{t('vocabulary.title')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.irregularVerbs')}</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          🔄 {t('vocabulary.irregularVerbs')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {IRREGULAR_VERBS.length} {t('vocabulary.verbs')} — {t('vocabulary.irregularVerbsDesc')}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setLetter(null) }}
          placeholder={t('vocabulary.searchVerbs')}
          className="input-field w-full pl-9 pr-10 py-2.5"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Alphabet filter */}
      <div className="flex flex-wrap gap-1 mb-6">
        {ALPHABET.map(l => {
          const hasVerbs = IRREGULAR_VERBS.some(v => v.base[0].toUpperCase() === l)
          return (
            <button
              key={l}
              disabled={!hasVerbs}
              onClick={() => { setLetter(activeLetter === l ? null : l); setSearch('') }}
              className="w-7 h-7 rounded-md text-xs font-bold transition-all"
              style={{
                background: activeLetter === l ? 'var(--accent)' : hasVerbs ? 'var(--bg-card)' : 'transparent',
                color: activeLetter === l ? 'white' : hasVerbs ? 'var(--text-secondary)' : 'var(--border)',
                border: `1px solid ${activeLetter === l ? 'var(--accent)' : hasVerbs ? 'var(--border)' : 'transparent'}`,
                cursor: hasVerbs ? 'pointer' : 'default',
              }}
            >
              {l}
            </button>
          )
        })}
        {(activeLetter || search) && (
          <button
            onClick={() => { setLetter(null); setSearch('') }}
            className="px-3 h-7 rounded-md text-xs font-medium flex items-center gap-1"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <X size={11} /> {t('vocabulary.clearFilter')}
          </button>
        )}
      </div>

      <p className="text-xs mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>
        {verbCountText}
      </p>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {[
                  t('vocabulary.baseForm'),
                  t('vocabulary.pastSimple'),
                  t('vocabulary.pastParticiple'),
                  t('vocabulary.translation'),
                  t('vocabulary.definition'),
                  '',
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((verb, i) => (
                <>
                  <tr
                    key={verb.id}
                    className="transition-colors cursor-pointer"
                    style={{
                      background: expanded === verb.id ? 'var(--bg-secondary)' : i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-card)',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onClick={() => setExpanded(expanded === verb.id ? null : verb.id)}
                  >
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--accent)' }}>{verb.base}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{verb.past}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{verb.participle}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{verb.uzbek}</td>
                    <td className="px-4 py-3 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                      {expanded !== verb.id && <span className="line-clamp-1">{verb.definition}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); setAddingVerb(verb) }}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                          style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}
                        >
                          <BookPlus size={13} /> {t('vocabulary.save')}
                        </button>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {expanded === verb.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expanded === verb.id && (
                    <tr key={`${verb.id}-exp`} style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.definition')}: </span>
                            {verb.definition}
                          </p>
                          <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                            <span className="not-italic font-semibold">{t('vocabulary.example')}: </span>
                            &ldquo;{verb.example}&rdquo;
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
          {filtered.map((verb) => (
            <div key={verb.id} style={{ borderColor: 'var(--border)' }}>
              <button
                className="w-full text-left px-4 py-3"
                onClick={() => setExpanded(expanded === verb.id ? null : verb.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-base" style={{ color: 'var(--accent)' }}>{verb.base}</span>
                    <span className="mx-2" style={{ color: 'var(--border)' }}>|</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{verb.past}</span>
                    <span className="mx-2" style={{ color: 'var(--border)' }}>|</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{verb.participle}</span>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{verb.uzbek}</div>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {expanded === verb.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </span>
                </div>
              </button>
              {expanded === verb.id && (
                <div className="px-4 pb-3 space-y-2">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{verb.definition}</p>
                  <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>&ldquo;{verb.example}&rdquo;</p>
                  <button
                    onClick={() => setAddingVerb(verb)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    <BookPlus size={13} /> {t('vocabulary.saveToLibrary')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
            {verbCountText}.{' '}
            <button onClick={() => { setSearch(''); setLetter(null) }} className="underline">
              {t('vocabulary.clearFilter')}
            </button>
          </div>
        )}
      </div>

      {/* Add to Library modal */}
      {addingVerb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            ref={modalRef}
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                {t('vocabulary.addToLibrary')}: &ldquo;{addingVerb.base}&rdquo;
              </h3>
              <button onClick={() => setAddingVerb(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {t('vocabulary.chooseCollection')}
            </p>

            {colLoading ? (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('common.loading')}
              </div>
            ) : collections.length === 0 ? (
              <div className="py-6 text-center space-y-3">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.noCollectionsHint')}</p>
                <Link
                  href="/vocabulary/library"
                  className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  <Plus size={14} /> {t('vocabulary.createCollectionFirst')}
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {collections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => addToCollection(col.id)}
                    disabled={saving}
                    className="w-full text-left px-4 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80 disabled:opacity-50 flex items-center justify-between"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    📁 {col.name}
                    {saved === addingVerb.id && <Check size={16} style={{ color: 'var(--success)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
