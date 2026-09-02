'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Sparkles, ArrowRight, Star, Trophy, Lock } from 'lucide-react'
import { getTashkentToday } from '@/lib/utils/date'
import { CompletionChart } from '@/components/study-plan/CompletionChart'

const PaymentModal = dynamic(() => import('@/components/PaymentModal').then(m => ({ default: m.PaymentModal })), { ssr: false })

// Dashboard bento-katakchasi (avval statik matn edi -- "birozgina g'alati"
// ko'rinar edi, chunki hali reja tuzmaganlar uchun ham, allaqachon
// tuzganlar uchun ham AYNAN bir xil bo'sh tavsif ko'rsatilardi).
//
// Endi o'zi /api/study-plan/ai-generate'ni chaqirib ikki holatni
// ajratadi:
//  - Reja hali yo'q -- ko'proq "chaqiruvchi" (CTA) ko'rinish: aniq
//    "Reja tuzish" tugmasi bilan.
//  - Reja bor -- study-plan sahifasidagi bilan AYNAN BIR XIL grafik
//    (gridlayn, % o'qi, hafta kunlari, hover/tanlashda foiz chiqishi) --
//    shu sabab shu ikkala joyda ham umumiy `CompletionChart` ishlatiladi.

interface PlanTask {
  target: number
  progress: number
  maxStars: number
}
interface PlanDay {
  day: number
  date: string
  weekday: string
  tasks: PlanTask[]
}
interface AiPlan {
  plan_json: PlanDay[] | null
  stars_goal: number | null
  stars_earned: number | null
  bonus_awarded?: boolean | null
  bonus_stars?: number | null
}

const tileStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.06)',
}

