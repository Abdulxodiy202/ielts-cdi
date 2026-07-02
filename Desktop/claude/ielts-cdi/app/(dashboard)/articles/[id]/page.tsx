'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ArticlePage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const [article, setArticle] = useState<any>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch(`/api/articles/${id}`)
      const article = await res.json()
      setArticle(article)

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single()
      setIsPremium(profile?.is_premium === true)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'white'}}>Yuklanmoqda...</div>
  if (!article) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'white'}}>Topilmadi</div>

  if (article.is_premium && !isPremium) {
    return (
      <div style={{minHeight:'100vh',background:'#0f0f1a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px',textAlign:'center'}}>
        <div style={{fontSize:'80px',marginBottom:'24px'}}>🔒</div>
        <h2 style={{fontSize:'28px',fontWeight:'700',color:'white',marginBottom:'12px'}}>Bu maqola Premium uchun</h2>
        <p style={{color:'#9ca3af',marginBottom:'32px',maxWidth:'400px'}}>Barcha premium maqolalarni o&apos;qish uchun Premium tarifga o&apos;ting</p>
        <button onClick={() => setShowModal(true)} style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'white',border:'none',padding:'16px 40px',borderRadius:'12px',fontSize:'18px',fontWeight:'700',cursor:'pointer',marginBottom:'16px'}}>
          👑 Premiumga o&apos;tish — 50,000 so&apos;m/oy
        </button>
        <button onClick={() => router.push('/articles')} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:'14px'}}>
          ← Maqolalarga qaytish
        </button>

        {showModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'20px'}}>
            <div style={{background:'#1e1e30',borderRadius:'16px',padding:'32px',maxWidth:'480px',width:'100%',position:'relative'}}>
              <button onClick={() => setShowModal(false)} style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',color:'#9ca3af',fontSize:'24px',cursor:'pointer'}}>✕</button>
              <h3 style={{color:'white',fontSize:'20px',fontWeight:'700',marginBottom:'8px'}}>To&apos;lov — Premium Obuna</h3>
              <p style={{color:'#9ca3af',marginBottom:'24px',fontSize:'14px'}}>Kartaga o&apos;tkazma qiling, so&apos;ng chek rasmini yuboring</p>
              <div style={{background:'#252542',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
                <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'8px'}}>KARTA RAQAMI</div>
                <div style={{fontSize:'20px',fontWeight:'700',color:'white',letterSpacing:'2px',marginBottom:'4px'}}>4916 9903 5400 1395</div>
                <div style={{color:'#9ca3af',marginBottom:'12px',fontSize:'14px'}}>Abdulxodiy Mamajonov</div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{color:'#9ca3af',fontSize:'14px'}}>O&apos;tkazma summasi</span>
                  <span style={{color:'#6366f1',fontWeight:'700'}}>50,000 UZS</span>
                </div>
              </div>
              <p style={{color:'#9ca3af',fontSize:'13px',textAlign:'center'}}>To&apos;lovdan so&apos;ng admin 24 soat ichida Premiumni faollashtiradi</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  const fileUrl = article.file_url || article.pdf_url
  return (
    <div style={{width:'100vw',height:'100vh',display:'flex',flexDirection:'column',background:'#0f0f1a'}}>
      <div style={{height:'48px',display:'flex',alignItems:'center',padding:'0 16px',background:'#1e1e30',borderBottom:'1px solid #2d2d4e',flexShrink:0}}>
        <button onClick={() => router.push('/articles')} style={{background:'none',border:'none',color:'white',cursor:'pointer',fontSize:'14px'}}>
          ← {article.title}
        </button>
      </div>
      <iframe src={fileUrl} style={{flex:1,border:'none',width:'100%'}} title={article.title} />
    </div>
  )
}
