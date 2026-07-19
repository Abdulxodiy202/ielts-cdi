'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DisplayNameModal } from '@/components/DisplayNameModal'
import { StudyPlanOnboardingModal } from '@/components/StudyPlanOnboardingModal'

// Sequences the dashboard's one-time modals: display-name prompt first,
// study-plan onboarding second. Both checks run once on mount; the
// queue advances via completion callbacks so the user never sees two
// stacked modals.

type Phase = 'checking' | 'name' | 'plan' | 'idle'

export function DashboardModals({ isPremium }: { isPremium: boolean }) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPhase('idle'); return }

      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', user.id).single(),
        supabase.from('user_plan_settings').select('onboarded').eq('user_id', user.id).maybeSingle(),
      ])

      const emailPrefix = user.email?.split('@')[0]
      const dn = (profileRes.data as { display_name?: string | null } | null)?.display_name
      const needsName = !dn || dn === emailPrefix
      const needsPlan = !(settingsRes.data as { onboarded?: boolean } | null)?.onboarded

      setNeedsOnboarding(needsPlan)
      setPhase(needsName ? 'name' : needsPlan ? 'plan' : 'idle')
    }
    check()
  }, [])

  return (
    <>
      {phase === 'name' && (
        <DisplayNameModal
          open
          onComplete={() => setPhase(needsOnboarding ? 'plan' : 'idle')}
        />
      )}
      <StudyPlanOnboardingModal
        open={phase === 'plan'}
        isPremium={isPremium}
        onComplete={() => setPhase('idle')}
      />
    </>
  )
}
