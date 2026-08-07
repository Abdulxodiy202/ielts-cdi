import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('SUPABASE_URL      :', url ? url.slice(0, 40) + '...' : '(NOT SET)')
console.log('SERVICE_ROLE_KEY  :', key ? `set (length ${key.length})` : '(NOT SET)')

if (!url || !key) {
  console.error('Missing env vars — aborting')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Test 1: can we read profiles?
console.log('\n--- Test 1: read profiles ---')
const { data, error } = await supabase.from('profiles').select('id, is_premium').limit(3)
console.log('data :', data)
console.log('error:', error)

// Test 2: try updating first user (same value — just tests write access)
if (data?.[0]) {
  console.log('\n--- Test 2: update first profile ---')
  console.log('target id:', data[0].id, '| current is_premium:', data[0].is_premium)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_premium: data[0].is_premium })
    .eq('id', data[0].id)
  console.log('update result:', updateError ?? 'SUCCESS')
}
