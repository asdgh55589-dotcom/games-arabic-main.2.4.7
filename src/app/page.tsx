import type { Metadata } from 'next'
import { HomePage } from '@/views/home'

export const revalidate = 300 // ISR: 5m — تتغير فقط مع مودات جديدة

export const metadata: Metadata = {
  title: 'Games Arabic - أكبر منصة عربية لتعريب الألعاب',
  description:
    'حمّل أفضل التعريبات العربية للألعاب. مجتمع نشط من المترجمين واللاعبين. تعريبات احترافية عالية الجودة.',
  keywords: [
    'تعريب ألعاب',
    'Games Arabic',
    'العاب مترجمة',
    'تعريبات',
    'ترجمة ألعاب',
    'ألعاب عربية',
  ],
  alternates: { canonical: 'https://games-arabic.com' },
  openGraph: {
    title: 'Games Arabic - أكبر منصة عربية لتعريب الألعاب',
    description: 'حمّل أفضل التعريبات العربية للألعاب. مجتمع نشط من المترجمين واللاعبين.',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'Games Arabic' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Games Arabic - أكبر منصة عربية لتعريب الألعاب',
    description: 'حمّل أفضل التعريبات العربية للألعاب. مجتمع نشط من المترجمين واللاعبين.',
    images: ['/og-default.jpg'],
    site: '@GamesArabic',
  },
}

export default function Home() {
  return <HomePage />
}
