import type { Metadata } from 'next'
import { NotificationsPage } from '@/views/notifications'

export const metadata: Metadata = {
  title: 'الإشعارات — GAMES ARABIC',
  description: 'تابع آخر الإشعارات والتحديثات',
  robots: { index: false, follow: false },
}

export default function NotificationsRoutePage() {
  return <NotificationsPage />
}
