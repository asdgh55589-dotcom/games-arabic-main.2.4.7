import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'البحث - Games Arabic',
  description: 'ابحث عن أفضل التعريبات والألعاب على Games Arabic - نتائج سريعة ودقيقة',
  keywords: ['بحث', 'Games Arabic', 'تعريب', 'ألعاب', 'ترجمة'],
  alternates: { canonical: 'https://games-arabic.com/search' },
  openGraph: {
    title: 'البحث - Games Arabic',
    description: 'ابحث عن أفضل التعريبات والألعاب على Games Arabic',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/search',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'البحث - Games Arabic',
    description: 'ابحث عن أفضل التعريبات والألعاب على Games Arabic',
  },
}

const SearchPage = dynamic(() => import('@/views/search').then(m => ({ default: m.SearchPage })), { loading: () => <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> })

export default function SearchRoutePage() { return <SearchPage /> }
