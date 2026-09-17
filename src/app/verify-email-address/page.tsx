import type { Metadata } from 'next'
import { VerifyEmailAddressView } from '@/views/verify-email-address'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'تأكيد البريد الإلكتروني — GAMES ARABIC',
  description: 'أكّد بريدك الإلكتروني عبر رابط التحقق',
  robots: { index: false, follow: false },
}

export default function VerifyEmailAddressPage() {
  return <VerifyEmailAddressView />
}
