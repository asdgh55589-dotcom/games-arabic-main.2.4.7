import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'فرق التعريب - Games Arabic',
  description: 'تعرف على فرق التعريب النشطة على Games Arabic - مجتمع المترجمين المحترفين',
  keywords: ['فرق التعريب', 'Games Arabic', 'مترجمين', 'فريق', 'تعريب ألعاب'],
  alternates: { canonical: 'https://games-arabic.com/teams' },
  openGraph: {
    title: 'فرق التعريب - Games Arabic',
    description: 'تعرف على فرق التعريب النشطة على Games Arabic',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/teams',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'فرق التعريب - Games Arabic',
    description: 'تعرف على فرق التعريب النشطة على Games Arabic',
  },
}

const TranslationTeamsPage = dynamic(
  () => import('@/views/translation-teams').then((m) => ({ default: m.TranslationTeamsPage })),
  {
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
)
export default function TeamsRoutePage() {
  return <TranslationTeamsPage />
}
