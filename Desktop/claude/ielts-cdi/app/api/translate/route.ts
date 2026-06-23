import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { word } = await req.json()
    if (!word || word.length > 50) return NextResponse.json({ uzb: '', extra: '' })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Translate the English word "${word}" to Uzbek. Reply ONLY with JSON, no markdown: {"uzb":"uzbek translation","extra":"word type or example (optional, can be empty string)"}`
      }]
    })

    const text = (msg.content[0] as any).text || '{}'
    const parsed = JSON.parse(text.trim())
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ uzb: '', extra: '' })
  }
}
