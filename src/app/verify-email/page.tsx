import type { Metadata } from 'next'
import VerifyEmailView from '@/views/verify-email'

export const metadata: Metadata = {
  title: 'تأكيد البريد — Games Arabic',
  description: 'فعّل حسابك عبر رابط التأكيد',
  robots: { index: false, follow: false },
}

export default function VerifyEmailPage() {
  return <VerifyEmailView />
}
