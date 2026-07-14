'use client'

import { PenLine } from 'lucide-react'
import { ComingSoon } from '@/components/ComingSoon'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function WritingPage() {
  const { t } = useLanguage()
  return <ComingSoon icon={PenLine} title={t('nav.writing')} />
}
