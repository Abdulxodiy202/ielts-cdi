export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callOpenRouter } from '@/lib/ai/openrouter'
import { getTashkentToday } from '@/lib/utils/date'
import { grantLeaderboardStars } from '@/lib/utils/leaderboard'
import { isActivePremium } from '@/lib/utils/premium'

type AdminClient = ReturnType<typeof createAdminClient>

// GET: returns the caller's latest AI-generated plan, first SYNCING it
// against their real activity -- any category with fresh activity since
// the last sync feeds the `progress` counter of TODAY's matching
// task(s), which in turn moves each task through three states (not
// started / partial / done). When the week's total stars_earned reaches
// stars_goal AND the plan's final day has arrived (isFinalDayReached),
// a one-time bonus is granted via the app's real leaderboard system
// (increment_user_stars RPC, category 'game' -- same bucket the vocab
// puzzle uses). Bonus size scales with the chosen dailyMinutes --
// bonusStarsFor()/BONUS_BY_MINUTES: 60min=100, 90min=150, 120min=200,
// 180min=300.
//
// SYNC MEXANIZMI (vaqt belgisiga asoslangan, "distinct-count" emas):
// script_progress, game_progress (vocab) va article_test_results --
// har biri (user, item) uchun BITTA qator saqlaydi (qayta urinishda
// yangi qator qo'shilmaydi, mavjudi yangilanadi). Shu sababli "necha
// dona is_completed=true qator bor" kabi son bilan solishtirish qayta
// urinishlarni UMUMAN ko'rmay qoladi (son o'zgarmaydi) -- aynan shu
// "yulduz hisoblanmayapti" xatosiga sabab bo'lgan edi. Tuzatish: har bir
// jadvalning o'z "oxirgi yangilangan" vaqt ustuni (completed_at /
// updated_at / attempted_at) bor va bu ustun HAR safar (qayta urinishda
// ham) yangilanib turadi -- shuning uchun endi "oxirgi
// sinxronizatsiyadan (last_synced_at) KEYINGI vaqtda yangilangan
// qatorlar"ni hisoblaymiz, statik sonlar farqini emas.
//
// YULDUZ ANIQLIGI (progress = haqiqiy yulduz, taxminiy ulush emas):
// Avval `progress` "nechta faollik birligi bajarildi" sonini hisoblardi
// (masalan vocab uchun "nechta daraja o'ynaldi"), keyin taskStars() buni
// maxStars'ga PROPORSIONAL ravishda o'girardi -- shuning uchun o'yinda
// 3 ta HAQIQIY yulduz olingan bo'lsa ham, vazifada shartli 2 ta bo'lib
// ko'rinishi mumkin edi (chunki faqat 1/3 "daraja" bajarilgan hisoblanardi).
// Endi haqiqiy yulduz ma'lumoti mavjud kategoriyalarda (reading,
// listening_full, script, vocab, article) `progress` TO'G'RIDAN-TO'G'RI
// o'sha faollikda haqiqatda olingan yulduzlar YIG'INDISINI saqlaydi
// (maxStars'gacha cheklab), va bu kategoriyalarda `target === maxStars`
// qilib qo'yilgan -- shuning uchun taskStars() endi shunchaki
// min(maxStars, progress) beradi. Faqat haqiqiy yulduz signali YO'Q
// kategoriyada (listening_part -- test_sessions'da star ustuni yo'q)
// eski "necha marta bajarildi" hisoblash usuli qoladi.
//
// POST: build a fresh 7-day plan starting TODAY, sized to the daily
// minutes the user picked, from the admin's instruction (ai_settings) +
// the user's activity across every skill. Each task carries a category
// tag (used for auto-detection), a completion target, and a max-star
// value fixed per category (reading/listening = 15, script/article =
// 10, vocab puzzle/general = 5) -- not trusted from the AI.
//
// PATCH: manually toggle a 'general' (non-auto-trackable, e.g. typing)
// task's done state.
//
// Independent from the existing rule-based user_study_plans system --
// this is an additive AI layer, nothing here touches that table.

const UZ_WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']

type Category = 'reading' | 'listening_full' | 'listening_part' | 'script' | 'vocab' | 'article' | 'general'
const CATEGORIES: Category[] = ['reading', 'listening_full', 'listening_part', 'script', 'vocab', 'article', 'general']

// Bitta vazifa TO'LIQ bajarilganda beradigan maksimal yulduz --
// reading/listening eng qimmatli (bitta test = katta mehnat), vocab
// puzzle va umumiy (typing) eng arzon.
const CATEGORY_MAX: Record<Category, number> = {
  reading: 15, listening_full: 15, listening_part: 15,
  script: 10, article: 10,
  vocab: 5, general: 5,
}
// Vazifa "to'liq bajarildi" deb hisoblanishi uchun kerak bo'lgan real
// faollik birligi -- FAQAT haqiqiy yulduz signali YO'Q kategoriyalar
// (listening_part, general) uchun ishlatiladi ("nechta marta bajarildi").
const CATEGORY_TARGET: Record<Category, number> = {
  reading: 1, listening_full: 1, listening_part: 1,
  script: 1, article: 1,
  vocab: 3, general: 1,
}
// Haqiqiy per-attempt yulduz ma'lumoti mavjud kategoriyalar (test_results,
// script_attempts, game_progress, article_test_results) -- bularda
// `progress` "bajarilgan soni" emas, balki HAQIQIY olingan yulduzlar
// yig'indisini saqlaydi va `target` shunchaki `maxStars`ga tenglashtiriladi.
// listening_part (test_sessions'da star ustuni yo'q) va general (qo'lda
// belgilanadi) eski son-asosidagi modelda qoladi.
const STAR_TRACKED: Record<Category, boolean> = {
  reading: true, listening_full: true, listening_part: false,
  script: true, article: true, vocab: true, general: false,
}

// Har bir kategoriyaning taxminiy davomiyligi -- ikki maqsadda
// ishlatiladi: (1) har bir vazifa matniga ANIQ shu davomiylik yorlig'i
// qo'shiladi (foydalanuvchi so'ragandek -- ba'zi AI javoblarida bu tasodifan
// bor edi, ba'zilarida yo'q, endi HAR DOIM serverdan qo'yiladi, AI'ga
// bog'liq emas); (2) kunlik "vaqt byudjeti" balansini (pastga qarang)
// deterministik hisoblash uchun.
const CATEGORY_DURATION_MINUTES: Record<Category, number> = {
  // Script: audio o'zi ~6 daqiqa bo'lsa-da, mashqning o'zi (bir necha
  // marta tinglash + yozish + transkript bilan solishtirib tekshirish)
  // kamida 15-20 daqiqa oladi -- foydalanuvchi tuzatishi bo'yicha
  // 10'dan 18'ga oshirildi.
  reading: 60, listening_full: 35, listening_part: 12,
  script: 18, article: 12, vocab: 12, general: 10,
}
const CATEGORY_DURATION_LABEL: Record<Category, string> = {
  reading: '60 daqiqa', listening_full: '35 daqiqa', listening_part: '10-15 daqiqa',
  script: '15-20 daqiqa', article: '10-15 daqiqa', vocab: '10-15 daqiqa', general: '10 daqiqa',
}

