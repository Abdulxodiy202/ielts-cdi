'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronLeft, Clock, Sparkles } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Study Plan sahifasi hozircha to'liq ishlamaydi -- hamma userga
// (free va premium bir xil) "Ishlab chiqilmoqda" holati. Awvalgi
// premium/free branch, RPC chaqiruvlari, TaskCard'lar tayyor
// bo'lganda git tarixidan qaytariladi.

export default function StudyPlanPage() {
  const { t } = useLanguage()

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={14} /> {t('settingsPage.backHome')}
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          minHeight: 420,
        }}
      >
        {/* Mock content -- foydali ekan ko'rinishi uchun blur qilingan */}
        <div
          aria-hidden
          className="absolute inset-0 p-8 pointer-events-none select-none"
          style={{ filter: 'blur(10px)', opacity: 0.35 }}
        >
          <div className="space-y-4">
            <div className="h-16 rounded-2xl" style={{ background: 'var(--bg-secondary)' }} />
            <div className="h-24 rounded-2xl" style={{ background: 'var(--bg-secondary)' }} />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-32 rounded-2xl" style={{ background: 'var(--bg-secondary)' }} />
              <div className="h-32 rounded-2xl" style={{ background: 'var(--bg-secondary)' }} />
            </div>
          </div>
        </div>

        {/* Overlay */}
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-16 gap-4"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              boxShadow: '0 10px 30px rgba(99,102,241,0.35)',
            }}
          >
            <Sparkles size={30} className="text-white" />
          </div>

          <span
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.20), rgba(217,119,6,0.30))',
              border: '1px solid rgba(245,158,11,0.45)',
              color: '#fbbf24',
            }}
          >
            <Clock size={13} className="animate-pulse" />
            {t('common.workInProgress')}
          </span>

          <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('dashboard.studyPlanTitle')}
          </h1>
          <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
            {t('dailyPlanner.comingSoon')}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
