export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return Response.json({ error: 'TELEGRAM_BOT_TOKEN is not set' }, { status: 500 })
  }

  const webhookUrl = `https://ielts-cdi.vercel.app/api/telegram-webhook`

  // Explicitly list all update types we need, including callback_query for
  // inline button clicks. Omitting allowed_updates can silently exclude
  // callback_query on some bot configurations.
  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: true,   // clear queued callbacks from old URL
      }),
    }
  )
  const result = await res.json() as { ok: boolean; description?: string }

  // Also fetch current webhook info so we can confirm the URL is correct
  const infoRes = await fetch(
    `https://api.telegram.org/bot${token}/getWebhookInfo`
  )
  const info = await infoRes.json() as {
    ok: boolean
    result?: {
      url: string
      has_custom_certificate: boolean
      pending_update_count: number
      last_error_date?: number
      last_error_message?: string
      allowed_updates?: string[]
    }
  }

  if (result.ok) {
    return Response.json({
      ok: true,
      message: 'Webhook set successfully',
      webhook_url: webhookUrl,
      telegram_confirms: info.result,
    })
  }

  return Response.json(
    {
      ok: false,
      error: result.description ?? 'setWebhook failed',
      telegram_confirms: info.result,
    },
    { status: 500 }
  )
}
