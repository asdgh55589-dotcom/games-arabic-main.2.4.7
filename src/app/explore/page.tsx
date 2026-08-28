import type { Metadata } from 'next'
import { ExplorePage } from '@/views/explore'

export const metadata: Metadata = {
  title: 'استكشف - Games Arabic',
  description: 'استكشف التعريبات حسب نوع الجهاز — PC, Xbox 360, PlayStation, Nintendo Switch وأكثر',
  keywords: ['استكشاف', 'تعريب', 'Games Arabic', 'أجهزة', 'PC', 'PlayStation', 'Xbox'],
  alternates: { canonical: 'https://games-arabic.com/explore' },
  openGraph: {
    title: 'استكشف - Games Arabic',
    description: 'استكشف التعريبات حسب نوع الجهاز',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/explore',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'استكشف - Games Arabic',
    description: 'استكشف التعريبات حسب نوع الجهاز',
  },
}

export default function ExploreRoutePage() {
  return <ExplorePage />
}
