import type { Metadata } from 'next'
import { GamesPage } from '@/views/games'

export const metadata: Metadata = {
  title: 'الألعاب - Games Arabic',
  description: 'تصفح جميع الألعاب المدعومة بالتعريب على Games Arabic — PC و NS و PS1-PS4 وأكثر.',
  keywords: ['الألعاب', 'Games Arabic', 'تعريب ألعاب', 'ألعاب مترجمة', 'PC', 'PlayStation'],
  alternates: { canonical: 'https://games-arabic.com/games' },
  openGraph: {
    title: 'الألعاب - Games Arabic',
    description: 'تصفح جميع الألعاب المدعومة بالتعريب على Games Arabic',
    type: 'website',
    siteName: 'Games Arabic',
    locale: 'ar_AR',
    url: 'https://games-arabic.com/games',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'الألعاب - Games Arabic',
    description: 'تصفح جميع الألعاب المدعومة بالتعريب على Games Arabic',
  },
}

export default function GamesRoutePage() {
  return <GamesPage />
}
