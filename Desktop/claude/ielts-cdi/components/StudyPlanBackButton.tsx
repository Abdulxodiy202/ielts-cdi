'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// `/dashboard/study-plan` orqali kirilgan bo'lsa qaytish tugmasi.
// Har karta URL'iga `?fromPlan=true` qo'shadi -- shu paramni tekshirib
// tugmani ko'rsatamiz. Sidebar orqali kirilsa null qaytaradi (na markup
// na space band qilinadi).
//
// Client hook (useSearchParams) qo'llaganimiz uchun ota sahifa 'use
// client' bo'lishi kerak. Sahifalar allaqachon shunday.
export function StudyPlanBackButton() {
  const searchParams = useSearchParams()
  if (searchParams.get('fromPlan') !== 'true') return null
  return (
    <Link
      href="/dashboard/study-plan"
      className="inline-flex items-center gap-1.5 text-sm mb-4 hover:opacity-80 transition-opacity"
      style={{ color: '#a855f7' }}
    >
      <ArrowLeft size={14} /> Study Plan&apos;ga qaytish
    </Link>
  )
}
