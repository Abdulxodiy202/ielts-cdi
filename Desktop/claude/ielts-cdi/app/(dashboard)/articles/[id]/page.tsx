'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PaymentModal } from '@/components/PaymentModal'
import MusicPlayer from '@/components/MusicPlayer'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function ArticlePage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { t } = useLanguage()
  const [article, setArticle] = useState<any>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [initialName, setInitialName] = useState('')
  const [initialPhone, setInitialPhone] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [res, profileRes] = await Promise.all([
        fetch(`/api/articles/${id}`),
        supabase.from('profiles').select('is_premium, full_name, phone').eq('id', user.id).single(),
      ])

      const data = await res.json()
      setArticle(data)
      setIsPremium(profileRes.data?.is_premium === true)
      setInitialName(profileRes.data?.full_name ?? '')
      setInitialPhone((profileRes.data as any)?.phone ?? '')
      setLoading(false)
    }
    load()
  }, [id, router])

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'white'}}>{t('common.loading')}</div>
  if (!article) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'white'}}>{t('articles.notFound')}</div>

  if (article.is_premium && !isPremium) {
    return (
      <div style={{minHeight:'100vh',background:'#0f0f1a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px',textAlign:'center'}}>
        <div style={{fontSize:'80px',marginBottom:'24px'}}>🔒</div>
        <h2 style={{fontSize:'28px',fontWeight:'700',color:'white',marginBottom:'12px'}}>{t('articles.lockedTitle')}</h2>
        <p style={{color:'#9ca3af',marginBottom:'32px',maxWidth:'400px'}}>{t('articles.lockedDesc')}</p>
        <button onClick={() => setShowModal(true)} style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'white',border:'none',padding:'16px 40px',borderRadius:'12px',fontSize:'18px',fontWeight:'700',cursor:'pointer',marginBottom:'16px'}}>
          {t('articles.upgradeBtn')}
        </button>
        <button onClick={() => router.push('/articles')} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:'14px'}}>
          {t('articles.backToList')}
        </button>

        <PaymentModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
          type="premium"
          amount={50000}
          initialName={initialName}
          initialPhone={initialPhone}
        />
      </div>
    )
  }

  const fileUrl = article.file_url || article.pdf_url
  return (
    <div className="fixed inset-0 z-[100]" style={{display:'flex',flexDirection:'column',background:'#0f0f1a'}}>
      <div style={{height:'48px',display:'flex',alignItems:'center',padding:'0 16px',background:'#1e1e30',borderBottom:'1px solid #2d2d4e',flexShrink:0}}>
        <button onClick={() => router.push('/articles')} style={{background:'none',border:'none',color:'white',cursor:'pointer',fontSize:'14px'}}>
          ← {article.title}
        </button>
      </div>
      <iframe src={fileUrl} style={{flex:1,border:'none',width:'100%'}} title={article.title} />
      <MusicPlayer autoPlay defaultMinimized />
    </div>
  )
}
