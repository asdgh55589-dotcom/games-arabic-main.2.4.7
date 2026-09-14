import type { Metadata } from 'next'
import { OnboardingPage } from '@/views/onboarding'

export const metadata: Metadata = {
  title: 'إعداد الحساب — GAMES ARABIC',
  description: 'أكمل إعداد حسابك: أكّد بياناتك واختر اسم المستخدم وكلمة المرور',
  robots: { index: false, follow: false },
}

export default function OnboardingRoutePage() {
  return <OnboardingPage />
}
