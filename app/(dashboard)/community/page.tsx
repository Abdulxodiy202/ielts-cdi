'use client'

import { Users } from 'lucide-react'
import { ComingSoon } from '@/components/ComingSoon'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function CommunityPage() {
  const { t } = useLanguage()
  // Passes t('community.soon') explicitly so the Uzbek "Tez kunda..."
  // subtitle survives the refactor; other pages take the default.
  return (
    <ComingSoon icon={Users} title={t('community.title')} subtitle={t('community.soon')} />
  )
}
