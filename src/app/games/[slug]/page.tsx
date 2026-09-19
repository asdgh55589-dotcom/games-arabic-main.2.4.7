import type { Metadata } from 'next'
import { cache } from 'react'
import { gameJsonLd } from '@/lib/seo/structured-data'
import { GameDetailPage } from '@/views/game-detail'

export const revalidate = 300 // ISR: 5m — بيانات الألعاب نادرة التغير

// Single fetch shared by generateMetadata + page component (React cache
// dedupes within the request — one self-fetch per render, not two).
const getGameData = cache(async (slug: string) => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/games/${slug}`,
      {
        next: { revalidate: 300 },
      },
    )
    if (!res.ok) return null
    const { data } = await res.json()
    return data ?? null
  } catch {
    return null
  }
})

export async function generateStaticParams() {
  try {
    const { db } = await import('@/lib/db')
    const topGames = await db.game.findMany({
      orderBy: { totalDownloads: 'desc' },
      take: 50,
      select: { slug: true },
    })
    return topGames.map((game) => ({ slug: game.slug }))
  } catch (error) {
    console.error('[generateStaticParams:games] Failed:', error)
    return []
  }
}

interface GamePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const game = await getGameData(slug)
    if (!game) return { title: 'لعبة غير موجودة | Games Arabic' }

    const title = `${game.name} - تعريبات عربية | Games Arabic`
    const rawDesc = game.tagline || game.description || `تحميل تعريبات ${game.name} بالعربي`
    const description = rawDesc.slice(0, 160)
    const imageUrl =
      game.thumbnailUrl ||
      game.bannerUrl ||
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/og-default.jpg`

    return {
      title,
      description,
      keywords: [
        game.name,
        game.platform,
        'تعريب',
        'ترجمة',
        'العربية',
        'تعريب ألعاب',
        'تحميل تعريب',
      ].filter(Boolean) as string[],
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
    game = await getGameData(slug)
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort view tracking
  }
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
