export type BookCategory = 'grammar' | 'ielts' | 'vocabulary' | 'fun_reads'

export const BOOK_CATEGORIES: BookCategory[] = ['grammar', 'ielts', 'vocabulary', 'fun_reads']

export const DEFAULT_BOOK_CATEGORY: BookCategory = 'ielts'

export function isBookCategory(value: unknown): value is BookCategory {
  return typeof value === 'string' && (BOOK_CATEGORIES as string[]).includes(value)
}

/** Tailwind classes matching the DB constraint's 4 allowed values. */
export const BOOK_CATEGORY_COLORS: Record<BookCategory, { bg: string; text: string; border: string }> = {
  grammar: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40' },
  ielts: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
  vocabulary: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  fun_reads: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/40' },
}
