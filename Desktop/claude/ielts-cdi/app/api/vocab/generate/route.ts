import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { word } = await req.json()
  if (!word?.trim()) return Response.json({ error: 'Word required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const prompt = `You are a vocabulary assistant for IELTS preparation.
Given the English word "${word.trim()}", provide:
1. uzbek_translation — Uzbek translation (2-4 words max)
2. definition — Clear English definition in 1 sentence (IELTS level)
3. example — One natural example sentence using the word (IELTS Academic context preferred)
4. collocations — 3-4 common collocations as a comma-separated string

Respond ONLY with valid JSON, no markdown, no extra text:
{"uzbek_translation":"...","definition":"...","example":"...","collocations":"..."}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[vocab/generate] Anthropic error:', text)
    return Response.json({ error: 'AI generation failed' }, { status: 500 })
  }

  const json = await res.json()
  const raw = json.content?.[0]?.text ?? ''

  try {
    const parsed = JSON.parse(raw)
    return Response.json({ word: word.trim(), ...parsed })
  } catch {
    console.error('[vocab/generate] JSON parse failed:', raw)
    return Response.json({ error: 'Invalid AI response' }, { status: 500 })
  }
}
