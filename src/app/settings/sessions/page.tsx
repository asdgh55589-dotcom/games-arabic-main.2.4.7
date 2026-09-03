import type { Metadata } from 'next'
import SessionsView from '@/views/settings-sessions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'الأجهزة المتصلة — Games Arabic',
  description: 'إدارة جلساتك النشطة والأجهزة المتصلة',
  robots: { index: false, follow: false },
}

export default function SessionsRoutePage() {
  return <SessionsView />
}
