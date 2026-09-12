import type { Metadata } from 'next'
import { OfficialLoginPage } from '@/components/official-login/login-page'

export const metadata: Metadata = {
  title: 'تسجيل الدخول — GAMES ARABIC',
  description: 'سجل دخولك للوصول إلى التعريبات والميزات الحصرية',
  robots: { index: false, follow: false },
}

export default function LoginRoutePage() {
  return <OfficialLoginPage />
}
