import type { Metadata } from 'next'
import { breadcrumbJsonLd, modJsonLd } from '@/lib/seo/structured-data'
import { ModDetailPage } from '@/views/mod-detail'

export const revalidate = 300 // ISR: 5m — بيانات التعريب نادراً ما تتغير

export async function generateStaticParams() {
  try {
    const { db } = await import('@/lib/db')
    const topMods = await db.mod.findMany({
      where: { workflowStatus: 'PUBLISHED' },
      orderBy: { downloads: 'desc' },
      take: 100,
      select: { slug: true },
    })
    return topMods.map((mod) => ({ slug: mod.slug }))
  } catch (error) {
    console.error('[generateStaticParams:mod] Failed:', error)
    return []
  }
}

interface ModPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ModPageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/mods/${slug}`,
      {
        next: { revalidate: 300 },
      },
    )
    if (!res.ok) return { title: 'تعريب غير موجود | Games Arabic' }
    const { data: mod } = await res.json()

    if (!mod) return { title: 'تعريب غير موجود | Games Arabic' }

    const ratingText = mod.rating ? `تقييم ${mod.rating}/5` : ''
    const downloadsText = mod.downloads
      ? `${Number(mod.downloads).toLocaleString('ar-EG')} تحميل`
      : ''
    const rawDesc = mod.description || mod.summary || 'تعريب احترافي لألعابك المفضلة بالعربية'
    const description = `${rawDesc.substring(0, 155)} ${ratingText} ${downloadsText}`.trim()
    const title = `${mod.name} - تعريب ${mod.game?.name || ''} | Games Arabic`
    const imageUrl =
      mod.thumbnailUrl ||
      mod.imageUrl ||
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/og-default.jpg`

    return {
      title,
      description,
      keywords: [mod.name, mod.game?.name, 'تعريب', 'ترجمة', 'العربية', 'تعريب ألعاب'].filter(
        Boolean,
      ) as string[],
      authors: [{ name: mod.author?.username || 'Games Arabic' }],
      alternates: { canonical: `https://games-arabic.com/mod/${mod.slug}` },
      openGraph: {
        title,
        description,
        url: `https://games-arabic.com/mod/${mod.slug}`,
        siteName: 'Games Arabic',
        images: [{ url: imageUrl, width: 1200, height: 630, alt: mod.name }],
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
    return { title: 'تعديل — Games Arabic' }
  }
}

export default async function ModRoutePage({ params }: ModPageProps) {
  let mod: any = null
  try {
    const { slug } = await params
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/mods/${slug}`,
      {
        next: { revalidate: 300 },
      },
    )
    if (res.ok) {
      const json = await res.json()
      mod = json.data
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod page operation
  }
  return (
    <>
      {mod && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(modJsonLd(mod)) }}
        />
      )}
      {mod && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              breadcrumbJsonLd(
                [
                  { name: 'الرئيسية', url: 'https://games-arabic.com' },
                  ...(mod.game?.slug
                    ? [
                        {
                          name: mod.game.name,
                          url: `https://games-arabic.com/games/${mod.game.slug}`,
                        },
                      ]
                    : []),
                  { name: mod.name, url: `https://games-arabic.com/mod/${mod.slug}` },
                ],
              ),
            ),
          }}
        />
      )}
      <ModDetailPage />
    </>
  )
}
