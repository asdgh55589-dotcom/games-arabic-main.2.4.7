import type { Metadata } from 'next'
import { SupportPage } from '@/views/support'

export const revalidate = 3600 // ISR: 1h — صفحة شبه ثابتة

export const metadata: Metadata = {
  title: 'الدعم والمساعدة - Games Arabic',
  description:
    'مركز المساعدة والدعم الفني لمنصة Games Arabic - إجابات لأسئلتك واستفساراتك ودليل الاستخدام.',
  keywords: ['الدعم', 'المساعدة', 'Games Arabic', 'دليل الاستخدام', 'مركز المساعدة'],
  alternates: { canonical: 'https://games-arabic.com/support' },
  openGraph: {
    title: 'الدعم والمساعدة - Games Arabic',
    description: 'مركز المساعدة والدعم الفني لمنصة Games Arabic - إجابات لأسئلتك واستفساراتك.',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/support',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'الدعم والمساعدة - Games Arabic',
    description: 'مركز المساعدة والدعم الفني لمنصة Games Arabic.',
  },
}

export default function SupportRoutePage() {
  return <SupportPage />
}
