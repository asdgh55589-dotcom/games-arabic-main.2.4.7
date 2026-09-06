import type { Metadata } from 'next'
import { RecoverPage } from '@/views/recover'

export const metadata: Metadata = {
  title: 'استعادة كلمة المرور — GAMES ARABIC',
  description: 'اطلب رابط استعادة كلمة المرور',
  robots: { index: false, follow: false },
}

export default function RecoverRoutePage() {
  return <RecoverPage />
}
