import { createBrowserClient } from '@supabase/ssr'

function resolveUrl(raw: string | undefined): string {
  if (raw && (raw.startsWith('http://') || raw.startsWith('https://'))) return raw
  return 'https://placeholder.supabase.co'
}

function resolveKey(raw: string | undefined): string {
  if (raw && !raw.includes(' ')) return raw
  return 'placeholder-anon-key'
}

export function createClient() {
  return createBrowserClient(
    resolveUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    resolveKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}
