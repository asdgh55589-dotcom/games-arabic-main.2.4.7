import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'الوثائق - Games Arabic',
  description:
    'وثائق Games Arabic - دعم الأقسام ومشاكل وحلول لكل المنصات (PC, Xbox 360, NS, PS1-PS5, Android)',
  keywords: ['الوثائق', 'الدعم', 'مشاكل وحلول', 'Games Arabic', 'تعريب'],
  alternates: { canonical: 'https://games-arabic.com/docs' },
  openGraph: {
    title: 'الوثائق - Games Arabic',
    description: 'دعم الأقسام ومشاكل وحلول لكل المنصات',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/docs',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'الوثائق - Games Arabic',
    description: 'دعم الأقسام ومشاكل وحلول لكل المنصات',
  },
}

const DocsPage = dynamic(() => import('@/views/docs').then((m) => ({ default: m.DocsPage })), {
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
})

export default function DocsRoutePage() {
  return <DocsPage />
}
