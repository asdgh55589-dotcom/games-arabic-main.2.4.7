import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'السلاسل - Games Arabic',
  description: 'تصفح جميع سلاسل التعريب على Games Arabic - سلاسل ألعاب مترجمة بشكل احترافي',
  keywords: ['سلاسل', 'Games Arabic', 'تعريب ألعاب', 'سلاسل مترجمة'],
  alternates: { canonical: 'https://games-arabic.com/series' },
  openGraph: {
    title: 'السلاسل - Games Arabic',
    description: 'تصفح جميع سلاسل التعريب على Games Arabic',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/series',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'السلاسل - Games Arabic',
    description: 'تصفح جميع سلاسل التعريب على Games Arabic',
  },
}

const SeriesPage = dynamic(() => import('@/views/series').then(m => ({ default: m.SeriesPage })), { loading: () => <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> })
export default function SeriesRoutePage() { return <SeriesPage /> }
