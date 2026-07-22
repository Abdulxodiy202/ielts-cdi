'use client'

import { useCallback, useEffect, useState, startTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, Check,
  BookOpen, Headphones, Mic, FileText, Video, GraduationCap,
  Flame, Gift, Settings, RotateCcw, Lock, Crown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'

// Study Plan sahifasi -- gradient bento grid, per-test kartalar,
// framer-motion animatsiyalari. Free/premium tier boyicha ajratilgan:
// free user daily_free bilan chegaralanadi (weekly UI tegilmaydi),
// premium hozircha xuddi shu template ustida ishlaydi + amber banner.

interface StudyPlan {
  id: string
  user_id: string
  mode: 'daily_free' | 'daily_free_locked' | 'daily' | 'weekly'
  period_start: string
  period_end: string
  reading_test_ids: string[] | null
  listening_test_ids: string[] | null
  script_target: number
  vocab_target: number
  article_target: number
  video_target: number
  reading_completed: number
  listening_completed: number
  script_completed: number
  vocab_completed: number
  article_completed: number
  video_completed: number
  is_completed: boolean
  bonus_awarded: boolean
  created_at: string
  completed_at: string | null
}

interface StreakRow { current_streak: number; longest_streak: number }
interface BonusRow {
  id: string
  milestone: number | null
  points_awarded: number
  streak_type: string
  awarded_at: string
}
interface TestInfo { id: string; title: string }

const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr']
const UZ_WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']

function fmtDateUz(dateStr: string): string {
  const d = new Date(dateStr)
  const wd = UZ_WEEKDAYS[d.getDay()]
  const wdCap = wd.charAt(0).toUpperCase() + wd.slice(1)
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${wdCap}`
}
function fmtShortUz(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}`
}

// Kategoriya rangi paleti -- spec dagi Tailwind gradient qiymatlariga
// yaqin, lekin har karta uchun bir joyda ushlab turish uchun massivda.
const CATEGORY_STYLE = {
  reading:   { grad: 'linear-gradient(135deg, rgba(59,130,246,0.20), rgba(37,99,235,0.06))', border: 'rgba(59,130,246,0.35)', icon: '#60A5FA' },
  listening: { grad: 'linear-gradient(135deg, rgba(168,85,247,0.20), rgba(126,34,206,0.06))', border: 'rgba(168,85,247,0.35)', icon: '#C084FC' },
  script:    { grad: 'linear-gradient(135deg, rgba(234,179,8,0.20), rgba(202,138,4,0.06))',  border: 'rgba(234,179,8,0.35)', icon: '#FACC15' },
  article:   { grad: 'linear-gradient(135deg, rgba(249,115,22,0.20), rgba(234,88,12,0.06))', border: 'rgba(249,115,22,0.35)', icon: '#FB923C' },
  video:     { grad: 'linear-gradient(135deg, rgba(239,68,68,0.20), rgba(220,38,38,0.06))',  border: 'rgba(239,68,68,0.35)', icon: '#F87171' },
  vocab:     { grad: 'linear-gradient(135deg, rgba(34,197,94,0.20), rgba(22,163,74,0.06))',  border: 'rgba(34,197,94,0.35)', icon: '#4ADE80' },
  locked:    { grad: 'linear-gradient(135deg, rgba(245,158,11,0.20), rgba(217,119,6,0.06))', border: 'rgba(245,158,11,0.35)', icon: '#F59E0B' },
} as const

// ── Bugungi plan olish (free = faqat daily_free / daily_free_locked) ──
async function fetchTodayPlan(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  isFree: boolean,
): Promise<StudyPlan | null> {
  const today = new Date().toISOString().split('T')[0]
  const modes = isFree
    ? ['daily_free', 'daily_free_locked']
    : ['daily', 'weekly', 'daily_free', 'daily_free_locked']
  const { data } = await supabase
    .from('user_study_plans')
    .select('*')
    .eq('user_id', userId)
    .in('mode', modes)
    .eq('period_start', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as StudyPlan | null) ?? null
}

// ── Vazifa kartasi (component tashqarisida -- render pas'ida qayta
//    yaratish React 19'da xatolik hisoblanadi) ──
interface TaskCardProps {
  palette: keyof typeof CATEGORY_STYLE
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  title: string
  subtitle?: string
  progressText?: string
  done: boolean
  href: string
  delay: number
}
function TaskCard({ palette, icon: Icon, title, subtitle, progressText, done, href, delay }: TaskCardProps) {
  const style = CATEGORY_STYLE[palette]
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={done ? undefined : { scale: 1.02 }}
      className="rounded-2xl p-5 md:p-6 flex flex-col h-full transition-all"
      style={{
        background: style.grad,
        border: done ? '1px solid rgba(34,197,94,0.5)' : `1px solid ${style.border}`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <Icon size={22} style={{ color: style.icon }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          {subtitle && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
          )}
        </div>
      </div>
      {progressText && (
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{progressText}</p>
      )}
      {done ? (
        <span
          className="mt-auto inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)' }}
        >
          <Check size={15} /> Bajarilgan
        </span>
      ) : (
        <Link
          href={href}
          className="mt-auto inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: style.icon }}
        >
          Boshlash <ChevronRight size={15} />
        </Link>
      )}
    </motion.div>
  )
}

// ── Toast helper (kichik state) ──
function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const show = useCallback((m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 3000)
  }, [])
  return { msg, show }
}

