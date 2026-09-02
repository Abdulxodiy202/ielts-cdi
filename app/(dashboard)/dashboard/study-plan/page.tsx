'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Sparkles, Loader2, RefreshCw, Clock,
  BookOpen, Headphones, FileText, Gamepad2, Newspaper, Keyboard,
  Star, Check, PartyPopper, ArrowUpRight, Lock,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { getTashkentToday } from '@/lib/utils/date'
import { CompletionChart } from '@/components/study-plan/CompletionChart'
import { fireCelebrationConfetti } from '@/lib/confetti'

// PaymentModal faqat qulf ekranida "Premiumga o'tish" bosilganda kerak
// bo'ladi -- boshqa premium-gated sahifalardagi kabi dynamic import
// bilan boshlang'ich bundle'dan chiqarib qo'yamiz.
const PaymentModal = dynamic(() => import('@/components/PaymentModal').then(m => ({ default: m.PaymentModal })), { ssr: false })

// AI Study Plan -- admin panelda yozilgan ko'rsatma + foydalanuvchining
// barcha ko'nikmalar bo'yicha faolligi asosida OpenRouter orqali 7
// kunlik (generatsiya qilingan kundan boshlab) shaxsiy reja tuziladi.
//
// Har bir vazifa UCH holatda bo'ladi: boshlanmagan / yarim bajarilgan
// (chala) / to'liq tugallangan -- bu server tomonidan haqiqiy faollik
// asosida hisoblanadigan `progress`/`target` juftligidan kelib chiqadi
// (faqat 'general', ya'ni typing kabi kuzatib bo'lmaydigan vazifalar
// qo'lda belgilanadi). Har bir vazifaning o'z maksimal yulduzi bor
// (kategoriyaga qarab -- reading/listening=15, script/article=10,
// vocab/general=5) va shu maksimalga yetganda yulduz kattaroq va
// yolqinroq (glow) ko'rinishda chiqadi.
//
// Sahifa yuqorisida haftalik bajarish foizining kundan-kunga
// o'zgarishini ko'rsatuvchi chiziqli grafik bor -- grafikdagi istalgan
// kunni bosish o'sha kunning vazifalar ro'yxatini pastda ochadi.

// Eng kam variant 1 soat -- to'liq Reading/Listening testining o'zi
// shuncha vaqt oladi, undan qisqa variantlar amalda bajarib
// bo'lmaydigan reja yaratardi.
const TIME_OPTIONS = [
  { minutes: 60, label: '1 soat' },
  { minutes: 90, label: '1.5 soat' },
  { minutes: 120, label: '2 soat' },
  { minutes: 180, label: '3+ soat' },
] as const

type Category = 'reading' | 'listening_full' | 'listening_part' | 'script' | 'vocab' | 'article' | 'general'

const CATEGORY_ICON: Record<Category, typeof BookOpen> = {
  reading: BookOpen,
  listening_full: Headphones,
  listening_part: Headphones,
  script: FileText,
  vocab: Gamepad2,
  article: Newspaper,
  general: Keyboard,
}

// Har bir vazifa qaysi bo'limga tegishli bo'lsa, aynan o'sha bo'limning
// test ro'yxati sahifasiga olib boradi (real Next.js marshrutlariga mos
// -- konkret test ID vazifa matnida bo'lmagani uchun ro'yxat sahifasiga
// olib boramiz, u yerda foydalanuvchi natijalari allaqachon ko'rinadi).
const CATEGORY_ROUTE: Record<Category, string> = {
  reading: '/reading',
  listening_full: '/listening/full',
  listening_part: '/listening',
  script: '/listening/script',
  vocab: '/vocabulary/games',
  article: '/articles',
  general: '/typing',
}

