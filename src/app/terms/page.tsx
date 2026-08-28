import type { Metadata } from 'next'
import { TermsPage } from '@/views/terms'

export const revalidate = 3600 // ISR: 1h — صفحة شبه ثابتة

export const metadata: Metadata = {
  title: 'شروط الاستخدام - Games Arabic',
  description: 'شروط استخدام موقع Games Arabic - تعرف على حقوقك ومسؤولياتك عند استخدام المنصة.',
  keywords: ['شروط الاستخدام', 'Games Arabic', 'اتفاقية المستخدم'],
  alternates: { canonical: 'https://games-arabic.com/terms' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'شروط الاستخدام - Games Arabic',
    description: 'شروط استخدام موقع Games Arabic - تعرف على حقوقك ومسؤولياتك عند استخدام المنصة.',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/terms',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'شروط الاستخدام - Games Arabic',
    description: 'شروط استخدام موقع Games Arabic - تعرف على حقوقك ومسؤولياتك عند استخدام المنصة.',
  },
}

export default function TermsRoutePage() {
  return <TermsPage />
}
