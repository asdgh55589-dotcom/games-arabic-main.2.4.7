import type { Metadata } from 'next'
import { PrivacyPage } from '@/views/privacy'

export const revalidate = 3600 // ISR: 1h — صفحة شبه ثابتة

export const metadata: Metadata = {
  title: 'سياسة الخصوصية - Games Arabic',
  description: 'تعرف على سياسة الخصوصية لموقع Games Arabic وكيف نحمي بياناتك الشخصية.',
  keywords: ['سياسة الخصوصية', 'Games Arabic', 'حماية البيانات', 'الخصوصية'],
  alternates: { canonical: 'https://games-arabic.com/privacy' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'سياسة الخصوصية - Games Arabic',
    description: 'تعرف على سياسة الخصوصية لموقع Games Arabic وكيف نحمي بياناتك الشخصية.',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/privacy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'سياسة الخصوصية - Games Arabic',
    description: 'تعرف على سياسة الخصوصية لموقع Games Arabic وكيف نحمي بياناتك الشخصية.',
  },
}

export default function PrivacyRoutePage() {
  return <PrivacyPage />
}
