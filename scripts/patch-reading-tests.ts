/**
 * Patches all reading HTML test files in Supabase Storage "tests" bucket:
 * - Adds CDI_NATIVE + CDI_SUBMIT postMessage calls inside checkAnswers()
 * - Skips files that already have CDI_SUBMIT
 *
 * Run: npx ts-node --project tsconfig.json -e "$(cat scripts/patch-reading-tests.ts)"
 * Or:  npx ts-node scripts/patch-reading-tests.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xzxfsznyrrtunnbfxgww.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// The two postMessage lines to inject just before the closing brace of checkAnswers
// We look for the score variable assignment pattern, then inject before "}" near the end
const CDI_PATCH = `
            // Notify parent window (CDI bridge)
            window.parent.postMessage({ type: 'CDI_NATIVE' }, '*');
            window.parent.postMessage({ type: 'CDI_SUBMIT', testType: 'reading', answers: resultsData || {}, score: score, timeTaken: (typeof timeInSeconds !== 'undefined' ? 3600 - timeInSeconds : 0) }, '*');`

/**
 * Injects CDI_NATIVE + CDI_SUBMIT into HTML that doesn't already have them.
 *
 * Strategy: find the first `window.parent.postMessage` or, if absent, find
 * `checkAnswers` function's closing block and insert before the last `}` that
 * closes the function.
 *
 * Simpler & safer approach used here:
 * Find a reliable anchor — the score variable being set — and inject after it.
 * Anchor candidates (tried in order):
 *   1. `score = correctCount;`  or  `score = totalCorrect;`  or  `var score =`
 *   2. Insert before `deliverButton.innerHTML` or `deliverButton.style`
 *   3. Insert before `</script>` as last resort
 */
function patchHtml(html: string, filename: string): string | null {
  if (html.includes("type: 'CDI_SUBMIT'") || html.includes('type:"CDI_SUBMIT"') || html.includes('CDI_SUBMIT')) {
    return null // already patched
  }

  // Try anchor 1: deliverButton state change after score calc
  const anchors = [
    "deliverButton.innerHTML = '<span>✓",
    'deliverButton.innerHTML =',
    'deliverButton.style.backgroundColor',
    'deliverButton.disabled = true',
  ]

  for (const anchor of anchors) {
    const idx = html.indexOf(anchor)
    if (idx !== -1) {
      const patched = html.slice(0, idx) + CDI_PATCH + '\n' + html.slice(idx)
      console.log(`  ✓ Patched via anchor: "${anchor.slice(0, 40)}"`)
      return patched
    }
  }

  // Last resort: insert before </script>
  const scriptClose = '</script>'
  const lastScript = html.lastIndexOf(scriptClose)
  if (lastScript !== -1) {
    const patched = html.slice(0, lastScript) + CDI_PATCH + '\n' + html.slice(lastScript)
    console.log(`  ✓ Patched via </script> fallback`)
    return patched
  }

  console.warn(`  ⚠ Could not find anchor in ${filename}, skipping`)
  return null
}

async function listAllHtmlFiles(): Promise<{ name: string; path: string }[]> {
  const results: { name: string; path: string }[] = []

  async function scanFolder(prefix: string) {
    const { data, error } = await admin.storage.from('tests').list(prefix, { limit: 200 })
    if (error) { console.error('List error:', prefix, error.message); return }
    if (!data) return

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name
      if (item.metadata === null) {
        // It's a folder
        await scanFolder(fullPath)
      } else if (item.name.toLowerCase().endsWith('.html')) {
        results.push({ name: item.name, path: fullPath })
      }
    }
  }

  await scanFolder('')
  return results
}

async function main() {
  console.log('Scanning Supabase Storage "tests" bucket for HTML files...\n')

  const files = await listAllHtmlFiles()
  console.log(`Found ${files.length} HTML file(s):\n`)
  files.forEach(f => console.log(' -', f.path))
  console.log()

  let patched = 0
  let skipped = 0
  let failed = 0

  for (const file of files) {
    console.log(`Processing: ${file.path}`)

    // Download
    const { data: blob, error: dlErr } = await admin.storage.from('tests').download(file.path)
    if (dlErr || !blob) {
      console.error(`  ✗ Download failed: ${dlErr?.message}`)
      failed++
      continue
    }

    const html = await blob.text()

    const patchedHtml = patchHtml(html, file.path)
    if (patchedHtml === null) {
      console.log('  → Already has CDI_SUBMIT, skipping')
      skipped++
      continue
    }

    // Upload back
    const { error: upErr } = await admin.storage
      .from('tests')
      .upload(file.path, new Blob([patchedHtml], { type: 'text/html' }), {
        upsert: true,
        contentType: 'text/html',
      })

    if (upErr) {
      console.error(`  ✗ Upload failed: ${upErr.message}`)
      failed++
    } else {
      console.log('  ✓ Uploaded successfully')
      patched++
    }
  }

  console.log('\n─────────────────────────────')
  console.log(`Total HTML files : ${files.length}`)
  console.log(`Patched          : ${patched}`)
  console.log(`Already patched  : ${skipped}`)
  console.log(`Failed           : ${failed}`)
}

main().catch(err => { console.error(err); process.exit(1) })
