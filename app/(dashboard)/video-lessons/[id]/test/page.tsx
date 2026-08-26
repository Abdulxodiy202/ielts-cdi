'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Video darsliklar uchun test/ball berish feature'i foydalanuvchi so'rovi
// bo'yicha butunlay olib tashlandi -- endi hech qanday savol-javob, ball
// saqlash, leaderboard'ga yulduz qo'shish yoki study-plan progress'ini
// oshirish sodir bo'lmaydi (bularning barchasi shu sahifaning eski
// kodida edi). Route atayin qoldirilgan -- eski link/bookmark orqali shu
// yerga kirib qolgan foydalanuvchi darhol video sahifasiga qaytariladi,
// 404 ko'rsatish o'rniga.
export default function VideoTestPage() {
  const router = useRouter()
  const params = useParams()
  const videoId = params?.id as string | undefined

  useEffect(() => {
    router.replace(videoId ? `/video-lessons/${videoId}` : '/video-lessons')
  }, [router, videoId])

  return null
}