interface PlanTask {
  text: string
  category: Category
  target: number
  progress: number
  maxStars: number
  // Server har safar (GET/POST javobida) "aynan shuni ishlang" deb
  // hisoblab beradigan tavsiya -- DB'da saqlanmaydi (har doim yangi
  // hisoblanadi), shuning uchun bu ikkalasi ham ixtiyoriy. listening_part
  // uchun `recommendedPart` ham keladi (o'sha ekran 3 bosqichli bo'lgani
  // uchun to'g'ri Part'ni ham avtomatik ochish kerak).
  recommendedId?: string
  recommendedPart?: number
}

interface PlanDay {
  day: number
  date: string
  weekday: string
  tasks: PlanTask[]
}

interface AiPlan {
  id: string
  plan_json: PlanDay[] | null
  daily_minutes: number | null
  start_date: string | null
  stars_goal: number | null
  stars_earned: number | null
  bonus_awarded: boolean | null
  // Server hisoblab beradigan bonus miqdori (dailyMinutes'ga qarab
  // 100/150/200/300) -- badge va tabrik xabarida ko'rsatish uchun.
  bonus_stars?: number | null
  created_at: string
}

// Vazifaning joriy holatidan kelib chiqib ulushli yulduz -- backenddagi
// taskStars() bilan bir xil formula (faqat ko'rsatish uchun, server har
// doim o'zi qayta hisoblab saqlaydi).
function taskStars(task: PlanTask): number {
  if (task.target <= 0) return 0
  return Math.min(task.maxStars, Math.round((task.progress / task.target) * task.maxStars))
}

// Vazifa qatoridagi "bo'limga o'tish" tugmasi endi shunchaki ro'yxat
// sahifasiga emas, balki server tanlab bergan ANIQ testga (?highlight=)
// olib boradi -- listening_part uchun kerakli Part'ni ham (&part=)
// avtomatik ochish uchun. `fromPlan=true` HAR DOIM qo'shiladi -- shu
// bilan o'sha bo'lim sahifasida "Study Plan'ga qaytish" tugmasi FAQAT
// shu yerdan o'tilganda ko'rinadi (sidebar orqali kirilganda emas).
function taskHref(task: PlanTask): string {
  const base = CATEGORY_ROUTE[task.category]
  const params = new URLSearchParams({ fromPlan: 'true' })
  if (task.recommendedId) {
    params.set('highlight', task.recommendedId)
    if (task.category === 'listening_part' && task.recommendedPart) {
      params.set('part', String(task.recommendedPart))
    }
  }
  return `${base}?${params.toString()}`
}

function dayPercent(day: PlanDay): number {
  const maxSum = day.tasks.reduce((s, t) => s + t.maxStars, 0)
  if (maxSum <= 0) return 0
  const earnSum = day.tasks.reduce((s, t) => s + taskStars(t), 0)
  return Math.round((earnSum / maxSum) * 100)
}

// Har bir vazifa uchun 3 holatli aylana ko'rsatkich: bo'sh halqa +
// xira ikonka (boshlanmagan), qisman to'lgan halqa + accent ikonka
// (chala), yashil doira + tik belgisi (tugallangan).
function TaskStateIcon({ task, size = 26 }: { task: PlanTask; size?: number }) {
  const Icon = CATEGORY_ICON[task.category] ?? Keyboard
  const isDone = task.progress >= task.target && task.target > 0
  const pct = task.target > 0 ? Math.min(1, task.progress / task.target) : 0

  if (isDone) {
    return (
      <motion.div
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Check size={size * 0.55} color="#fff" />
      </motion.div>
    )
  }

  const r = (size - 4) / 2
  const circumference = 2 * Math.PI * r
  const dash = circumference * pct

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        {pct > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--accent)" strokeWidth={2.5}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={size * 0.45} style={{ color: pct > 0 ? 'var(--accent)' : 'var(--text-muted)' }} />
      </div>
    </div>
  )
}

