// Sana yordamchilari. Kunlik plan cron'i Toshkent yarim tunida
// (UTC+5) ishlaydi va `period_start` ustuni shu kalendar kunni
// yozadi. `new Date().toISOString().split('T')[0]` UTC ni beradi,
// shuning uchun Toshkent yarim tunidan keyingi 5 soatlik oyna
// bo'sh natija qaytaradi (frontend hali kechagi UTC kun ustida).
//
// Bu helperlar Intl.DateTimeFormat orqali doim Toshkent kalendariga
// bog'lanadi -- SSR va client bir xil natija chiqaradi (Node ICU
// yoqilgan).

/** Toshkent (Asia/Tashkent) bo'yicha bugungi sana YYYY-MM-DD formatda.
 *  en-CA locale Postgres date bilan mos ISO formatini kafolatlaydi. */
export function getTashkentToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
