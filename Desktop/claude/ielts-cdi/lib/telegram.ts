const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

export interface InlineButton {
  text: string
  callback_data: string
}

/* ── answerCallbackQuery ─────────────────────────────────────────────── */
export async function answerCallbackQuery(callbackQueryId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: false,
        }),
      }
    )
  } catch (e) {
    console.error('answerCallbackQuery failed:', e)
  }
}

/* ── sendTelegramNotification (plain text, optional buttons) ─────────── */
export async function sendTelegramNotification(
  message: string,
  buttons?: InlineButton[][]
) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return
  try {
    const body: Record<string, unknown> = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    }
    if (buttons?.length) {
      body.reply_markup = { inline_keyboard: buttons }
    }
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
  } catch (e) {
    console.error('Telegram notification failed:', e)
  }
}

/* ── sendTelegramPhoto (with optional inline keyboard) ───────────────── */
export async function sendTelegramPhoto(
  photoUrl: string,
  caption: string,
  buttons?: InlineButton[][]
) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return
  try {
    const body: Record<string, unknown> = {
      chat_id: TELEGRAM_CHAT_ID,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
    }
    if (buttons?.length) {
      body.reply_markup = { inline_keyboard: buttons }
    }
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
  } catch (e) {
    console.error('Telegram photo notification failed:', e)
  }
}
