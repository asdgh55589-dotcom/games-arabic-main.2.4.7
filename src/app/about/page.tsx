import type { Metadata } from 'next'
import { AboutPage } from '@/views/about'

export const revalidate = 3600 // ISR: 1h — صفحة شبه ثابتة

export const metadata: Metadata = {
  title: 'عن الموقع - Games Arabic',
  description:
    'أكبر منصة عربية لتعريب الألعاب، نوفر تعريبات احترافية عالية الجودة لمجتمع اللاعبين العرب.',
  keywords: ['تعريب ألعاب', 'ترجمة ألعاب', 'Games Arabic', 'العاب مترجمة', 'عن الموقع'],
  alternates: { canonical: 'https://games-arabic.com/about' },
  openGraph: {
    title: 'عن الموقع - Games Arabic',
    description:
      'أكبر منصة عربية لتعريب الألعاب، نوفر تعريبات احترافية عالية الجودة لمجتمع اللاعبين العرب.',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'عن الموقع - Games Arabic',
    description:
      'أكبر منصة عربية لتعريب الألعاب، نوفر تعريبات احترافية عالية الجودة لمجتمع اللاعبين العرب.',
  },
}

export default function AboutRoutePage() {
  return <AboutPage />
}
