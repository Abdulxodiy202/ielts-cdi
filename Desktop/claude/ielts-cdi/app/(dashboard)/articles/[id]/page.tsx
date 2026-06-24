export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { isActivePremium } from '@/lib/utils/premium'
import { ArticleClient } from './ArticleClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: article }, profileRes] = await Promise.all([
    admin.from('articles').select('*').eq('id', id).eq('is_published', true).single(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
  ])

  if (!article) notFound()

  const isPremium = isActivePremium(profileRes.data)

  return <ArticleClient article={article} isPremium={isPremium} />
}
