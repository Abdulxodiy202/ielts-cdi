export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { BookOpen, Headphones, BarChart2, Calendar, ArrowRight, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PricingSection } from '@/components/landing/PricingSection'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctaHref = user ? '/dashboard' : '/login'

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }} className="min-h-screen">
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
      <section className="text-center px-6 pt-24 pb-20 max-w-4xl mx-auto">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          <Zap size={12} /> Trusted by 10,000+ IELTS students
        </div>
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
          18 full-length practice tests with instant scoring, detailed analytics,
          and band score prediction вЂ” exactly like the real IELTS exam.
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
          4 free tests per section В· No credit card required
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need to succeed</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: BookOpen, title: 'Reading Tests', desc: '9 full academic tests with 3 passages and 40 questions each.', color: '#6366f1' },
            { icon: Headphones, title: 'Listening Tests', desc: '9 listening tests with 4 audio sections and real exam conditions.', color: '#ec4899' },
            { icon: BarChart2, title: 'Analytics', desc: 'Track progress, band score trends, and identify weak areas.', color: '#22c55e' },
            { icon: Calendar, title: 'Mock Tests', desc: 'Book supervised full mock exams on Sundays at CDI centres.', color: '#f59e0b' },
          ].map(f => (
            <div key={f.title} className="card p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}20` }}>
                <f.icon size={24} style={{ color: f.color }} />
              </div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Band table */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Band Score Table</h2>
        <p className="text-center mb-10" style={{ color: 'var(--text-muted)' }}>Instant calculation after every test</p>
        <div className="card overflow-hidden">
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
                { raw: '39вЂ“40', band: '9.0', color: '#10b981', level: 'Expert' },
                { raw: '37вЂ“38', band: '8.5', color: '#22c55e', level: 'Expert' },
                { raw: '35вЂ“36', band: '8.0', color: '#3b82f6', level: 'Very Good' },
                { raw: '33вЂ“34', band: '7.5', color: '#6366f1', level: 'Good' },
                { raw: '30вЂ“32', band: '7.0', color: '#6366f1', level: 'Good' },
                { raw: '23вЂ“26', band: '6.0', color: '#f59e0b', level: 'Competent' },
                { raw: '15вЂ“18', band: '5.0', color: '#f97316', level: 'Modest' },
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

      {/* Pricing */}
      <PricingSection ctaHref={ctaHref} />

      {/* Footer */}
      <footer className="border-t text-center py-8 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        В© {new Date().getFullYear()} IELTS CDI. All rights reserved.
      </footer>
    </div>
  )
}