export default function StudyPlanPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [dailyEnabled, setDailyEnabled] = useState(false)
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [streak, setStreak] = useState<StreakRow | null>(null)
  const [bonuses, setBonuses] = useState<BonusRow[]>([])
  const [testTitles, setTestTitles] = useState<Record<string, string>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [autoTried, setAutoTried] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Profil oldindan -- keyingi so'rovlarni free/premium ga qarab
    // shakllantirish uchun.
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('is_premium, premium_until, daily_plan_enabled')
      .eq('id', user.id)
      .single()
    const premium = isActivePremium(profileRow)
    const enabled = Boolean((profileRow as { daily_plan_enabled?: boolean } | null)?.daily_plan_enabled)
    setIsPremium(premium)
    setDailyEnabled(enabled)

    // Bugungi plan (free faqat daily_free* rejimlariga qaraydi).
    let today = await fetchTodayPlan(supabase, user.id, !premium)

    // Toggle yoqilgan, lekin bugungi qator hali yaratilmagan bo'lsa,
    // birinchi ochilishda avtomatik generate qilishga urinamiz.
    // autoTried guard qayta-qayta chaqirilmaslikni ta'minlaydi.
    if (enabled && !today && !autoTried) {
      setAutoTried(true)
      const rpcName = premium ? 'generate_plan_for_user' : 'generate_free_daily_plan'
      const { error: genErr } = await supabase.rpc(rpcName, { p_user_id: user.id })
      if (!genErr) today = await fetchTodayPlan(supabase, user.id, !premium)
      else console.error('[study-plan] auto-generate failed:', genErr.message)
    }
    setPlan(today)

    // Streak + bonuslar (parallel).
    const [streakRes, bonusesRes] = await Promise.all([
      supabase.from('user_login_streak').select('current_streak, longest_streak').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_streak_bonuses').select('id, milestone, points_awarded, streak_type, awarded_at').eq('user_id', user.id).order('awarded_at', { ascending: false }).limit(3),
    ])
    setStreak((streakRes.data as StreakRow | null) ?? null)
    setBonuses((bonusesRes.data as BonusRow[] | null) ?? [])

    // Test title'larni ID lardan olib kelamiz.
    if (today) {
      const ids = [...(today.reading_test_ids ?? []), ...(today.listening_test_ids ?? [])]
      if (ids.length > 0) {
        const { data: testsRes } = await supabase.from('tests').select('id, title').in('id', ids)
        const titles: Record<string, string> = {}
        for (const t of ((testsRes as TestInfo[] | null) ?? [])) titles[t.id] = t.title
        setTestTitles(titles)
      }
    }
    setLoading(false)
  }, [router, supabase, autoTried])

  // startTransition setState'larni effect ichidan async batch'ga
  // ko'chiradi -- `react-hooks/set-state-in-effect` qoidasi shu tarzda
  // qondiriladi va cascading render'lar yumshoq bo'ladi.
  useEffect(() => { startTransition(() => { void load() }) }, [load])

  // ── Kunlik planni yoqish ──
  async function enableDailyPlan() {
    if (busy) return
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({ daily_plan_enabled: true }).eq('id', user.id)
      const rpcName = isPremium ? 'generate_plan_for_user' : 'generate_free_daily_plan'
      await supabase.rpc(rpcName, { p_user_id: user.id })
      setAutoTried(false)
      await load()
      toast.show("Bugungi rejangiz tayyor")
    } finally { setBusy(false) }
  }

  // ── Yangi reja tuzish (sozlamalar) ──
  async function regeneratePlan() {
    if (busy) return
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const rpcName = isPremium ? 'generate_plan_for_user' : 'generate_free_daily_plan'
      await supabase.rpc(rpcName, { p_user_id: user.id })
      await load()
      toast.show("Yangi reja tayyorlandi")
    } finally { setBusy(false) }
  }

  // ── Study Plan ni to'xtatish (sozlamalar) ──
  async function stopPlan() {
    if (busy) return
    if (!confirm("Study Plan to'xtatiladi. Davom etamizmi?")) return
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({ daily_plan_enabled: false }).eq('id', user.id)
      toast.show("Study Plan to'xtatildi")
      setTimeout(() => router.push('/dashboard'), 800)
    } finally { setBusy(false) }
  }

  // ── Premium rejim tanlash (hozircha placeholder toast) ──
  function pickModeSoon() {
    toast.show("Tez orada")
  }

  const back = (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80"
      style={{ color: 'var(--text-muted)' }}
    >
      <ChevronLeft size={14} /> Bosh sahifaga qaytish
    </Link>
  )

  const toastEl = (
    <AnimatePresence>
      {toast.msg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
            color: 'white',
            boxShadow: '0 10px 40px rgba(16,185,129,0.35)',
          }}
        >
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ── Loading ──
  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-4">
        {back}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
        ))}
      </div>
    )
  }

  // ── HOLAT C: Toggle o'chirilgan ──
  if (!dailyEnabled) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        {back}
        {toastEl}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center rounded-3xl p-8 md:p-12"
          style={{
            background: 'linear-gradient(160deg, rgba(99,102,241,0.10), rgba(139,92,246,0.04) 60%, var(--bg-card))',
            border: '1px solid rgba(99,102,241,0.30)',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)' }}
          >
            <Calendar size={30} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Kunlik plan yoqilmagan
          </h1>
          <p className="text-sm md:text-base mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Har kuni ertalab sizga moslashtirilgan reja tayyorlaymiz. Yoqish uchun tugmani bosing.
          </p>
          <button
            type="button"
            onClick={enableDailyPlan}
            disabled={busy}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {busy ? 'Tayyorlanmoqda…' : "Kunlik planni yoqish"}
          </button>
        </motion.div>
      </div>
    )
  }

  // ── HOLAT A: Locked wall (free user, hafta 2+) ──
  if (plan?.mode === 'daily_free_locked') {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        {back}
        {toastEl}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center rounded-3xl p-8 md:p-12"
          style={{
            background: CATEGORY_STYLE.locked.grad,
            border: `1px solid ${CATEGORY_STYLE.locked.border}`,
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)' }}
          >
            <Lock size={30} style={{ color: CATEGORY_STYLE.locked.icon }} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Bepul haftalik reja yakunlandi
          </h1>
          <div className="text-sm md:text-base leading-relaxed space-y-3 mb-6 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            <p>
              Siz platformadagi barcha bepul materiallarni bir hafta davomida muvaffaqiyatli o&apos;zlashtirdingiz.
              Bu jiddiy natija.
            </p>
            <p>Endi keyingi bosqichga o&apos;tish vaqti keldi. Premium obuna sizga quyidagilarni beradi:</p>
          </div>
          <ul className="text-sm md:text-base text-left space-y-2 mb-8 max-w-xl mx-auto" style={{ color: 'var(--text-primary)' }}>
            {[
              'Har kuni sizning natijalaringiz asosida yangilanadigan individual reja',
              "30+ qo'shimcha Reading va Listening testlari (bir oyga yetadi)",
              'Barcha 100 ta Vocabulary levellari',
              'Barcha Script Practice va Article materiallari',
              'Writing va Speaking uchun AI baholash',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <Check size={18} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/premium"
              className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <Crown size={16} /> Premium olish
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Materiallarni takrorlash
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── HOLAT: plan yo'q (RPC muvaffaqiyatsiz) ──
  if (!plan) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        {back}
        {toastEl}
        <div className="py-12 px-6 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Bugungi reja tayyorlanmoqda
          </h1>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Yangi reja tuzishga urinib ko&apos;ring.</p>
          <button
            type="button"
            onClick={regeneratePlan}
            disabled={busy}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {busy ? 'Tayyorlanmoqda…' : "Yangi reja tuzish"}
          </button>
        </div>
      </div>
    )
  }

  // ── HOLAT B: Aktiv daily_free (yoki premium vaqtinchalik template) ──
  const readingIds = plan.reading_test_ids ?? []
  const listeningIds = plan.listening_test_ids ?? []
  const totalTarget =
    readingIds.length + listeningIds.length
    + plan.script_target + plan.vocab_target + plan.article_target + plan.video_target
  const totalDone =
    Math.min(plan.reading_completed, readingIds.length)
    + Math.min(plan.listening_completed, listeningIds.length)
    + Math.min(plan.script_completed, plan.script_target)
    + Math.min(plan.vocab_completed, plan.vocab_target)
    + Math.min(plan.article_completed, plan.article_target)
    + Math.min(plan.video_completed, plan.video_target)
  const percent = totalTarget > 0 ? Math.min(100, Math.round((totalDone / totalTarget) * 100)) : 0
  const complete = percent >= 100

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {back}
      {toastEl}

      {/* Premium user uchun soft banner: hozircha template ustida */}
      {isPremium && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-4 py-3 mb-4 text-sm flex items-start gap-2"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.30)',
            color: 'var(--text-secondary)',
          }}
        >
          <span className="shrink-0">⚠️</span>
          <span>Premium AI plan tez orada tayyor bo&apos;ladi. Hozircha bepul template&apos;dan foydalanishingiz mumkin.</span>
        </motion.div>
      )}

      {/* Gradient summary banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 md:p-6 mb-6"
        style={{
          background: complete
            ? 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(5,150,105,0.06) 60%, var(--bg-card))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.06) 60%, var(--bg-card))',
          border: `1px solid ${complete ? 'rgba(16,185,129,0.35)' : 'rgba(99,102,241,0.30)'}`,
        }}
      >
        <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Bugungi rejangiz — {fmtDateUz(plan.period_start)}
        </h1>
        <div className="flex flex-wrap items-baseline gap-3 mb-3">
          <p className="text-sm md:text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {totalDone}/{totalTarget} vazifa bajarildi
          </p>
          {complete && <span className="text-2xl">🎉</span>}
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: complete ? 'linear-gradient(90deg, #10b981, #22c55e)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
          />
        </div>
        {complete && (
          <p className="text-sm font-semibold mt-3" style={{ color: '#22c55e' }}>
            🎉 Bugungi rejangizni to&apos;liq bajardingiz!
          </p>
        )}
      </motion.div>

      {/* Streak + bonuslar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame size={20} style={{ color: '#f59e0b' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Login Streak: {streak?.current_streak ?? 0} kun
            </h3>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Eng uzun: {streak?.longest_streak ?? 0} kun
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Gift size={20} style={{ color: '#10b981' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Yaqinda olingan bonuslar</h3>
          </div>
          {bonuses.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Hali bonuslar yo&apos;q — rejani bajaring va streak yig&apos;ing.
            </p>
          ) : (
            <div className="space-y-2">
              {bonuses.map(b => (
                <div key={b.id} className="flex items-center gap-2 text-xs">
                  <span className="font-bold shrink-0" style={{ color: '#fbbf24' }}>+{b.points_awarded}</span>
                  <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {b.streak_type === 'plan' ? 'Reja bajarildi' : `${b.milestone ?? ''} kun streak`}
                  </span>
                  <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{fmtShortUz(b.awarded_at)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Vazifa kartalari bento gridi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-6">
        {readingIds.map((id, i) => (
          <TaskCard
            key={`r-${id}`}
            palette="reading"
            icon={BookOpen}
            title={`Reading Test ${i + 1}`}
            subtitle={testTitles[id]}
            done={plan.reading_completed >= i + 1}
            href={`/reading/${id}`}
            delay={0.2 + i * 0.05}
          />
        ))}
        {listeningIds.map((id, i) => (
          <TaskCard
            key={`l-${id}`}
            palette="listening"
            icon={Headphones}
            title={`Listening Test ${i + 1}`}
            subtitle={testTitles[id]}
            done={plan.listening_completed >= i + 1}
            href={`/listening/${id}`}
            delay={0.25 + i * 0.05}
          />
        ))}
        {plan.script_target > 0 && (
          <TaskCard
            palette="script"
            icon={Mic}
            title={`Script Practice — ${plan.script_target} mashq`}
            progressText={`${Math.min(plan.script_completed, plan.script_target)}/${plan.script_target}`}
            done={plan.script_completed >= plan.script_target}
            href="/listening/script"
            delay={0.35}
          />
        )}
        {plan.article_target > 0 && (
          <TaskCard
            palette="article"
            icon={FileText}
            title={`Article — ${plan.article_target} maqola`}
            progressText={`${Math.min(plan.article_completed, plan.article_target)}/${plan.article_target}`}
            done={plan.article_completed >= plan.article_target}
            href="/articles"
            delay={0.4}
          />
        )}
        {plan.video_target > 0 && (
          <TaskCard
            palette="video"
            icon={Video}
            title={`Video Darsi — ${plan.video_target} dars`}
            progressText={`${Math.min(plan.video_completed, plan.video_target)}/${plan.video_target}`}
            done={plan.video_completed >= plan.video_target}
            href="/video-lessons"
            delay={0.45}
          />
        )}
        {plan.vocab_target > 0 && (
          <TaskCard
            palette="vocab"
            icon={GraduationCap}
            title={`Vocabulary — ${plan.vocab_target} level`}
            progressText={`${Math.min(plan.vocab_completed, plan.vocab_target)}/${plan.vocab_target}`}
            done={plan.vocab_completed >= plan.vocab_target}
            href="/vocabulary"
            delay={0.5}
          />
        )}
      </div>

      {/* ── Sozlamalar (collapsible) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setSettingsOpen(o => !o)}
          className="w-full flex items-center gap-2 p-5 text-left"
        >
          <Settings size={18} style={{ color: 'var(--text-muted)' }} />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>⚙️ Sozlamalar</span>
          {settingsOpen
            ? <ChevronUp size={16} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={16} className="ml-auto" style={{ color: 'var(--text-muted)' }} />}
        </button>
        <AnimatePresence initial={false}>
          {settingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-5 pb-5 space-y-5" style={{ borderTop: '1px solid var(--border)' }}>
                {/* Toggle */}
                <div className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Kunlik plan yoqilgan</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Har kuni ertalab yangi reja tayyor bo&apos;ladi
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={stopPlan}
                    disabled={busy}
                    className="rounded-full relative transition-colors disabled:opacity-50 shrink-0"
                    style={{ width: 46, height: 26, background: 'var(--accent)', border: '1px solid var(--border)' }}
                    aria-pressed
                  >
                    <span
                      className="absolute top-0.5 rounded-full bg-white transition-all"
                      style={{ width: 20, height: 20, left: 23 }}
                    />
                  </button>
                </div>

                {/* Free info yoki Premium mode selector */}
                {isPremium ? (
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Reja rejimi</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'weekly', label: 'Haftalik' },
                        { key: 'daily',  label: 'Kunlik AI' },
                      ].map(o => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={pickModeSoon}
                          className="py-2.5 rounded-xl text-sm font-semibold transition-colors"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-xl p-3 text-xs leading-relaxed inline-flex items-start gap-2 w-full"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)', color: 'var(--text-secondary)' }}
                  >
                    <Lock size={14} className="mt-0.5 shrink-0" style={{ color: '#F59E0B' }} />
                    <span>
                      Bepul foydalanuvchilar 7 kunlik bepul template oladi. Individual AI plan Premium&apos;da mavjud.
                    </span>
                  </div>
                )}

                {/* Yangi reja tuzish */}
                <button
                  type="button"
                  onClick={regeneratePlan}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  <RotateCcw size={14} /> Yangi reja tuzish
                </button>

                {/* Study Plan ni to'xtatish (danger) */}
                <div>
                  <button
                    type="button"
                    onClick={stopPlan}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}
                  >
                    Study Plan&apos;ni to&apos;xtatish
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  )
}