interface PlanTask {
  text: string
  category: Category
  target: number
  progress: number
  maxStars: number
  // Javobga qo'shiladigan (lekin plan_json'ga SAQLANMAYDIGAN) tavsiya --
  // "aynan shu testni/scriptni/maqolani ishlang" degan ANIQ ID. Har bir
  // GET/POST so'rovida getRecommendedRefs() orqali QAYTA hisoblanadi,
  // shunda foydalanuvchi bir narsani tugatgach tavsiya avtomatik
  // keyingisiga o'tadi (statik saqlansa eskirib qolardi).
  recommendedId?: string
  recommendedPart?: number
}

interface PlanDay {
  day: number
  date: string
  weekday: string
  tasks: PlanTask[]
}

type CategoryCounts = Record<Category, number>

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return UZ_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

// Erkin (free-tier) AI model ba'zan vazifa matniga tasodifiy "(51/100)"
// yoki "(85%)" kabi ma'nosiz raqamlar qo'shib qo'yishi mumkin (system
// promptda taqiqlangan bo'lsa ham) -- shuni tozalab tashlaydigan
// xavfsizlik to'sig'i, tizim promptidagi qoidaga qo'shimcha himoya.
function sanitizeTaskText(text: string): string {
  return text
    .trim()
    .replace(/\(\s*\d+\s*[/\-]\s*\d+\s*\)/g, '')
    .replace(/\(\s*\d+\s*%\s*\)/g, '')
    // AI ba'zan o'zi ham "(60 daqiqa)" kabi davomiylik yozib qo'yadi --
    // buni olib tashlaymiz, chunki pastda SERVER o'zi ANIQ va BARCHA
    // vazifalarda BIR XIL formatda davomiylik yorlig'ini qo'shadi
    // (AI'ning notekis/tasodifiy qo'shishiga bog'liq bo'lmasin uchun).
    .replace(/\(\s*~?\s*\d+(?:\s*-\s*\d+)?\s*(daqiqa|soat)\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function classify(text: string, hint?: string): Category {
  if (hint && (CATEGORIES as string[]).includes(hint)) return hint as Category
  const t = text.toLowerCase()
  if (t.includes('listening') && (t.includes("bo'lim") || t.includes('bolim') || t.includes('part'))) return 'listening_part'
  if (t.includes('listening')) return 'listening_full'
  if (t.includes('reading')) return 'reading'
  if (t.includes('script') || t.includes('dictation')) return 'script'
  if (t.includes('vocab') || t.includes('puzzle') || t.includes("so'z")) return 'vocab'
  if (t.includes('article') || t.includes('maqola')) return 'article'
  return 'general'
}

function taskStars(task: PlanTask): number {
  if (task.target <= 0) return 0
  return Math.min(task.maxStars, Math.round((task.progress / task.target) * task.maxStars))
}

function sumStars(days: PlanDay[]): number {
  return days.reduce((sum, d) => sum + d.tasks.reduce((s, t) => s + taskStars(t), 0), 0)
}

// Haftalik reja TO'LIQ (barcha 7 kun, 100%) yakunlanganda beriladigan
// bonus -- foydalanuvchi qancha ko'p vaqt (kuniga) ajratishni tanlagan
// bo'lsa, bonus ham shuncha katta (kattaroq kunlik vaqt = ko'proq
// mehnat = ko'proq mukofot). Faqat shu 4 ta tanlov (60/90/120/180)
// mavjud -- POST'dagi `dailyMinutes` validatsiyasiga qarang.
const BONUS_BY_MINUTES: Record<number, number> = { 60: 100, 90: 150, 120: 200, 180: 300 }
function bonusStarsFor(dailyMinutes: number | null | undefined): number {
  return BONUS_BY_MINUTES[dailyMinutes ?? 60] ?? 100
}

// Bonus faqat HAFTANING OXIRGI KUNIGA YETILGANDA (yoki undan keyin
// tekshirilganda) beriladi -- avval `starsEarned >= starsGoal` bo'lishi
// bilanoq (hatto haftaning o'rtasida, barcha vazifalarni oldindan
// "zaxira" qilib qo'yib bo'lsa ham) darhol berilardi. Foydalanuvchi
// buni "hafta to'liq yakunlanishi bilan, oxirgi kunida" berilishini
// so'radi -- shu sabab reja massividagi ENG OXIRGI kunning sanasi
// yetib kelgan (yoki o'tib ketgan) bo'lishi ham shart qilib qo'yildi.
function isFinalDayReached(days: PlanDay[]): boolean {
  if (days.length === 0) return false
  const lastDate = days[days.length - 1].date
  return getTashkentToday() >= lastDate
}

// Bo'sh joyni to'ldirish uchun ustuvorlik tartibi -- katta (ko'proq
// yulduzli) vazifalar avval sinaladi, shunda kam bo'sh joy qolganda ham
// mazmunli vazifa qo'shiladi (nafaqat mayda-chuyda).
const FILLER_ORDER: Category[] = ['reading', 'listening_full', 'article', 'script', 'vocab', 'listening_part', 'general']

const FILLER_TEXT: Record<Category, string> = {
  reading: 'Reading: 1 ta to\'liq test ishlang',
  listening_full: 'Listening: 1 ta to\'liq CDI test ishlang',
  listening_part: 'Listening: 1 ta bo\'lim/section mashqi ishlang',
  script: 'Script: 1 ta dictation mashqini ishlang',
  vocab: 'Vocabulary: 2-3 ta puzzle darajasini o\'ynang',
  article: 'Article: 1 ta maqola testini ishlang',
  general: 'Typing: 1 ta typing mashqini bajaring',
}
/** Kun indeksiga (0=1-kun, 1=2-kun, ...) qarab FILLER_ORDER'ni "aylantiradi"
 *  -- shu bilan turli kunlar bo'sh joyni TURLI kategoriyalar bilan
 *  to'ldiradi (masalan 1-kun avval Reading bilan, 2-kun avval Article
 *  bilan boshlaydi). Aks holda (statik tartib) AI har kunga deyarli bir
 *  xil qisqa ro'yxat bersa, filler ham har doim AYNAN bir xil qo'shimcha
 *  vazifalarni qo'shib, barcha 7 kun deyarli bir-biriga o'xshash bo'lib
 *  qolardi (foydalanuvchi aynan shuni xabar qildi). */
function rotatedFillerOrder(dayIndex: number): Category[] {
  const n = FILLER_ORDER.length
  const offset = dayIndex % n
  return [...FILLER_ORDER.slice(offset), ...FILLER_ORDER.slice(0, offset)]
}

/** AI qaytargan kunlik vazifalar ro'yxatini `dailyMinutes` atrofidagi
 *  oraliqqa DETERMINISTIK ravishda moslaydi. Bepul/kichikroq modellar
 *  promptdagi vaqt-oralig'i qoidasiga ko'pincha rioya qilmay, katta
 *  dailyMinutes (masalan 120-180) tanlanganda ham atigi 1-2 ta qisqa
 *  vazifa qo'yib qo'yardi -- natijada turli dailyMinutes tanlovlari
 *  deyarli bir xil (yoki hatto NOMONOTON, ya'ni kattaroq vaqt tanlansa
 *  ham kichikroq) stars_goal'ga ega bo'lib chiqardi. Bu funksiya AI
 *  sifatidan qat'i nazar buni tuzatadi: kun juda "bo'sh" bo'lsa hali
 *  ishlatilmagan kategoriyadan qo'shimcha vazifa qo'shiladi, juda
 *  "to'lib ketgan" bo'lsa oxiridan ortiqchasi olib tashlanadi.
 *
 *  MUHIM ESLATMA (2026-09 tuzatish): avval pastki chegaraga albatta
 *  "yetkazish" uchun (barcha 7 kategoriya ishlatilgach ham) YANA bir
 *  marta katta (Reading/Listening) vazifa qo'shiladigan 2-bosqich bor
 *  edi -- bu 3 soatlik (180 daqiqa) kunlarda halokatli natija berdi:
 *  barcha 7 kategoriya allaqachon ~159 daqiqani egallagan bo'lsa-da (bu
 *  180ning 88%i -- amalda YETARLI), shunchaki qat'iy 90% chegaraga (162)
 *  bir necha daqiqa yetmagani uchun YANA bitta 60 daqiqalik Reading
 *  qo'shib, kunni ~219 daqiqaga (deyarli 4 SOATGA) olib chiqib ketardi
 *  -- aynan shu holat xabar qilingan edi. Endi bu 2-bosqich OLIB
 *  TASHLANDI va pastki chegara ancha yumshatildi (0.9 -> 0.8) -- barcha
 *  7 kategoriyani bir marta qo'shish deyarli har doim yetarli, hech
 *  qachon budjetdan sezilarli oshib ketmaydi. */
function balanceDayDuration(tasks: PlanTask[], dailyMinutes: number, dayIndex: number): PlanTask[] {
  const lower = Math.round(dailyMinutes * 0.8)
  const upper = Math.round(dailyMinutes * 1.15)
  const dur = (t: PlanTask) => CATEGORY_DURATION_MINUTES[t.category]

  const result = [...tasks]
  let total = result.reduce((s, t) => s + dur(t), 0)

  while (total > upper && result.length > 1) {
    const removed = result.pop()!
    total -= dur(removed)
  }

  // Hali kunda ISHLATILMAGAN kategoriyalardan (kun bo'yicha aylantirilgan
  // tartibda -- yuqoridagi izohga qarang) navbat bilan bittadan qo'shiladi.
  const used = new Set(result.map(t => t.category))
  for (const cat of rotatedFillerOrder(dayIndex)) {
    if (total >= lower) break
    if (used.has(cat)) continue
    if (total + CATEGORY_DURATION_MINUTES[cat] > upper) continue
    const maxStars = CATEGORY_MAX[cat]
    const target = STAR_TRACKED[cat] ? maxStars : CATEGORY_TARGET[cat]
    result.push({ text: `${FILLER_TEXT[cat]} (${CATEGORY_DURATION_LABEL[cat]})`, category: cat, target, progress: 0, maxStars })
    used.add(cat)
    total += CATEGORY_DURATION_MINUTES[cat]
  }

  return result
}

/** AI qaytargan xom matndan 7 kunlik vazifa massivini chiqarib olishga
 *  urinadi -- muvaffaqiyatsiz bo'lsa (JSON emas, shakli mos emas, yoki
 *  kesilib qolgan -- kamroq/ko'proq kun) `null` qaytaradi. Bu funksiya
 *  ham yakuniy parslash uchun, HAM `callOpenRouter`ga `validate` sifatida
 *  beriladi -- shu bois Promise.any tez, lekin YAROQSIZ JSON qaytargan
 *  (masalan juda kichik) modelni "g'olib" deb tanlab qolmaydi, balki
 *  boshqa (sekinroq bo'lsa ham to'g'ri formatli) kandidatni kutadi. */
function parsePlanJSON(raw: string): { t: string; c?: string }[][] | null {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned
    const parsed = JSON.parse(jsonText)
    if (!Array.isArray(parsed?.days) || parsed.days.length !== 7) return null
    return parsed.days.map((d: unknown) =>
      Array.isArray(d)
        ? d.map((item: unknown) =>
            typeof item === 'string' ? { t: item } : { t: String((item as { t?: unknown })?.t ?? ''), c: (item as { c?: unknown })?.c as string | undefined },
          )
        : [],
    )
  } catch {
    return null
  }
}

/** Real (auto-trackable) activity counts, used both for the AI's context
 *  summary and as the sync baseline/target. 'general' has no underlying
 *  table so it always stays 0 -- those tasks are toggled manually. */
async function getCategoryCounts(admin: AdminClient, userId: string): Promise<CategoryCounts> {
  const [
    { data: testResults },
    { data: sessions },
    { data: scriptRows },
    { data: vocabRows },
    { data: articleRows },
  ] = await Promise.all([
    admin.from('test_results').select('tests(type)').eq('user_id', userId).limit(500),
    admin.from('test_sessions').select('id, tests(type, order_number)').eq('user_id', userId).eq('status', 'completed').limit(500),
    admin.from('script_progress').select('is_completed').eq('user_id', userId),
    admin.from('game_progress').select('is_completed').eq('user_id', userId),
    admin.from('article_test_results').select('id').eq('user_id', userId),
  ])

  const results = testResults ?? []
  const reading = results.filter(r => (r.tests as { type?: string } | null)?.type === 'reading').length
  const listening_full = results.filter(r => (r.tests as { type?: string } | null)?.type === 'listening').length
  const listening_part = (sessions ?? []).filter(s => {
    const t = s.tests as { type?: string; order_number?: number } | null
    return t?.type === 'listening' && typeof t.order_number === 'number' && t.order_number >= 1000
  }).length
  const script = (scriptRows ?? []).filter(s => s.is_completed).length
  const vocab = (vocabRows ?? []).filter(v => v.is_completed).length
  const article = (articleRows ?? []).length

  return { reading, listening_full, listening_part, script, vocab, article, general: 0 }
}

/** Har bir kategoriyada `sinceISO`dan KEYIN qayd etilgan faollikni
 *  hisoblaydi -- GET'dagi sinxronizatsiya shu funksiyaga tayanadi.
 *  STAR_TRACKED kategoriyalarda (reading/listening_full/script/vocab/
 *  article) natija HAQIQIY olingan yulduzlar YIG'INDISI (har bir
 *  urinishning o'z `stars` qiymati), boshqalarida (listening_part)
 *  oddiy bajarilgan soni. 'general'ning real jadvali yo'q, doim 0. */
async function getCategoryDeltasSince(admin: AdminClient, userId: string, sinceISO: string): Promise<CategoryCounts> {
  const [
    { data: testResults },
    { data: sessions },
    { data: scriptAttempts },
    { data: vocabRows },
    { data: articleRows },
  ] = await Promise.all([
    // stars: real per-attempt qiymat (0-5), reading/listening_full uchun.
    admin.from('test_results').select('completed_at, stars, tests(type)').eq('user_id', userId).gt('completed_at', sinceISO).limit(500),
    admin.from('test_sessions').select('completed_at, tests(type, order_number)').eq('user_id', userId).eq('status', 'completed').gt('completed_at', sinceISO).limit(500),
    // script_progress emas -- script_attempts har bir urinishni alohida
    // qator sifatida saqlaydi (o'z `stars` va `attempted_at`i bilan),
    // shu sababli aynan shu urinishda olingan haqiqiy yulduzni beradi.
    admin.from('script_attempts').select('attempted_at, stars').eq('user_id', userId).gt('attempted_at', sinceISO).limit(500),
    // game_progress'da faqat eng yaxshi (best-ever) `stars` bor -- vocab
    // uchun per-attempt jadval yo'q, shuning uchun bu eng yaqin taxmin.
    admin.from('game_progress').select('completed_at, stars').eq('user_id', userId).eq('is_completed', true).gt('completed_at', sinceISO),
    // last_stars: eng oxirgi urinishning haqiqiy natijasi (best_stars emas).
    admin.from('article_test_results').select('updated_at, last_stars').eq('user_id', userId).gt('updated_at', sinceISO),
  ])

  const results = testResults ?? []
  const sumStarsOf = (rows: { stars?: number | null }[]) => rows.reduce((s, r) => s + (r.stars ?? 0), 0)
  const reading = sumStarsOf(results.filter(r => (r.tests as { type?: string } | null)?.type === 'reading'))
  const listening_full = sumStarsOf(results.filter(r => (r.tests as { type?: string } | null)?.type === 'listening'))
  const listening_part = (sessions ?? []).filter(s => {
    const t = s.tests as { type?: string; order_number?: number } | null
    return t?.type === 'listening' && typeof t.order_number === 'number' && t.order_number >= 1000
  }).length
  const script = sumStarsOf(scriptAttempts ?? [])
  const vocab = sumStarsOf(vocabRows ?? [])
  const article = (articleRows ?? []).reduce((s, r) => s + ((r as { last_stars?: number | null }).last_stars ?? 0), 0)

  return { reading, listening_full, listening_part, script, vocab, article, general: 0 }
}

interface RecommendedRef {
  id: string
  part?: number
}

/** Har bir kategoriya uchun "aynan shuni ishlang" deb ANIQ bitta
 *  test/script/maqola tanlaydi -- tartib bo'yicha birinchi HALI
 *  BAJARILMAGANI, hammasi bajarilgan bo'lsa birinchisiga qaytadi
 *  (foydalanuvchi takror ishlashi mumkin bo'lgani uchun bo'sh
 *  qaytarishdan ko'ra shu ma'qulroq). Bu natija DB'ga yozilmaydi --
 *  har so'rovda qayta hisoblanadi, shunda foydalanuvchi bittasini
 *  tugatgach frontend keyingi safar avtomatik keyingisini ko'rsatadi.
 *  listening_part uchun qo'shimcha `part` (1-4) ham qaytadi, chunki
 *  o'sha ekran (ListeningPageClient) shu qiymatsiz to'g'ri joyni
 *  avtomatik ocholmaydi.
 *
 *  "BAJARILGAN" DEGANI NIMA (2026-09 tuzatish): avval bitta urinish
 *  (test_results'da qandaydir qator) bo'lsagina "tayyor" deb hisoblab,
 *  keyingi hech qachon urinilmagan testga sakrab ketardi -- shu sabab
 *  foydalanuvchi "chala ishlangan" (band bor, lekin 0 yulduz) testlarni
 *  o'tkazib yuborib, ancha oldinga (masalan 7-testga) tavsiya berib
 *  qo'ygan edi, garchi 4-5-6-testlar hali "tayyor" bo'lmasa ham (band
 *  bor, ammo yulduz 0). Endi "bajarilgan" faqat HAQIQIY yulduz olingan
 *  bo'lsa hisoblanadi (stars > 0) -- shu bilan yulduzsiz/chala testlar
 *  ham tavsiya navbatida qoladi, tartib bo'yicha birinchisi tanlanadi. */
async function getRecommendedRefs(admin: AdminClient, userId: string): Promise<Partial<Record<Category, RecommendedRef>>> {
  const [
    { data: allTests },
    { data: doneResults },
    { data: doneSessions },
    { data: scripts },
    { data: scriptProgressRows },
    { data: articles },
    { data: articleResults },
  ] = await Promise.all([
    admin.from('tests').select('id, type, order_number, description').eq('is_published', true).order('order_number', { ascending: true }),
    admin.from('test_results').select('test_id, stars').eq('user_id', userId),
    admin.from('test_sessions').select('test_id').eq('user_id', userId).eq('status', 'completed'),
    admin.from('scripts').select('id, order_index').eq('is_active', true).order('order_index', { ascending: true }),
    admin.from('script_progress').select('script_id, best_stars').eq('user_id', userId),
    admin.from('articles').select('id, order_index').eq('is_published', true).order('order_index', { ascending: true }),
    admin.from('article_test_results').select('article_id, best_stars').eq('user_id', userId),
  ])

  const refs: Partial<Record<Category, RecommendedRef>> = {}

  function pickNext<T>(list: T[], doneSet: Set<unknown>, keyOf: (item: T) => unknown): T | null {
    return list.find(item => !doneSet.has(keyOf(item))) ?? list[0] ?? null
  }

  const tests = (allTests ?? []) as { id: string; type: string; order_number: number; description: string | null }[]
  const readingTests = tests.filter(t => t.type === 'reading')
  const listeningFullTests = tests.filter(t => t.type === 'listening' && (t.order_number ?? 0) < 1000)
  const sectionTests = tests.filter(t => t.type === 'listening' && (t.order_number ?? 0) >= 1000)

  // Kamida bitta urinishda yulduz olingan bo'lsagina "bajarilgan" --
  // 0 yulduzli (yoki hali umuman baholanmagan) urinish testni hali
  // "tayyor" qilmaydi, shu test yana tavsiya qilinaveradi.
  const doneTestIds = new Set(
    (doneResults ?? []).filter(r => ((r as { stars?: number | null }).stars ?? 0) > 0).map(r => (r as { test_id: string }).test_id),
  )
  const doneSessionIds = new Set((doneSessions ?? []).map(r => (r as { test_id: string }).test_id))

  const readingPick = pickNext(readingTests, doneTestIds, t => t.id)
  if (readingPick) refs.reading = { id: readingPick.id }

  const listeningFullPick = pickNext(listeningFullTests, doneTestIds, t => t.id)
  if (listeningFullPick) refs.listening_full = { id: listeningFullPick.id }

  const sectionPick = pickNext(sectionTests, doneSessionIds, t => t.id)
  if (sectionPick) {
    let part: number | undefined
    try {
      const meta = JSON.parse(sectionPick.description ?? '')
      if (meta?.mode === 'section' && typeof meta.part === 'number') part = meta.part
    } catch { /* ignore */ }
    refs.listening_part = { id: sectionPick.id, part }
  }

  const scriptRows = (scripts ?? []) as { id: number; order_index: number }[]
  const doneScriptIds = new Set(
    (scriptProgressRows ?? []).filter(s => ((s as { best_stars?: number | null }).best_stars ?? 0) > 0).map(s => (s as { script_id: number }).script_id),
  )
  const scriptPick = pickNext(scriptRows, doneScriptIds, s => s.id)
  if (scriptPick) refs.script = { id: String(scriptPick.id) }

  const articleRows = (articles ?? []) as { id: string; order_index: number }[]
  const doneArticleIds = new Set(
    (articleResults ?? []).filter(a => ((a as { best_stars?: number | null }).best_stars ?? 0) > 0).map(a => (a as { article_id: string }).article_id),
  )
  const articlePick = pickNext(articleRows, doneArticleIds, a => a.id)
  if (articlePick) refs.article = { id: articlePick.id }

  return refs
}

/** Guards against a plan row saved under an older schema version (before
 *  target/progress/maxStars existed, or a plain-string-task format) --
 *  such a row would silently divide-by-undefined into NaN everywhere.
 *  Any task missing a required numeric field marks the whole plan stale,
 *  so the caller can drop it and prompt a fresh "Yangi reja tuzish". */
function isValidPlan(days: unknown): days is PlanDay[] {
  if (!Array.isArray(days) || days.length === 0) return false
  return days.every(d =>
    d && typeof d.day === 'number' && typeof d.date === 'string' && Array.isArray(d.tasks) &&
    d.tasks.every((t: unknown) => {
      const task = t as Partial<PlanTask> | null
      return !!task && typeof task.text === 'string' && typeof task.category === 'string' &&
        typeof task.target === 'number' && task.target > 0 &&
        typeof task.progress === 'number' &&
        typeof task.maxStars === 'number' && task.maxStars > 0
    }),
  )
}

/** Feed each category's delta into the progress counter of TODAY's
 *  matching task(s) ONLY -- never an earlier, already-passed day.
 *  Earlier design filled the earliest not-yet-full task across ALL 7
 *  days, which meant activity done today could get silently credited
 *  to yesterday's still-incomplete task instead of today's (exactly
 *  the "bo'lib o'tgan kunga yozilib qolyapti" bug reported). A day
 *  that has passed without being finished simply stays unfinished --
 *  it is not retroactively fillable. Mutates `todayObj` in place. */
function applyCompletions(todayObj: PlanDay | undefined, deltas: CategoryCounts): void {
  if (!todayObj) return
  for (const cat of CATEGORIES) {
    let remaining = deltas[cat]
    if (remaining <= 0) continue
    for (const task of todayObj.tasks) {
      if (remaining <= 0) break
      if (task.category !== cat || task.progress >= task.target) continue
      const room = task.target - task.progress
      const add = Math.min(room, remaining)
      task.progress += add
      remaining -= add
    }
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // AI Study Plan -- faqat premium foydalanuvchilar uchun. Premium
  // bo'lmagan foydalanuvchiga hech qanday haqiqiy reja ma'lumoti
  // (o'zi oldin premium bo'lib reja tuzgan bo'lsa ham) qaytarilmaydi --
  // frontend `locked: true`ni ko'rib, o'sha joyda blur + qulf +
  // "Premiumga o'tish" ko'rinishini chizadi.
  const { data: profileForPremium } = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', user.id)
    .maybeSingle()
  const userPremium = isActivePremium(profileForPremium)
  if (!userPremium) {
    return Response.json({ plan: null, userPremium: false, locked: true })
  }

  const { data: row, error } = await admin
    .from('ai_study_plans')
    .select('id, plan_text, plan_json, daily_minutes, start_date, stars_goal, stars_earned, bonus_awarded, last_synced_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  // 42703 = "column does not exist" -- last_synced_at ustuni hali SQL
  // orqali qo'shilmagan bo'lishi mumkin (eski o'rnatishlarda).
  if (error?.code === '42703') return Response.json({ error: 'DB_MIGRATION_NEEDED' }, { status: 503 })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!row) return Response.json({ plan: null, userPremium: true })

  const rawDays = row.plan_json
  if (!isValidPlan(rawDays)) {
    // Eski sxema davridan qolgan reja -- ko'rsatilsa hamma joyda NaN
    // chiqadi, shuning uchun uni umuman qaytarmaymiz: frontend "reja
    // yo'q" holatini ko'rsatib, to'g'ridan-to'g'ri vaqt tanlash
    // ekranini ochadi (foydalanuvchi darhol yangi reja tuza oladi).
    return Response.json({ plan: null, userPremium: true })
  }
  const days = rawDays
  const sinceISO = (row.last_synced_at as string | null) ?? row.created_at
  const deltas = await getCategoryDeltasSince(admin, user.id, sinceISO)
  const anyDelta = CATEGORIES.some(cat => deltas[cat] > 0)

  // Faqat BUGUNGI kun vazifalariga yoziladi -- o'tib ketgan kun uchun
  // qilingan faollik ham shu bugungi kunga hisoblanadi (o'sha kunning
  // vazifasi tugallanmagan bo'lib qolaveradi, orqaga qaytib to'ldirilmaydi).
  const todayObj = days.find(d => d.date === getTashkentToday())
  if (anyDelta) applyCompletions(todayObj, deltas)
  const starsEarned = sumStars(days)

  let bonusAwarded = row.bonus_awarded ?? false
  let changed = anyDelta

  const starsGoal = row.stars_goal ?? 0
  const bonusStars = bonusStarsFor(row.daily_minutes as number | null)
  if (starsGoal > 0 && starsEarned >= starsGoal && !bonusAwarded && isFinalDayReached(days)) {
    await grantLeaderboardStars(admin, user.id, 'game', bonusStars)
    bonusAwarded = true
    changed = true
  }

  // last_synced_at HAR DOIM (o'zgarish bo'lmasa ham) "hozir"ga
  // suriladi -- aks holda keyingi tekshiruvda xuddi shu vaqt oralig'i
  // qayta hisoblanib, allaqachon qayd etilgan faollik ikki marta
  // sanalib qolishi mumkin edi.
  const nowIso = new Date().toISOString()
  const updatePayload: Record<string, unknown> = { last_synced_at: nowIso }
  if (changed) Object.assign(updatePayload, { plan_json: days, stars_earned: starsEarned, bonus_awarded: bonusAwarded })
  await admin.from('ai_study_plans').update(updatePayload).eq('id', row.id)

  // Tavsiya (recommendedId/Part) HAR SAFAR shu yerda hisoblanadi va
  // faqat javobga qo'shiladi -- saqlangan `days`/plan_json'ga
  // aralashtirilmaydi, aks holda DB'dagi eski qiymat eskirib qolardi.
  const refs = await getRecommendedRefs(admin, user.id)
  const daysWithRefs = days.map(d => ({
    ...d,
    tasks: d.tasks.map(t => ({ ...t, recommendedId: refs[t.category]?.id, recommendedPart: refs[t.category]?.part })),
  }))

  return Response.json({
    plan: { ...row, plan_json: daysWithRefs, stars_earned: starsEarned, bonus_awarded: bonusAwarded, bonus_stars: bonusStars },
    userPremium: true,
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // AI Study Plan faqat premium foydalanuvchilar uchun -- to'g'ridan-
  // to'g'ri API'ga so'rov yuborib bu tekshiruvni chetlab o'tish
  // mumkin bo'lmasin.
  const { data: profileForPremium } = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', user.id)
    .maybeSingle()
  if (!isActivePremium(profileForPremium)) {
    return Response.json({ error: 'Bu funksiya faqat premium foydalanuvchilar uchun mavjud.', code: 'PREMIUM_REQUIRED' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { day, taskIndex } = body as { day?: number; taskIndex?: number }
  if (typeof day !== 'number' || typeof taskIndex !== 'number') {
    return Response.json({ error: 'day va taskIndex kerak' }, { status: 400 })
  }
  const { data: row, error } = await admin
    .from('ai_study_plans')
    .select('id, plan_json, daily_minutes, stars_goal, bonus_awarded')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!row) return Response.json({ error: 'Reja topilmadi' }, { status: 404 })

  const days = (row.plan_json as PlanDay[] | null) ?? []
  const dayObj = days.find(d => d.day === day)
  const task = dayObj?.tasks[taskIndex]
  if (!dayObj || !task) return Response.json({ error: 'Vazifa topilmadi' }, { status: 404 })
  // Faqat qo'lda kuzatib bo'lmaydigan ('general') vazifalar shu yo'l
  // bilan belgilanadi -- boshqalari faqat haqiqiy faollik orqali
  // avtomatik yopiladi (aks holda user o'zi urinmasdan star ololadi).
  if (task.category !== 'general') {
    return Response.json({ error: 'Bu vazifa avtomatik kuzatiladi' }, { status: 400 })
  }

  task.progress = task.progress >= task.target ? 0 : task.target
  const starsEarned = sumStars(days)

  let bonusAwarded = row.bonus_awarded ?? false
  const starsGoal = row.stars_goal ?? 0
  const bonusStars = bonusStarsFor(row.daily_minutes as number | null)
  if (starsGoal > 0 && starsEarned >= starsGoal && !bonusAwarded && isFinalDayReached(days)) {
    await grantLeaderboardStars(admin, user.id, 'game', bonusStars)
    bonusAwarded = true
  }

  await admin
    .from('ai_study_plans')
    .update({ plan_json: days, stars_earned: starsEarned, bonus_awarded: bonusAwarded })
    .eq('id', row.id)

  return Response.json({ plan_json: days, stars_earned: starsEarned, bonus_awarded: bonusAwarded, bonus_stars: bonusStars })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // AI Study Plan faqat premium foydalanuvchilar uchun -- to'g'ridan-
  // to'g'ri API'ga so'rov yuborib bu tekshiruvni chetlab o'tish
  // mumkin bo'lmasin.
  const { data: profileForPremium } = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', user.id)
    .maybeSingle()
  if (!isActivePremium(profileForPremium)) {
    return Response.json({ error: 'Bu funksiya faqat premium foydalanuvchilar uchun mavjud.', code: 'PREMIUM_REQUIRED' }, { status: 403 })
  }

  // 2026-09 o'zgarishi: avval rejim (dailyMinutes) haftada FAQAT BIR
  // MARTA tanlanardi -- joriy reja hali "hafta oxiri"ga yetmagan bo'lsa,
  // yangi reja tuzishga ruxsat berilmasdi. Foydalanuvchi (sayt egasi)
  // buni olib tashlashni so'radi -- endi istalgan vaqtda, hafta
  // tugash-tugamasligidan qat'i nazar, yangi reja/rejim tanlash mumkin.
  // Eski joriy reja qatori bazada qoladi (o'chirilmaydi), shunchaki
  // pastdagi INSERT unga qo'shimcha yangi qator sifatida qo'shiladi va
  // GET/PATCH har doim ENG OXIRGI (created_at bo'yicha) qatorni oladi.

  const body = await request.json().catch(() => ({}))
  const rawMinutes = Number((body as { dailyMinutes?: unknown })?.dailyMinutes)
  // Eng kam variant 60 daqiqa -- to'liq Reading/Listening testining o'zi
  // shuncha vaqt oladi, 15-30 daqiqalik variantlar amalda ishlatib
  // bo'lmaydigan reja yaratardi (masalan 1 soatlik testni 20 daqiqaga
  // sig'diring, degan mantiqsiz vazifa).
  const dailyMinutes = [60, 90, 120, 180].includes(rawMinutes) ? rawMinutes : 60

  const { data: settings } = await admin
    .from('ai_settings')
    .select('study_plan_prompt')
    .eq('id', 'default')
    .maybeSingle()
  const adminPrompt = (settings?.study_plan_prompt as string | undefined)?.trim() || ''

  const [{ data: profile }, counts] = await Promise.all([
    admin.from('profiles').select('full_name, display_name').eq('id', user.id).maybeSingle(),
    getCategoryCounts(admin, user.id),
  ])

  const name =
    (profile as { display_name?: string | null } | null)?.display_name ||
    (profile as { full_name?: string | null } | null)?.full_name ||
    'Talaba'

  const userSummary = [
    `Ism: ${name}`,
    `Reading (to'liq testlar): ${counts.reading} ta topshirilgan`,
    `Listening (to'liq CDI testlar): ${counts.listening_full} ta topshirilgan`,
    `Listening (bo'lim/part mashqlari): ${counts.listening_part} ta bajarilgan`,
    `Script (tinglab yozish/dictation): ${counts.script} ta tugallangan`,
    `Vocabulary puzzle (o'yin): ${counts.vocab} ta daraja tugallangan`,
    `Articles (maqola testlari): ${counts.article} ta maqola bo'yicha test ishlangan`,
    'Typing (tez yozish): aniq statistika yo\'q -- vaqt yetsa umumiy typing mashqini ham rejaga qo\'shing.',
  ].join('\n')

  const startDate = getTashkentToday()
  const dates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))

  // Har bir kunning umumiy vazifa vaqti tushishi kerak bo'lgan oraliq --
  // avval faqat "OSHIB KETMASIN" (bir tomonlama chegara) deyilgan edi,
  // shu sabab AI katta dailyMinutes (masalan 180 daqiqa) tanlanganda ham
  // xavfsiz tomonda qolish uchun atigi 1-2 ta qisqa vazifa qo'yardi --
  // natijada 60 daqiqalik va 180 daqiqalik rejalar deyarli bir xil
  // umumiy yulduz maqsadiga (stars_goal) ega bo'lib chiqardi. Endi
  // ANIQ ORALIQ (past va yuqori chegara) berilgan -- shu bilan AI
  // vaqtni "to'ldirishga" ham majbur qilinadi, nafaqat "oshirmaslikka".
  const minBudget = Math.round(dailyMinutes * 0.85)
  const maxBudget = Math.round(dailyMinutes * 1.1)

  const systemPrompt = [
    'Sen IELTS CDI platformasi uchun shaxsiy 7 kunlik o\'quv reja (study plan) tuzuvchi AI yordamchisan.',
    'Foydalanuvchining barcha ko\'nikmalar (reading, listening -- to\'liq va bo\'lim mashqlari, script/dictation, vocabulary puzzle, articles, typing) bo\'yicha faolligi va natijalariga qarab, kuchsizroq tomonlariga ko\'proq urg\'u berib reja tuz.',
    '\nHar bir mashq turi TAXMINAN qancha vaqt olishini albatta hisobga ol (bular haqiqiy o\'rtacha davomiylik):',
    '- To\'liq Reading test: ~60 daqiqa',
    '- To\'liq Listening (CDI) test: ~35 daqiqa',
    '- Listening bo\'lim/section mashqi: ~10-15 daqiqa',
    '- Script/dictation mashqi: ~15-20 daqiqa (audio qisqa bo\'lsa ham, bir necha marta tinglash + yozish + tekshirish vaqt oladi)',
    '- Vocabulary puzzle: 1 daraja ~5 daqiqa',
    '- Article testi: ~10-15 daqiqa',
    '- Typing mashqi: ~10 daqiqa',
    `\nHar bir kunga tanlangan vazifalarning YUQORIDAGI vaqtlarga asosan hisoblangan UMUMIY vaqti TAXMINAN ${minBudget}-${maxBudget} daqiqa atrofida bo'lsin (foydalanuvchi kuniga ${dailyMinutes} daqiqa ajratadi) -- juda oz (masalan atigi bitta juda qisqa mashq) yoki sezilarli ko'p bo'lib ketmasin.`,
    `- ${dailyMinutes} daqiqa katta son bo'lsa (90+ daqiqa): bitta kunga faqat 1 ta qisqa mashq bilan cheklanma -- kamida 2-3 ta mos hajmdagi vazifa qo'sh (masalan bitta katta test + 1-2 ta qo'shimcha qisqa mashq).`,
    '- MUHIM -- KUNDAN-KUNGA XILMA-XILLIK: 7 kunning har biri BOSHQA-BOSHQA kombinatsiyaga ega bo\'lsin -- ayni bir xil barcha kategoriyalarni (reading+listening+script+vocab+article+typing) har kuni AYNAN takrorlash TAQIQLANADI, bu zerikarli va notabiiy ko\'rinadi. Masalan bir kun Reading+Vocab\'ga, boshqa kun Listening+Script\'ga, yana boshqa kun Article+Vocab\'ga urg\'u ber -- foydalanuvchining eng kuchsiz tomoniga tez-tez qaytib tur, qolganlarini kunlar bo\'yicha navbat bilan taqsimla.',
    'Har bir vazifani qisqa va aniq yoz (masalan: "Reading: 1 ta to\'liq test ishlang", "Vocabulary: 3 ta puzzle darajasini o\'ynang", "Script: 1 ta dictation mashqini qayta ishlang", "Listening: 1 ta bo\'lim mashqi ishlang").',
    'Vazifadagi sonlar taxminiy tavsiya sifatida yoz (aniq bajarilgan/kerak bo\'lgan son emas -- yakuniy natija foydalanuvchi haqiqiy o\'yin/testda olgan yulduziga qarab hisoblanadi): Vocabulary uchun odatda "2-3 ta puzzle darajasini o\'ynang", reading/listening_full/listening_part/script/article uchun odatda "1 ta ... ishlang" deb yoz.',
    'MUHIM: vazifa matni ichiga hech qanday raqamli ball, foiz yoki "51/100" kabi x/y formatidagi ifodalarni QO\'SHMA -- faqat nima qilish kerakligini yoz, avvalgi natija/ball haqida hech narsa yozma.',
    'Har bir vazifaga mos kategoriya tegini ham qo\'sh: "reading", "listening_full" (to\'liq CDI listening test), "listening_part" (bo\'lim/section mashqi), "script", "vocab", "article", yoki "general" (typing yoki boshqa umumiy narsa uchun).',
    adminPrompt ? `\nAdmin tomonidan qo'shimcha ko'rsatma (albatta hisobga ol):\n${adminPrompt}` : '',
    '\nJAVOBNI FAQAT quyidagi JSON formatida qaytar, boshqa hech qanday matn, izoh yoki markdown belgisi qo\'shma:',
    '{"days":[[{"t":"vazifa matni","c":"kategoriya"}, ...], ...jami aynan 7 ta ichki massiv]}',
  ].filter(Boolean).join('\n')

  let raw: string
  try {
    raw = await callOpenRouter(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Mening ma'lumotlarim:\n${userSummary}\n\nShu asosida menga aynan 7 kunlik (bugundan boshlab) study plan tuzib ber, faqat JSON qaytar.` },
      ],
      {
        // 1800 juda kam bo'lib chiqdi -- ba'zi bepul modellar JSON'ni
        // o'rtasida (masalan 7-kunga yetmasdan) kesib qo'yardi, natijada
        // "JSON parse error" (array elementi tugallanmagan) chiqardi.
        // 3200 ham endi kamlik qilishi mumkin -- katta dailyMinutes
        // (120-180+) uchun endi har kunga 2-3 tagacha vazifa talab
        // qilinadi (pastdagi vaqt oralig'i qoidasiga qarang), demak
        // umumiy JSON sezilarli uzunroq bo'ladi.
        maxTokens: 4500,
        // Tez, lekin yaroqsiz/kesilgan JSON qaytargan kandidatni
        // "g'olib" deb qabul qilmaslik uchun -- pastdagi asosiy
        // parslash bilan BIR XIL tekshiruv (parsePlanJSON).
        validate: (content) => parsePlanJSON(content) !== null,
      },
    )
  } catch (e) {
    console.error('[ai-generate] OpenRouter error:', e)
    // Bepul modellarning barchasi bir vaqtda "rate-limited" bo'lib
    // qolishi mumkin (OpenRouter'ning umumiy bepul yuklamasi oshganda) --
    // bu doim ham dasturdagi xatolik emas, ko'pincha 1-2 daqiqada o'zi
    // tuzaladigan vaqtinchalik holat. Xabarni shunga mos aniqroq yozdik.
    const msg = (e as Error)?.message || ''
    const likelyOverload = /429|rate.?limit/i.test(msg)
    const likelyBadFormat = !likelyOverload && /formatsiz|kesilgan/i.test(msg)
    return Response.json({
      error: likelyOverload
        ? 'Bepul AI xizmati hozir band (juda ko\'p so\'rov kelyapti). Iltimos, 1-2 daqiqadan keyin qayta urinib ko\'ring.'
        : likelyBadFormat
        ? 'AI noto\'g\'ri formatda javob qaytardi, qayta urinib ko\'ring.'
        : 'AI xatolik berdi, birozdan keyin qayta urinib ko\'ring.',
    }, { status: 502 })
  }

  const parsedDays = parsePlanJSON(raw)
  if (!parsedDays) console.error('[ai-generate] JSON parse error, raw:', raw.slice(0, 300))

  if (!parsedDays || parsedDays.length === 0) {
    return Response.json({ error: 'AI noto\'g\'ri formatda javob qaytardi, qayta urinib ko\'ring.' }, { status: 502 })
  }

  const days: PlanDay[] = dates.map((date, i) => {
    const rawTasks = (parsedDays![i] ?? []).filter(t => t.t?.trim())
    let tasks: PlanTask[] = rawTasks.map(t => {
      const category = classify(t.t, t.c)
      const maxStars = CATEGORY_MAX[category]
      // STAR_TRACKED kategoriyalarda target = maxStars (progress endi
      // "bajarilgan soni" emas, haqiqiy yig'ilgan yulduz) -- boshqalarida
      // eski "nechta marta bajarilishi kerak" soni ishlatiladi.
      const target = STAR_TRACKED[category] ? maxStars : CATEGORY_TARGET[category]
      // Har bir vazifaga ANIQ va BIR XIL formatdagi davomiylik yorlig'i
      // qo'shiladi (foydalanuvchi so'ragan) -- AI'ning o'zi yozishiga
      // umuman bog'liq emas, shuning uchun har doim bir xil ko'rinadi.
      const text = `${sanitizeTaskText(t.t)} (${CATEGORY_DURATION_LABEL[category]})`
      return { text, category, target, progress: 0, maxStars }
    })
    // AI ko'pincha kunlik vaqt byudjetini to'liq ishlatmaydi (yoki
    // kamdan-kam holda haddan tashqari to'ldiradi) -- shuni deterministik
    // ravishda tuzatamiz, shunda stars_goal HAQIQATDA dailyMinutes'ga
    // qarab o'sadi (model sifatiga qaramay).
    tasks = balanceDayDuration(tasks, dailyMinutes, i)
    return { day: i + 1, date, weekday: weekdayOf(date), tasks }
  })

  const starsGoal = sumStarsMax(days)

  const planText = days
    .map(d => `${d.day}-kun (${d.weekday}, ${d.date}):\n${d.tasks.map(t => `- ${t.text} (maks ${t.maxStars}⭐)`).join('\n')}`)
    .join('\n\n')

  const { data: saved, error: saveError } = await admin
    .from('ai_study_plans')
    .insert({
      user_id: user.id,
      plan_text: planText,
      plan_json: days,
      daily_minutes: dailyMinutes,
      start_date: startDate,
      stars_goal: starsGoal,
      stars_earned: 0,
      bonus_awarded: false,
      last_synced_at: new Date().toISOString(),
      model: 'openrouter',
    })
    .select('id, plan_text, plan_json, daily_minutes, start_date, stars_goal, stars_earned, bonus_awarded, created_at')
    .single()

  if (saveError?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (saveError) return Response.json({ error: saveError.message }, { status: 500 })

  // Yangi tuzilgan reja uchun ham tavsiyalarni shu yerda qo'shamiz --
  // GET'dagi bilan bir xil mantiq (DB'ga yozilmaydi, faqat javobga).
  const refs = await getRecommendedRefs(admin, user.id)
  const savedDays = (saved?.plan_json as PlanDay[] | null) ?? days
  const daysWithRefs = savedDays.map(d => ({
    ...d,
    tasks: d.tasks.map(t => ({ ...t, recommendedId: refs[t.category]?.id, recommendedPart: refs[t.category]?.part })),
  }))

  return Response.json({ plan: { ...saved, plan_json: daysWithRefs, bonus_stars: bonusStarsFor(dailyMinutes) } })
}

function sumStarsMax(days: PlanDay[]): number {
  return days.reduce((sum, d) => sum + d.tasks.reduce((s, t) => s + t.maxStars, 0), 0)
}