// Yulduz ko'rsatkichi -- kategoriya maksimaliga yetganda kattaroq
// o'lcham + yolqin (glow) soyasi + sekin "nafas olish" animatsiyasi.
function TaskStars({ task }: { task: PlanTask }) {
  const stars = taskStars(task)
  const maxed = task.maxStars > 0 && stars === task.maxStars
  return (
    <motion.span
      animate={maxed ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={maxed ? { duration: 1.6, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' } : { duration: 0.2 }}
      className="flex items-center gap-0.5 shrink-0 font-bold"
      style={{
        color: '#f59e0b',
        fontSize: maxed ? 13 : 11,
        filter: maxed ? 'drop-shadow(0 0 6px rgba(245,158,11,0.85))' : 'none',
      }}
    >
      {stars}<Star size={maxed ? 15 : 11} fill="#f59e0b" stroke="#f59e0b" />
    </motion.span>
  )
}

// Premium bo'lmagan foydalanuvchi uchun qulf ekrani -- video-lessons
// sahifasidagi bilan bir xil uslub: blur qilingan (haqiqiy emas,
// shunchaki "shunday ko'rinadi" degan) namunaviy kontent orqa fonda,
// ustida qulf ikonkasi + tushuntirish matni + "Premiumga o'tish" tugmasi.
function PremiumLockedView({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="rounded-3xl overflow-hidden relative" style={{ border: '1px solid var(--border)', minHeight: 460 }}>
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }} className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="h-3 w-40 rounded-full" style={{ background: 'var(--bg-secondary)' }} />
          <div className="h-8 w-36 rounded-xl" style={{ background: 'var(--accent)' }} />
        </div>
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="h-3 w-28 rounded-full" style={{ background: 'var(--bg-secondary)' }} />
            <div className="h-3 w-16 rounded-full" style={{ background: 'var(--bg-secondary)' }} />
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
            <div className="h-full rounded-full" style={{ width: '62%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
          </div>
        </div>
        {/* Namunaviy CHIZIQLI grafik -- haqiqiy CompletionChart bilan bir
            xil uslub (gradient fon ostida, dumaloq uchli chiziq,
            gridlaynlar, nuqtalar), lekin statik/fabricated ma'lumot
            bilan -- haqiqiy funksiya bar-chart emas, line chart bo'lgani
            uchun blur ortidagi namuna ham shunga mos bo'lishi kerak. */}
        <div className="mb-5">
          <svg viewBox="0 0 280 90" width="100%" height={90} style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="fakePlanGradPage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 45, 90].map(y => (
              <line key={y} x1={0} x2={280} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />
            ))}
            <path
              d="M 0 90 L 0 52 L 46.7 34.5 L 93.3 59 L 140 24 L 186.7 41.5 L 233.3 17 L 280 48.5 L 280 90 Z"
              fill="url(#fakePlanGradPage)"
              stroke="none"
            />
            <path
              d="M 0 52 L 46.7 34.5 L 93.3 59 L 140 24 L 186.7 41.5 L 233.3 17 L 280 48.5"
              fill="none"
              stroke="var(--accent)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {[[0, 52], [46.7, 34.5], [93.3, 59], [140, 24], [186.7, 41.5], [233.3, 17], [280, 48.5]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={4} fill="var(--bg-card)" stroke="var(--accent)" strokeWidth={2.5} />
            ))}
          </svg>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
              <div className="w-6 h-6 rounded-full shrink-0" style={{ background: 'var(--border)' }} />
              <div className="h-3 flex-1 rounded-full" style={{ background: 'var(--border)' }} />
              <div className="h-3 w-8 rounded-full shrink-0" style={{ background: 'var(--border)' }} />
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center gap-4 p-6"
        style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.6), rgba(245,158,11,0.25))' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.45)' }}
        >
          <Lock size={28} style={{ color: '#fbbf24' }} />
        </div>
        <div>
          <p className="text-lg font-bold mb-1" style={{ color: '#fff' }}>AI Study Plan — Premium funksiya</p>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Sun&apos;iy intellekt tomonidan tuzilgan shaxsiy haftalik o&apos;quv reja faqat premium foydalanuvchilar uchun mavjud.
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-transform hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', boxShadow: '0 8px 24px rgba(245,158,11,0.4)' }}
        >
          👑 Premiumga o&apos;tish
        </button>
      </div>
    </div>
  )
}