export function AiStudyPlanWidget() {
  // undefined = hali yuklanmoqda, null = reja yo'q (yoki xatolik).
  const [plan, setPlan] = useState<AiPlan | null | undefined>(undefined)
  const [selectedDay, setSelectedDay] = useState<number>(1)
  // AI Study Plan faqat premium foydalanuvchilar uchun -- `null` hali
  // aniqlanmagan degani (loading paytida noto'g'ri holat chiqib
  // qolmasin uchun).
  const [userPremium, setUserPremium] = useState<boolean | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const todayStr = getTashkentToday()

  useEffect(() => {
    let cancelled = false
    fetch('/api/study-plan/ai-generate')
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        setUserPremium(data.userPremium !== false)
        const p = res.ok ? (data.plan ?? null) : null
        setPlan(p)
        const pDays = (p?.plan_json as PlanDay[] | null) ?? null
        if (pDays && pDays.length) {
          const todayDay = pDays.find(d => d.date === getTashkentToday())
          setSelectedDay(todayDay ? todayDay.day : pDays[0].day)
        }
      })
      .catch(() => { if (!cancelled) setPlan(null) })
    return () => { cancelled = true }
  }, [])

  if (plan === undefined) {
    return (
      <div className="lg:col-span-6 p-5 md:p-6 flex flex-col justify-center" style={tileStyle}>
        <div className="w-11 h-11 rounded-xl animate-pulse mb-3" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-4 w-2/3 rounded animate-pulse mb-2" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-3 w-1/2 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
      </div>
    )
  }

  // ── Premium bo'lmagan foydalanuvchi -- blur qilingan namunaviy
  // ko'rinish + qulf + "Premiumga o'tish" tugmasi. Study-plan
  // sahifasidagi to'liq qulf ekrani bilan bir xil uslub, faqat
  // bento-katakcha o'lchamiga moslashtirilgan.
  if (userPremium === false) {
    return (
      <div className="lg:col-span-6 p-5 md:p-6 relative overflow-hidden" style={tileStyle}>
        <div style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <Sparkles size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                Personal Study Plan
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>AI</span>
              </div>
              <div className="text-xs font-semibold flex items-center gap-1 mt-0.5" style={{ color: '#f59e0b' }}>
                <Star size={11} fill="#f59e0b" stroke="#f59e0b" /> 120 / 170 yulduz
              </div>
            </div>
          </div>
          {/* Namunaviy CHIZIQLI grafik -- study-plan sahifasidagi blur
              namunasi bilan bir xil (haqiqiy CompletionChart bar emas,
              line chart bo'lgani uchun). */}
          <svg viewBox="0 0 280 70" width="100%" height={70} style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="fakePlanGradWidget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 35, 70].map(y => (
              <line key={y} x1={0} x2={280} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />
            ))}
            <path
              d="M 0 70 L 0 40.4 L 46.7 26.9 L 93.3 45.8 L 140 18.8 L 186.7 32.3 L 233.3 13.4 L 280 37.7 L 280 70 Z"
              fill="url(#fakePlanGradWidget)"
              stroke="none"
            />
            <path
              d="M 0 40.4 L 46.7 26.9 L 93.3 45.8 L 140 18.8 L 186.7 32.3 L 233.3 13.4 L 280 37.7"
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {[[0, 40.4], [46.7, 26.9], [93.3, 45.8], [140, 18.8], [186.7, 32.3], [233.3, 13.4], [280, 37.7]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3.5} fill="var(--bg-card)" stroke="var(--accent)" strokeWidth={2} />
            ))}
          </svg>
        </div>

        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 p-5"
          style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.55), rgba(245,158,11,0.22))' }}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.45)' }}
          >
            <Lock size={20} style={{ color: '#fbbf24' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: '#fff' }}>AI Study Plan — Premium funksiya</p>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs transition-transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', boxShadow: '0 6px 18px rgba(245,158,11,0.4)' }}
          >
            👑 Premiumga o&apos;tish
          </button>
        </div>

        {showPaymentModal && (
          <PaymentModal
            isOpen
            onClose={() => setShowPaymentModal(false)}
            onSuccess={() => setShowPaymentModal(false)}
            type="premium"
            amount={50000}
          />
        )}
      </div>
    )
  }

  const days = plan?.plan_json ?? null

  // ── Reja hali tuzilmagan -- yaxshilangan taklif (CTA) kartasi ──
  if (!plan || !days || days.length === 0) {
    return (
      <Link
        href="/dashboard/study-plan"
        className="lg:col-span-6 p-5 md:p-6 group transition-colors hover:border-[var(--accent)] flex flex-col justify-center"
        style={{
          ...tileStyle,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(139,92,246,0.06) 60%, var(--bg-card))',
        }}
      >
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.18)' }}>
            <Sparkles size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0 font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            Personal Study Plan
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>AI</span>
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Test natijalaringiz asosida sizga moslashtirilgan haftalik o&apos;quv reja tuzib beramiz.
        </p>
        <span
          className="inline-flex items-center gap-1.5 self-start px-4 py-2 rounded-xl text-sm font-bold text-white transition-transform group-hover:translate-x-0.5"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          Reja tuzish <ArrowRight size={15} />
        </span>
      </Link>
    )
  }

  // ── Reja bor -- study-plan sahifasidagi bilan bir xil to'liq grafik.
  // Konteyner endi <Link> emas (grafikning o'z nuqtalari bosiladigan
  // bo'lgani uchun ichma-ich <a> bo'lib qolmasin) -- faqat pastdagi
  // "Batafsil" havolasi sahifaga olib boradi.
  const starsGoal = plan.stars_goal ?? 0
  const starsEarned = plan.stars_earned ?? 0
  // Hafta 100% bajarilib, bonus allaqachon berilgan bo'lsa -- shu
  // katakchaning o'ziga ham "tantana" holatini beramiz: oltin nafas
  // oluvchi (pulse) ramka + trofey belgisi + "Sovg'angizni ko'ring"
  // tugmasi -- bu bilan foydalanuvchi ichkariga (study-plan sahifasiga)
  // kirib to'liq tabrik ekranini ko'rishga undaladi.
  const isCelebrating = !!plan.bonus_awarded

  return (
    <div
      className="lg:col-span-6 p-5 md:p-6 flex flex-col relative overflow-hidden"
      style={{
        ...tileStyle,
        ...(isCelebrating
          ? {
              border: '1px solid rgba(245,158,11,0.55)',
              background: 'linear-gradient(160deg, rgba(245,158,11,0.10), rgba(217,119,6,0.03) 55%, var(--bg-card))',
              animation: 'planWidgetGlow 2.4s ease-in-out infinite',
            }
          : {}),
      }}
    >
      {isCelebrating && (
        <style>{`
          @keyframes planWidgetGlow {
            0%, 100% { box-shadow: 0 1px 2px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.06), 0 0 0 rgba(245,158,11,0); }
            50% { box-shadow: 0 1px 2px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.06), 0 0 22px rgba(245,158,11,0.45); }
          }
          @keyframes planWidgetShine {
            0% { transform: translateX(-120%) skewX(-15deg); }
            100% { transform: translateX(220%) skewX(-15deg); }
          }
        `}</style>
      )}
      {isCelebrating && (
        <div
          aria-hidden
          className="absolute top-0 bottom-0 w-1/3 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
            animation: 'planWidgetShine 3.2s ease-in-out infinite',
          }}
        />
      )}

      <div className="flex items-center gap-3 mb-3 relative">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: isCelebrating ? 'rgba(245,158,11,0.18)' : 'rgba(99,102,241,0.15)' }}
        >
          {isCelebrating ? (
            <Trophy size={22} style={{ color: '#f59e0b' }} />
          ) : (
            <Sparkles size={22} style={{ color: 'var(--accent)' }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            Personal Study Plan
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>AI</span>
          </div>
          {isCelebrating ? (
            <div className="text-xs font-bold flex items-center gap-1 mt-0.5" style={{ color: '#f59e0b' }}>
              🏆 Hafta 100% bajarildi! +{plan.bonus_stars ?? 100} bonus yulduz
            </div>
          ) : (
            starsGoal > 0 && (
              <div className="text-xs font-semibold flex items-center gap-1 mt-0.5" style={{ color: '#f59e0b' }}>
                <Star size={11} fill="#f59e0b" stroke="#f59e0b" /> {starsEarned} / {starsGoal} yulduz
              </div>
            )
          )}
        </div>
        <Link
          href="/dashboard/study-plan"
          className="inline-flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl text-white shrink-0 transition-transform hover:scale-105"
          style={
            isCelebrating
              ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.45)' }
              : { background: 'var(--accent)' }
          }
        >
          {isCelebrating ? <>Sovg'ani ko'rish <Trophy size={15} /></> : <>Batafsil <ArrowRight size={15} /></>}
        </Link>
      </div>

      <div className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Kunlik bajarish foizi
      </div>
      <CompletionChart days={days} selectedDay={selectedDay} todayStr={todayStr} onSelect={setSelectedDay} />
    </div>
  )
}
