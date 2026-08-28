import type { Metadata } from 'next'
import { GameDetailPage } from '@/views/game-detail'
import { gameJsonLd } from '@/lib/seo/structured-data'

export const revalidate = 300 // ISR: 5m — بيانات الألعاب نادرة التغير

interface GamePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/games/${slug}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return { title: 'لعبة غير موجودة | Games Arabic' }
    const { data: game } = await res.json()

    if (!game) return { title: 'لعبة غير موجودة | Games Arabic' }

    const title = `${game.name} - تعريبات عربية | Games Arabic`
    const rawDesc = game.tagline || game.description || `تحميل تعريبات ${game.name} بالعربي`
    const description = rawDesc.slice(0, 160)
    const imageUrl = game.thumbnailUrl || game.bannerUrl || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/og-default.jpg`

    return {
      title,
      description,
      keywords: [game.name, game.platform, 'تعريب', 'ترجمة', 'العربية', 'تعريب ألعاب', 'تحميل تعريب'].filter(Boolean) as string[],
      authors: [{ name: 'Games Arabic' }],
      alternates: { canonical: `https://games-arabic.com/games/${game.slug}` },
      openGraph: {
        title,
        description,
        url: `https://games-arabic.com/games/${game.slug}`,
        siteName: 'Games Arabic',
        images: [{ url: imageUrl, width: 1200, height: 630, alt: game.name }],
        locale: 'ar_AR',
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
        site: '@GamesArabic',
      },
    }
  } catch {
    return { title: 'لعبة — Games Arabic' }
  }
}

export default async function GameDetailRoutePage({ params }: GamePageProps) {
  let game: any = null
  try {
    const { slug } = await params
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/games/${slug}`, {
      next: { revalidate: 300 },
    })
    if (res.ok) {
      const json = await res.json()
      game = json.data
    }
  } catch {}
  return (
    <>
      {game && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(gameJsonLd(game)) }}
        />
      )}
      <GameDetailPage />
    </>
  )
}
