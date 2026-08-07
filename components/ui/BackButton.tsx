'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  href: string
  className?: string
}

export function BackButton({ href, className = 'btn-outline text-sm flex items-center gap-1.5 shrink-0' }: Props) {
  const { t } = useLanguage()
  return (
    <Link href={href} className={className}>
      <ArrowLeft size={14} />
      <span className="hidden sm:inline">{t('common.back')}</span>
    </Link>
  )
}
