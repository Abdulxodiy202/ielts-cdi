/**
 * Seed 40 section tests (4 parts × 10 tests each) into the tests table.
 * Usage:  node --env-file=.env.local scripts/seed-section-tests.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error(
    '❌  Missing env vars.\n' +
    '    Run with: node --env-file=.env.local scripts/seed-section-tests.mjs'
  )
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Part 1 → order 1001-1010, Part 2 → 1011-1020, Part 3 → 1021-1030, Part 4 → 1031-1040
// Within each part: tests 1-3 are free, tests 4-10 are premium

const tests = []
for (let part = 1; part <= 4; part++) {
  for (let section = 1; section <= 10; section++) {
    const orderNumber = 1000 + (part - 1) * 10 + section
    tests.push({
      title: `Part ${part} · Test ${section}`,
      description: JSON.stringify({ mode: 'section', part, section }),
      type: 'listening',
      is_premium: section > 3,
      is_published: true,
      order_number: orderNumber,
    })
  }
}

console.log(`⏳  Inserting ${tests.length} section tests...`)

const { data, error } = await supabase
  .from('tests')
  .insert(tests)
  .select('id, title, order_number')

if (error) {
  console.error('❌  Insert failed:', error.message)
  process.exit(1)
}

console.log(`✅  Inserted ${data.length} section tests:`)
for (const t of data) {
  console.log(`    #${t.order_number}: ${t.title}`)
}
