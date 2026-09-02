'use client'

import { useState } from 'react'

// Study Plan'ning haftalik bajarish foizini ko'rsatuvchi chiziqli
// grafigi -- avval faqat study-plan/page.tsx ichida yashagan, endi
// dashboard bento-kartasi ("AiStudyPlanWidget") ham AYNAN shu grafikni
// (gridlayn, % o'qi, hafta kunlari, hover'da foiz chiqishi bilan)
// ko'rsatishi kerak bo'lgani uchun alohida umumiy komponentga
// ko'chirildi -- ikkala joyda ham bir xil ko'rinish/xatti-harakat.
//
// Faqat `day`/`date`/`weekday`/`tasks[].{target,progress,maxStars}`
// maydonlariga muhtoj -- shu sabab minimal, mustaqil interfeyslar
// ishlatiladi (chaqiruvchi tomondagi to'liqroq PlanTask/PlanDay
// tiplariga strukturaviy mos keladi, alohida import/cast shart emas).

interface ChartTask {
  target: number
  progress: number
  maxStars: number
}
interface ChartDay {
  day: number
  date: string
  weekday: string
  tasks: ChartTask[]
}

function taskStars(t: ChartTask): number {
  if (t.target <= 0) return 0
  return Math.min(t.maxStars, Math.round((t.progress / t.target) * t.maxStars))
}
function dayPercent(d: ChartDay): number {
  const maxSum = d.tasks.reduce((s, t) => s + t.maxStars, 0)
  if (maxSum <= 0) return 0
  const earnSum = d.tasks.reduce((s, t) => s + taskStars(t), 0)
  return Math.round((earnSum / maxSum) * 100)
}

// Yagona-seriyali chiziqli grafik (dataviz: yupqa chiziq, dumaloq
// uchlar, >=8px belgilar, gradient fon, tanlangan/hover qilingan
// nuqtada to'g'ridan-to'g'ri yorliq, legend kerak emas -- yagona
// seriya sarlavha bilan nomlangan).
export function CompletionChart({
  days, selectedDay, todayStr, onSelect,
}: {
  days: ChartDay[]; selectedDay: number; todayStr: string; onSelect: (day: number) => void
}) {
  const W = 640
  const H = 260
  const padX = 40
  const padTop = 26
  const padBottom = 30
  const innerW = W - padX * 2
  const innerH = H - padTop - padBottom
  const n = days.length

  // Boshqa kunga o'tish uchun bosiladigan nuqtaning ustiga cursor
  // olib borilganda ham (tanlanmagan bo'lsa ham) o'sha kunning foizi
  // ko'rinishi uchun -- foydalanuvchi qaysi nuqta necha foiz ekanini
  // bosmasdan turib ham bila oladi.
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  const points = days.map((d, i) => {
    const pct = dayPercent(d)
    const x = n > 1 ? padX + (innerW * i) / (n - 1) : padX + innerW / 2
    const y = padTop + innerH * (1 - pct / 100)
    return { x, y, pct, day: d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const first = points[0]
  const areaPath = points.length
    ? `${linePath} L ${last.x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${first.x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
    : ''

  return (
    <div className="rounded-2xl p-3 md:p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="planAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          {/* Chiziqni ozroq "porlatib" ko'zga tashlanadigan qiladi --
              avval juda ingichka/xira ko'rinib, ba'zi kunlar 0% ga
              yaqin bo'lganda grafik shunchaki tekis chiziq/nuqta bo'lib
              ko'rinardi. */}
          <filter id="planLineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="var(--accent)" floodOpacity="0.55" />
          </filter>
        </defs>

        {[0, 25, 50, 75, 100].map(g => {
          const y = padTop + innerH * (1 - g / 100)
          return (
            <g key={g}>
              <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />
              <text x={padX - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="var(--text-muted)">
                {g}%
              </text>
            </g>
          )
        })}

        {areaPath && <path d={areaPath} fill="url(#planAreaGrad)" stroke="none" />}
        {linePath && <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" filter="url(#planLineGlow)" />}

        {points.map(p => {
          const isSel = p.day.day === selectedDay
          const isHovered = p.day.day === hoveredDay
          const isToday = p.day.date === todayStr
          const showLabel = isSel || isHovered
          return (
            <g key={p.day.day}>
              <circle
                cx={p.x} cy={p.y} r={18} fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(p.day.day)}
                onMouseEnter={() => setHoveredDay(p.day.day)}
                onMouseLeave={() => setHoveredDay(prev => (prev === p.day.day ? null : prev))}
              />
              <circle
                cx={p.x} cy={p.y} r={isSel ? 8 : isHovered ? 7 : 6}
                fill={isSel ? 'var(--accent)' : 'var(--bg-card)'}
                stroke="var(--accent)" strokeWidth={2.5}
                style={{ cursor: 'pointer', pointerEvents: 'none' }}
              />
              {showLabel && (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Foiz yorlig'i orqasida kichik "chip" -- fon rangidan
                      ustun turishi va chiziq/gridlayn bilan aralashib
                      ketmasligi uchun. */}
                  <rect
                    x={p.x - 18} y={p.y - 30} width={36} height={16} rx={8}
                    fill={isSel ? 'var(--accent)' : 'var(--bg-card)'}
                    stroke={isSel ? 'none' : 'var(--border)'}
                    strokeWidth={1}
                  />
                  <text
                    x={p.x} y={p.y - 22} textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fontWeight={700}
                    fill={isSel ? '#fff' : 'var(--text-primary)'}
                  >
                    {p.pct}%
                  </text>
                </g>
              )}
              <text
                x={p.x} y={H - 12} textAnchor="middle" fontSize={10}
                fontWeight={isToday ? 700 : 500}
                fill={isToday ? 'var(--accent)' : 'var(--text-muted)'}
              >
                {p.day.weekday.slice(0, 3)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
