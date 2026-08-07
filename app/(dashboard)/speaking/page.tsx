'use client'

import { Mic } from 'lucide-react'
import { ComingSoon } from '@/components/ComingSoon'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function SpeakingPage() {
  const { t } = useLanguage()
  return <ComingSoon icon={Mic} title={t('nav.speaking')} />
}
