import type { Metadata } from 'next'
import { ResetPasswordPage } from '@/views/reset-password'

export const metadata: Metadata = {
  title: 'تعيين كلمة مرور جديدة — GAMES ARABIC',
  description: 'عيّن كلمة مرور جديدة لحسابك عبر رابط الاستعادة',
  robots: { index: false, follow: false },
}

export default function ResetPasswordRoutePage() {
  return <ResetPasswordPage />
}
