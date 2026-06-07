import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/* ── Premium approval ────────────────────────────────────────────────── */
export async function sendPremiumApprovalEmail(to: string, name: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: '🎉 IELTS CDI Premium faollashtirildi!',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#0f0f23;font-family:Inter,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f23;padding:40px 20px;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0"
                style="background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center;">
                    <div style="font-size:40px;margin-bottom:8px;">👑</div>
                    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Premium Faollashtirildi!</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">
                      Assalomu alaykum, <strong>${name}</strong>!
                    </p>
                    <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.6;">
                      Tabriklaymiz! Sizning <strong style="color:#f59e0b;">IELTS CDI Premium</strong> obunangiz
                      muvaffaqiyatli faollashtirildi. Endi barcha premium testlarga to'liq kirish imkoniyatingiz bor.
                    </p>
                    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);
                                border-radius:12px;padding:16px;margin:24px 0;">
                      <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:600;">✅ Sizga ochildi:</p>
                      <ul style="margin:8px 0 0;padding-left:18px;color:#94a3b8;font-size:13px;line-height:1.8;">
                        <li>Barcha Premium Reading testlar</li>
                        <li>Barcha Premium Listening testlar</li>
                        <li>Mock Test imkoniyati</li>
                        <li>1 oylik obuna (30 kun)</li>
                      </ul>
                    </div>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                      <tr><td align="center">
                        <a href="${APP_URL}/dashboard"
                          style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);
                                 color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;
                                 font-weight:700;font-size:15px;">
                          🚀 Saytga o'tish
                        </a>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);
                             text-align:center;color:#475569;font-size:12px;">
                    IELTS CDI Practice Platform — Bu xabar avtomatik yuborildi.
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })
  } catch (e) {
    console.error('sendPremiumApprovalEmail failed:', e)
  }
}

/* ── Mock booking approval ───────────────────────────────────────────── */
export async function sendBookingApprovalEmail(
  to: string,
  name: string,
  bookingDate: string,
  timeSlot: string
) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "✅ Mock Test ro'yxatingiz tasdiqlandi!",
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#0f0f23;font-family:Inter,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f23;padding:40px 20px;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0"
                style="background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px;text-align:center;">
                    <div style="font-size:40px;margin-bottom:8px;">📅</div>
                    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Mock Test Tasdiqlandi!</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">
                      Assalomu alaykum, <strong>${name}</strong>!
                    </p>
                    <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.6;">
                      Sizning Mock Test ro'yxatingiz tasdiqlandi. Quyidagi ma'lumotlarni eslab qoling:
                    </p>
                    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);
                                border-radius:12px;padding:20px;margin:24px 0;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color:#86efac;font-size:13px;font-weight:600;padding-bottom:8px;">📅 Sana</td>
                          <td style="color:#e2e8f0;font-size:14px;font-weight:700;padding-bottom:8px;text-align:right;">
                            ${bookingDate}
                          </td>
                        </tr>
                        <tr>
                          <td style="color:#86efac;font-size:13px;font-weight:600;">⏰ Vaqt</td>
                          <td style="color:#e2e8f0;font-size:14px;font-weight:700;text-align:right;">${timeSlot}</td>
                        </tr>
                      </table>
                    </div>
                    <p style="margin:0 0 24px;color:#94a3b8;font-size:13px;line-height:1.6;
                               background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;">
                      ℹ️ Test kuni Zoom/online link emailga alohida yuboriladi. Iltimos, emailingizni kuzatib boring.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td align="center">
                        <a href="${APP_URL}/mock-test"
                          style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);
                                 color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;
                                 font-weight:700;font-size:15px;">
                          📋 Mock Test sahifasi
                        </a>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);
                             text-align:center;color:#475569;font-size:12px;">
                    IELTS CDI Practice Platform — Bu xabar avtomatik yuborildi.
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })
  } catch (e) {
    console.error('sendBookingApprovalEmail failed:', e)
  }
}
