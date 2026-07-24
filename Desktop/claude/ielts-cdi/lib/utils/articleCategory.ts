// Article kategoriyasi va o'qish vaqti helper'i.
//
// Backend'da articles.category va articles.reading_minutes ustunlari
// hozircha yo'q. Category qo'shilgunicha frontend article.id hash'i
// bo'yicha 4 kategoriyaning biriga deterministic taqsimlaydi. Reading
// minutes ham xuddi shu tarzda 3-8 min oralig'ida stabillanadi.
//
// Backend ustun qo'shsa: `article.category ?? deriveCategory(id)`
// naqshi shu funksiyalarni fallback qiladi -- kod o'zgartirilishi
// shart emas.

export type ArticleCategory = 'literature' | 'science' | 'history' | 'humanities'

export const CATEGORY_LABEL: Record<ArticleCategory, string> = {
  literature: 'Literature',
  science: 'Science',
  history: 'History',
  humanities: 'Humanities',
}

// Ranglar spec bo'yicha: Literature purple, Science blue, History amber,
// Humanities green. `accent` badge/chiziq uchun, `bg` yumshoq fon.
export const CATEGORY_COLOR: Record<ArticleCategory, { accent: string; bg: string; border: string }> = {
  literature: { accent: '#A855F7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.30)' },
  science:    { accent: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)' },
  history:    { accent: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)' },
  humanities: { accent: '#22C55E', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.30)' },
}

const CATEGORIES: ArticleCategory[] = ['literature', 'science', 'history', 'humanities']

// Barqaror hash: char code'lar yig'indisi. Cryptographic mustahkam
// bo'lishi shart emas -- faqat bir xil id doim bir xil kategoriya
// bersin.
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function deriveCategory(articleId: string): ArticleCategory {
  return CATEGORIES[hashString(articleId) % CATEGORIES.length]
}

// Har article uchun 3..8 min oralig'ida deterministic o'qish vaqti.
// Backend .reading_minutes qo'shilsa shu bilan almashtiriladi.
export function deriveReadingMinutes(articleId: string): number {
  return 3 + (hashString(articleId + '::mins') % 6)
}

// Sana asosidagi seed bilan `pool` dan `count` ta element deterministic
// tanlaydi. Bugun bir xil natija, ertaga -- boshqa. UTC emas, foydalanuvchi
// vaqti asosida (client-side yaratilgani uchun toza bo'lib chiqadi).
export function pickForToday<T extends { id: string }>(pool: T[], count: number, dateKey?: string): T[] {
  if (pool.length === 0) return []
  const today = dateKey ?? new Date().toISOString().split('T')[0]
  const scored = pool.map(item => ({ item, score: hashString(item.id + '::' + today) }))
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, count).map(x => x.item)
}
