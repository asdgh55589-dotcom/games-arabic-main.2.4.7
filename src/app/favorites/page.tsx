import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'المفضلة - Games Arabic',
  description: 'قائمة ألعابك وتعريباتك المفضلة على Games Arabic - تابع تحديثاتها بسهولة',
  keywords: ['المفضلة', 'Games Arabic', 'ألعاب مفضلة', 'تعريبات'],
  alternates: { canonical: 'https://games-arabic.com/favorites' },
  robots: { index: false, follow: false },
}

const FavoritesPage = dynamic(() => import('@/views/favorites').then(m => ({ default: m.FavoritesPage })), { loading: () => <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> })

export default function FavoritesRoutePage() { return <FavoritesPage /> }
