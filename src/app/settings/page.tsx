import type { Metadata } from 'next'
import { SettingsPage } from '@/views/settings'

export const dynamic = 'force-dynamic' // شخصي — يجب أن يكون مباشراً

export const metadata: Metadata = {
  title: 'الإعدادات — GAMES ARABIC',
  description: 'إدارة حسابك وإعداداتك الشخصية',
  robots: { index: false, follow: false },
}

export default function SettingsRoutePage() {
  return <SettingsPage />
}
