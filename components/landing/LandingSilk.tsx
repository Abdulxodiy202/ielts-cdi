'use client'

import Silk from '@/components/backgrounds/Silk'
import { useTheme } from '@/components/providers/ThemeProvider'

// Kirish sahifasining Silk foni endi profildan tanlangan temaga qarab
// rangini almashtiradi: dark -> to'q indigo, light -> yumshoq ko'k
// ("Ocean Blue" bilan mos). 2026-08-27 tuzatish: avval bu rang qattiq
// #2d1b69 ga qotirilgan edi -- shu sabab light temada ham sahifa doim
// to'q ko'rinardi. Endi useTheme() orqali reaktiv.
const SILK_COLOR: Record<string, string> = {
  dark: '#2d1b69',
  light: '#8fb7ec',
}

export function LandingSilk() {
  const { theme } = useTheme()
  const color = SILK_COLOR[theme] ?? SILK_COLOR.dark

  return (
    <Silk speed={5} scale={1} color={color} noiseIntensity={2.5} rotation={1.5} />
  )
}
