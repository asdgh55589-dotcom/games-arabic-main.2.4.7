import type { Metadata } from 'next'
import { CommunityPage } from '@/views/community'

export const metadata: Metadata = {
  title: 'المجتمع - Games Arabic',
  description: 'انضم لمجتمع التعريب العربي — تواصل، شارك، وساهم في تعريب ألعابك المفضلة',
  keywords: ['مجتمع', 'Games Arabic', 'تعريب', 'مترجمين', 'ألعاب عربية'],
  alternates: { canonical: 'https://games-arabic.com/community' },
  openGraph: {
    title: 'المجتمع - Games Arabic',
    description: 'انضم لمجتمع التعريب العربي',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/community',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'المجتمع - Games Arabic',
    description: 'انضم لمجتمع التعريب العربي',
  },
}

export default function CommunityRoutePage() {
  return <CommunityPage />
}
