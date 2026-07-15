export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  ArrowRight, Crown, CheckCircle, XCircle,
  BookOpen, Headphones, Gamepad2, Keyboard, PenLine, Video, Star,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctaHref = user ? '/dashboard' : '/login'

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }} className="min-h-screen relative overflow-hidden">
      {/* Ambient background blobs. Very low opacity so they don't compete
          with content; pointer-events off so they never intercept clicks. */}
      <div aria-hidden style={{ position: 'absolute', top: -120, left: -120, width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: 500, right: -160, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.14), transparent 70%)', filter: 'blur(70px)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: 1200, left: '30%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.12), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(15,15,26,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs"
            style={{ background: 'var(--accent)' }}
          >
            IC
          </div>
          <span className="font-bold text-lg">IELTS CDI</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="btn-primary text-sm">
              Dashboard <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium px-4 py-2 rounded-lg transition-all"
                style={{ color: 'var(--text-secondary)' }}
              >
                Sign In
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get Started <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-24 pb-24 max-w-4xl mx-auto relative">
        <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6">
          Ace IELTS with{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Real Practice
          </span>
        </h1>
        <p className="text-lg max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
          35 full-length Reading and Listening tests, AI-powered tools, vocabulary games,
          and instant band score prediction — everything you need to hit your target score.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={ctaHref} className="btn-primary text-base px-8 py-3">
            Start Free Today <ArrowRight size={16} />
          </Link>
          {!user && (
            <Link href="/login" className="btn-outline text-base px-8 py-3">
              Sign In
            </Link>
          )}
        </div>
        <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Free tests + games in every section · No credit card required
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 relative">
        <h2 className="text-3xl font-bold text-center mb-4">Everything you need to succeed</h2>
        <p className="text-center mb-12 max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
          Six ways the platform helps you go from your first practice test to your target band.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: BookOpen,
              title: 'Reading Tests',
              color: '#6366f1',
              desc: '35 academic passages with 40 questions each. Instant scoring, band prediction, and full answer review after every attempt.',
            },
            {
              icon: Headphones,
              title: 'Listening Tests',
              color: '#ec4899',
              desc: '35 audio tests plus section-by-section training. Real exam conditions with authentic accents.',
            },
            {
              icon: Gamepad2,
              title: 'Vocabulary Games',
              color: '#22c55e',
              desc: '100 levels of interactive word puzzles. Build 3000+ IELTS words through play, not memorization.',
            },
            {
              icon: Keyboard,
              title: 'Typing Practice',
              color: '#a855f7',
              desc: "Monkeytype-style speed training with IELTS vocabulary and full Task 1 / Task 2 essays.",
            },
            {
              icon: PenLine,
              title: 'Script Practice',
              color: '#06b6d4',
              desc: 'BBC 6-Minute English dictation. Type what you hear — the app grades word by word.',
            },
            {
              icon: Star,
              title: 'Star Progress System',
              color: '#f59e0b',
              desc: 'Every completed test earns stars. Track progress across Reading, Listening, Articles, Videos, and Script Practice.',
            },
          ].map(f => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="card p-6 transition-all"
                style={{ borderRadius: 16, minHeight: 220 }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}20`, border: `1px solid ${f.color}40` }}
                >
                  <Icon size={26} style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {f.desc}
                </p>
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm mt-10" style={{ color: 'var(--text-muted)' }}>
          <Video size={13} className="inline mr-1.5 -mt-0.5" />
          Also included: Video Lessons with per-video tests · Articles library with difficulty-tiered quizzes
        </p>
        <p className="text-center text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Coming soon:</span>{' '}
          AI Writing feedback · AI Speaking assessment · Community
        </p>
      </section>

      {/* Band table */}
      <section className="max-w-3xl mx-auto px-6 py-20 relative">
        <h2 className="text-3xl font-bold text-center mb-4">Band Score Table</h2>
        <p className="text-center mb-10" style={{ color: 'var(--text-muted)' }}>Instant calculation after every test</p>
        <div className="card overflow-hidden" style={{ borderRadius: 16 }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th className="py-3 px-4 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Raw Score</th>
                <th className="py-3 px-4 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Band</th>
                <th className="py-3 px-4 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Level</th>
              </tr>
            </thead>
            <tbody>
              {[
                { raw: '39–40', band: '9.0', color: '#10b981', level: 'Expert' },
                { raw: '37–38', band: '8.5', color: '#22c55e', level: 'Expert' },
                { raw: '35–36', band: '8.0', color: '#3b82f6', level: 'Very Good' },
                { raw: '33–34', band: '7.5', color: '#6366f1', level: 'Good' },
                { raw: '30–32', band: '7.0', color: '#6366f1', level: 'Good' },
                { raw: '23–26', band: '6.0', color: '#f59e0b', level: 'Competent' },
                { raw: '15–18', band: '5.0', color: '#f97316', level: 'Modest' },
                { raw: 'Below 10', band: '3.5', color: '#ef4444', level: 'Limited' },
              ].map(row => (
                <tr key={row.band} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{row.raw}</td>
                  <td className="py-3 px-4 font-black text-lg" style={{ color: row.color }}>{row.band}</td>
                  <td className="py-3 px-4" style={{ color: 'var(--text-muted)' }}>{row.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing -- inlined here (was PricingSection) so the free plan can
          fit its full feature list without cramming the shared component. */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative">
        <h2 className="text-3xl font-bold text-center mb-4">Pricing</h2>
        <p className="text-center mb-12" style={{ color: 'var(--text-muted)' }}>
          Start free. Upgrade when you want the full test bank.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Free card */}
          <div className="card p-8 flex flex-col" style={{ borderRadius: 16 }}>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">Free</h3>
              <div className="text-4xl font-black mb-1">0 UZS</div>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Forever free — no card needed</p>

              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                What&apos;s included
              </p>
              {/* Grouped 8-line list -- each item is a bold main label
                  with a muted subtitle describing the bundle. Single
                  column: the sub-lines carry the detail so we don't
                  need a second column to fit everything. */}
              <div className="mb-6">
                {([
                  { label: 'Practice Tests', sub: '5 Reading + 5 Listening + Section Training' },
                  { label: '10 Free Articles + Tests', sub: 'Read, take quizzes, earn stars' },
                  { label: 'Free Video Lessons + Tests', sub: 'Watch and test yourself' },
                  { label: 'Full Vocabulary Access', sub: 'Games (100 levels), Verbs, Collocations, 3000+ words' },
                  { label: 'Typing Practice', sub: 'Common English, IELTS, Task 1 & 2 essays' },
                  { label: 'Script Practice (BBC-style)', sub: 'Listen and transcribe with smart grading' },
                  { label: 'Free Books Library', sub: 'Grammar, IELTS, Vocabulary, Fun Reads' },
                  { label: 'Progress Tools', sub: 'Star system, band score, mock booking, result history' },
                ]).map(f => (
                  <div key={f.label} className="flex items-start gap-2.5" style={{ marginBottom: 14 }}>
                    <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: 3 }} />
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px]" style={{ color: 'var(--text-primary)' }}>
                        {f.label}
                      </div>
                      <div className="text-[13px] leading-snug" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                        {f.sub}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 24px gap before Not Included per spec */}
              <div style={{ height: 24 }} />
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                Not included
              </p>
              <div className="mb-2">
                {([
                  { label: 'Premium Content', sub: '30 Reading + 30 Listening + 20 Articles + Videos + Books' },
                  { label: 'Priority Support' },
                ] as Array<{ label: string; sub?: string }>).map(f => (
                  <div key={f.label} className="flex items-start gap-2.5" style={{ marginBottom: 14 }}>
                    <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 3 }} />
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px]" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        {f.label}
                      </div>
                      {f.sub && (
                        <div className="text-[13px] leading-snug" style={{ color: 'rgba(148,163,184,0.7)', marginTop: 2 }}>
                          {f.sub}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Link href={ctaHref} className="btn-secondary w-full mt-6 text-sm flex justify-center">
              Get Started Free
            </Link>
          </div>

          {/* Premium card. Deliberately shorter than Free -- the
              "everything above, plus" framing carries the weight. */}
          <div className="card p-8 flex flex-col relative" style={{ border: '2px solid var(--accent)', borderRadius: 16 }}>
            <div
              className="absolute top-0 right-0 px-3 py-1 text-xs font-bold"
              style={{
                background: 'var(--accent)',
                color: 'white',
                borderTopRightRadius: 14,
                borderBottomLeftRadius: 8,
              }}
            >
              POPULAR
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Crown size={20} style={{ color: '#f59e0b' }} />
                <h3 className="text-xl font-bold">Premium</h3>
              </div>
              <div className="text-4xl font-black mb-1" style={{ color: 'var(--accent)' }}>50,000 UZS</div>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>per month</p>

              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                Everything above, plus
              </p>
              <div className="space-y-2 mb-2">
                {[
                  'Everything in Free',
                  'All 35 Reading Tests',
                  'All 35 Listening Tests',
                  'All 30 Articles + Tests',
                  'All Video Lessons + Tests',
                  'Full Books Library',
                  'Priority Support',
                ].map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link href={ctaHref} className="btn-primary w-full mt-6 text-sm flex justify-center gap-2">
              <Crown size={14} /> Get Premium
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t text-center py-8 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <div className="flex items-center justify-center gap-4 mb-3 flex-wrap">
          <Link href={ctaHref} className="hover:opacity-80 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
            Dashboard
          </Link>
          <span aria-hidden>·</span>
          <Link href="/feedback" className="hover:opacity-80 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
            Feedback
          </Link>
          <span aria-hidden>·</span>
          <span>Community (Coming soon)</span>
        </div>
        <div>© {new Date().getFullYear()} IELTS CDI. All rights reserved.</div>
      </footer>
    </div>
  )
}
