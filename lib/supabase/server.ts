import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function resolveUrl(raw: string | undefined): string {
  if (raw && (raw.startsWith('http://') || raw.startsWith('https://'))) return raw
  return 'https://placeholder.supabase.co'
}

function resolveKey(raw: string | undefined): string {
  if (raw && !raw.includes(' ')) return raw
  return 'placeholder-anon-key'
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    resolveUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    resolveKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