export default function StudyPlanPage() {
  const { t } = useLanguage()
  const [plan, setPlan] = useState<AiPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [choosingTime, setChoosingTime] = useState(false)
  const [generating, setGenerating] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  // AI Study Plan faqat premium foydalanuvchilar uchun. `null` = hali
  // aniqlanmagan (dastlabki yuklash tugamagan), shu bilan premium
  // bo'lmagan foydalanuvchiga bir zumga haqiqiy kontent "yaltirab"
  // ko'rinib qolmaydi (loading holati tugagach darhol qulf ekrani
  // chiqadi).
  const [userPremium, setUserPremium] = useState<boolean | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  // Faqat confetti'ni BIR MARTA (haqiqiy o'tish onida) otish uchun
  // trigger -- banner o'zi ENDI bunga bog'liq emas (pastga qarang),
  // shuning uchun avtomatik "false"ga qaytarilmaydi.
  const [justCelebrated, setJustCelebrated] = useState(false)
  // Tabrik xabarida ko'rsatiladigan aniq bonus miqdori -- kunlik
  // vaqtga qarab 100/150/200/300 farqlanadi, shuning uchun har safar
  // bonus YANGI berilganda serverdan kelgan qiymat shu yerga yoziladi.
  // Banner har doim `plan.bonus_stars`ni to'g'ridan-to'g'ri ko'rsatadi
  // (pastga qarang) -- alohida state kerak emas, chunki bu qiymat
  // sahifa YANGI ochilganda ham (transition kuzatilmagan holatda ham)
  // to'g'ri bo'lishi kerak.
  // Script/Vocabulary puzzle natija ekranlaridagi kabi confetti otish
  // uchun -- banner shu elementga bog'lanadi, portlash undan pastroqda
  // chiqadi (fireCelebrationConfetti(anchor) shu logikani o'zi qiladi).
  const celebrationRef = useRef<HTMLDivElement>(null)
  // Sahifa ochilgandagi ENG BIRINCHI yuklashni belgilaydi -- agar
  // `bonus_awarded` o'sha birinchi yuklashdayoq true bo'lib chiqsa,
  // bu ESKI (oldingi seansda allaqachon berilgan) natija, YANGI voqea
  // emas -- shuning uchun confetti faqat KEYINGI (haqiqiy real-vaqt)
  // o'tishlarda otiladi, har safar sahifa ochilganda emas.
  const initialLoadRef = useRef(false)

  useEffect(() => {
    if (!justCelebrated) return
    requestAnimationFrame(() => fireCelebrationConfetti(celebrationRef.current))
  }, [justCelebrated])

  // Toshkent kalendariga bog'langan -- oddiy `new Date().toISOString()`
  // UTC beradi va Toshkent yarim tunidan keyingi soatlarda bir kun
  // orqada qolib, "bugun" noto'g'ri kunni ko'rsatishi mumkin edi.
  const todayStr = getTashkentToday()

  function pickDefaultDay(days: PlanDay[]) {
    const todayDay = days.find(d => d.date === todayStr)
    setSelectedDay(todayDay ? todayDay.day : (days[0]?.day ?? 1))
  }

  async function loadPlan() {
    setLoading(true)
    try {
      const res = await fetch('/api/study-plan/ai-generate')
      const data = await res.json()
      if (res.ok) {
        setUserPremium(data.userPremium !== false)
        const p = data.plan ?? null
        // Bonus odatda AYNAN shu yerda (GET -- sahifaga qaytilganda,
        // haqiqiy test/mashq faolligi sinxronlanganda) birinchi marta
        // beriladi, PATCH orqali emas -- shuning uchun confetti trigger
        // ham shu yerda, oldingi holat bilan solishtirib aniqlanadi.
        // LEKIN sahifa ENG BIRINCHI ochilganda `prev` hali `null`
        // bo'lgani uchun bu solishtiruv ishonchsiz (har doim "yangi
        // o'tish" deb ko'rsatardi, garchi bonus allaqachon oldin
        // berilgan bo'lsa ham) -- shu sabab birinchi yuklashda
        // confetti tekshiruvi UMUMAN o'tkazib yuboriladi.
        if (!initialLoadRef.current) {
          initialLoadRef.current = true
          setPlan(p)
        } else {
          setPlan(prev => {
            const wasAwarded = prev?.bonus_awarded ?? false
            if (!wasAwarded && p?.bonus_awarded) {
              setJustCelebrated(true)
            }
            return p
          })
        }
        if (p?.plan_json) pickDefaultDay(p.plan_json as PlanDay[])
      }
    } catch {
      // best-effort -- bo'sh holat ko'rsatiladi, keyinroq "Rejamni tuzish" bosilishi mumkin
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPlan() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate(dailyMinutes: number) {
    setGenerating(dailyMinutes)
    setError(null)
    try {
      const res = await fetch('/api/study-plan/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyMinutes }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Xatolik yuz berdi, qayta urinib ko\'ring.')
      } else {
        setPlan(data.plan)
        setChoosingTime(false)
        if (data.plan?.plan_json) pickDefaultDay(data.plan.plan_json as PlanDay[])
      }
    } catch {
      setError('Xatolik yuz berdi, qayta urinib ko\'ring.')
    } finally {
      setGenerating(null)
    }
  }

  async function toggleTask(day: number, taskIndex: number) {
    const key = `${day}-${taskIndex}`
    setTogglingKey(key)
    try {
      const res = await fetch('/api/study-plan/ai-generate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, taskIndex }),
      })
      const data = await res.json()
      if (res.ok && plan) {
        const wasAwarded = plan.bonus_awarded
        setPlan({ ...plan, plan_json: data.plan_json, stars_earned: data.stars_earned, bonus_awarded: data.bonus_awarded, bonus_stars: data.bonus_stars })
        if (!wasAwarded && data.bonus_awarded) {
          setJustCelebrated(true)
        }
      }
    } catch {
      // best-effort
    } finally {
      setTogglingKey(null)
    }
  }

  const days = plan?.plan_json ?? []
  const starsGoal = plan?.stars_goal ?? 0
  const starsEarned = plan?.stars_earned ?? 0
  const pct = starsGoal > 0 ? Math.min(100, Math.round((starsEarned / starsGoal) * 100)) : 0
  const currentDay = days.find(d => d.day === selectedDay) ?? days[0] ?? null
  const isCurrentToday = currentDay?.date === todayStr

  // Rejim (kunlik daqiqa) haftada FAQAT BIR MARTA tanlanadi -- joriy
  // reja hali oxirgi kuniga yetmagan bo'lsa, "Yangi reja tuzish" tugmasi
  // UMUMAN ko'rsatilmaydi (backend ham xuddi shu qoidani mustaqil
  // tekshiradi -- bu yerdagi tekshiruv faqat UI uchun). Sana solishtirish
  // ISO ("YYYY-MM-DD") formatda bo'lgani uchun oddiy satr solishtirish
  // yetarli (backenddagi isFinalDayReached() bilan bir xil mantiq).
  const lastDay = days[days.length - 1] ?? null
  const weekFinished = !lastDay || todayStr >= lastDay.date
  const canChangeRegime = !plan || weekFinished
  const showTimePicker = !plan || (choosingTime && canChangeRegime)

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={14} /> {t('settingsPage.backHome')}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Sparkles size={22} style={{ color: 'var(--accent)' }} /> {t('dashboard.studyPlanTitle')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Barcha bo&apos;limlardagi natijalaringiz asosida sun&apos;iy intellekt tomonidan tuzilgan 7 kunlik shaxsiy o&apos;quv reja.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Yuklanmoqda...
        </div>
      ) : userPremium === false ? (
        <PremiumLockedView onUpgrade={() => setShowPaymentModal(true)} />
      ) : (
        <div className="space-y-5">
          <AnimatePresence>
            {/* Banner endi `plan.bonus_awarded`ga (DB'dagi doimiy holat)
                bog'langan, o'tkinchi `justCelebrated`ga emas -- shu
                bilan sahifani yangilab qayta ochsangiz ham (yoki
                ertasi kuni qaytib kirsangiz ham) YANGI reja
                tuzilmaguncha ko'rinib turadi, 4 soniyada g'oyib
                bo'lib qolmaydi. */}
            {plan?.bonus_awarded && (
              // Script/Vocabulary puzzle natija ekranlarining "5 yulduz"
              // nishonlash uslubiga moslashtirildi (katta emoji/sarlavha,
              // to'la yulduz qatori, confetti) -- avvalgi bitta qatorli
              // xira banner "juda ham oddiy" edi, endi butun haftani
              // 100% yakunlash haqiqatan ham katta yutuq sifatida
              // ko'rsatiladi.
              <motion.div
                ref={celebrationRef}
                initial={{ opacity: 0, y: -16, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="rounded-3xl p-6 md:p-8 text-center relative overflow-hidden"
                style={{
                  position: 'relative',
                  zIndex: 1000,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706 55%, #b45309)',
                  color: '#fff',
                  boxShadow: '0 10px 34px rgba(245,158,11,0.4)',
                }}
              >
                <div
                  className="text-5xl mb-2"
                  style={{ filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.5))', animation: 'planCelebrationBounce 0.5s ease-out' }}
                >
                  🏆
                </div>
                <div className="text-xl md:text-2xl font-black mb-3">
                  Ajoyib! Haftalik shaxsiy o&apos;quv rejangizni 100% muvaffaqiyatli yakunladingiz!
                </div>
                <div className="flex items-center justify-center gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={26} fill="#fff" style={{ color: '#fff' }} />
                  ))}
                </div>
                <div
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-base md:text-lg"
                  style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.4)' }}
                >
                  <PartyPopper size={20} /> +{plan?.bonus_stars ?? 100} bonus yulduz taqdim etildi
                </div>
                <style>{`
                  @keyframes planCelebrationBounce {
                    0% { transform: scale(0.6); opacity: 0; }
                    60% { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                  }
                `}</style>
              </motion.div>
            )}
          </AnimatePresence>

          {plan && !showTimePicker && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="rounded-3xl p-5 md:p-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {plan.daily_minutes ? `Kuniga ~${plan.daily_minutes} daqiqa hisobida tuzilgan` : ''}
                  {plan.start_date ? ` · ${plan.start_date} kunidan boshlanadi` : ''}
                </p>
                {/* Rejim haftada faqat bir marta tanlanadi -- hafta hali
                    tugamagan bo'lsa tugma o'rniga qachon ochilishini
                    ko'rsatuvchi qulflangan yorliq chiqadi, hafta
                    tugagach (lastDay.date yetib kelgach) esa aniq
                    "Yangi hafta" tugmasiga almashadi. */}
                {canChangeRegime ? (
                  <button
                    onClick={() => setChoosingTime(true)}
                    className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    <RefreshCw size={12} /> Yangi hafta uchun rejim tanlash
                  </button>
                ) : (
                  <span
                    className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    title="Rejimni faqat joriy hafta tugagach o'zgartirish mumkin"
                  >
                    🔒 Rejim {lastDay?.date} dan keyin o&apos;zgaradi
                  </span>
                )}
              </div>

              {starsGoal > 0 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Star size={13} fill="#f59e0b" stroke="#f59e0b" /> Haftalik maqsad
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {starsEarned} / {starsGoal} ⭐{plan.bonus_awarded ? ` · +${plan.bonus_stars ?? 100} bonus olingan` : ''}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}

              <div className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Kunlik bajarish foizi -- kunni tanlash uchun bosing
              </div>
              <CompletionChart days={days} selectedDay={selectedDay} todayStr={todayStr} onSelect={setSelectedDay} />

              {currentDay && (
                <motion.div
                  key={currentDay.day}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4"
                >
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: isCurrentToday ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {currentDay.day}-kun · {currentDay.weekday}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{currentDay.date}</span>
                    {isCurrentToday && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>
                        Bugun
                      </span>
                    )}
                    <span className="text-xs font-semibold ml-auto" style={{ color: 'var(--text-muted)' }}>
                      {dayPercent(currentDay)}% bajarilgan
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {currentDay.tasks.length === 0 && (
                      <li className="text-xs p-3 rounded-xl" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                        Bu kunga vazifa yo&apos;q.
                      </li>
                    )}
                    {currentDay.tasks.map((task, i) => {
                      const clickable = task.category === 'general'
                      const key = `${currentDay.day}-${i}`
                      const isDone = task.progress >= task.target && task.target > 0
                      const isPartial = !isDone && task.progress > 0
                      return (
                        <li
                          key={i}
                          onClick={() => clickable && !togglingKey && toggleTask(currentDay.day, i)}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl"
                          style={{
                            background: 'var(--bg-secondary)',
                            cursor: clickable ? 'pointer' : 'default',
                            opacity: isDone ? 0.75 : 1,
                          }}
                        >
                          {togglingKey === key ? (
                            <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          ) : (
                            <TaskStateIcon task={task} />
                          )}
                          <span
                            className="text-sm flex-1"
                            style={{
                              color: 'var(--text-secondary)',
                              textDecoration: isDone ? 'line-through' : 'none',
                            }}
                          >
                            {task.text}
                            {isPartial && (
                              <span className="ml-1.5 text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
                                · chala ({task.progress}/{task.target})
                              </span>
                            )}
                          </span>
                          <TaskStars task={task} />
                          <Link
                            href={taskHref(task)}
                            onClick={e => e.stopPropagation()}
                            title="Bo'limga o'tish"
                            className="shrink-0 p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                            style={{ background: 'var(--bg-card)', color: 'var(--accent)' }}
                          >
                            <ArrowUpRight size={14} />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </motion.div>
              )}
            </motion.div>
          )}

          {showTimePicker && (
            <motion.div
              key="time-picker"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="rounded-3xl p-6 md:p-8 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <motion.div
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 10px 30px rgba(99,102,241,0.35)' }}
              >
                <Clock size={30} className="text-white" />
              </motion.div>
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Kuniga qancha vaqt ajrata olasiz?
              </h2>
              <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
                Shunga qarab sizga 7 kunlik reja va yulduz maqsadi tuzib beramiz -- bugundan boshlab.
              </p>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                {TIME_OPTIONS.map(opt => (
                  <motion.button
                    key={opt.minutes}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleGenerate(opt.minutes)}
                    disabled={generating !== null}
                    className="rounded-2xl py-4 px-3 text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    {generating === opt.minutes
                      ? <Loader2 size={16} className="animate-spin mx-auto" />
                      : opt.label}
                  </motion.button>
                ))}
              </div>

              {plan && (
                <button
                  onClick={() => setChoosingTime(false)}
                  disabled={generating !== null}
                  className="mt-5 text-xs hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Bekor qilish
                </button>
              )}
            </motion.div>
          )}

          {error && <p className="text-xs" style={{ color: 'var(--error)' }}>❌ {error}</p>}
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal
          isOpen
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { setShowPaymentModal(false); loadPlan() }}
          type="premium"
          amount={50000}
        />
      )}
    </div>
  )
}
