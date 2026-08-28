import type { Metadata } from 'next'
import { ProblemsPage } from '@/views/problems'

export const metadata: Metadata = {
  title: 'مشاكل وحلول - Games Arabic',
  description: 'دليل شامل لملاحظات التركيب، الأدلة الكاملة، والأسئلة الشائعة لمنصة Games Arabic',
  keywords: ['مشاكل', 'حلول', 'دليل', 'Games Arabic', 'تركيب التعريب'],
  alternates: { canonical: 'https://games-arabic.com/problems' },
  openGraph: {
    title: 'مشاكل وحلول - Games Arabic',
    description: 'دليل شامل لملاحظات التركيب والأسئلة الشائعة',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/problems',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مشاكل وحلول - Games Arabic',
    description: 'دليل شامل لملاحظات التركيب والأسئلة الشائعة',
  },
}

export default function ProblemsRoutePage() {
  return <ProblemsPage />
}
