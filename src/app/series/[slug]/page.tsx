import type { Metadata } from 'next'
import { SeriesDetailPage } from '@/views/series-detail'

export async function generateStaticParams() {
  try {
    const { db } = await import('@/lib/db')
    const topSeries = await db.series.findMany({
      take: 30,
      select: { slug: true },
    })
    return topSeries.map((s) => ({ slug: s.slug }))
  } catch (error) {
    return []
  }
}

interface SeriesDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: SeriesDetailPageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/series`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return { title: 'سلسلة تعريبات | Games Arabic' }
    const { data: series } = await res.json()
    const seriesItem = series?.find((s: { slug: string; name: string; description?: string }) => s.slug === slug || s.name === slug)

    if (!seriesItem) return { title: 'سلسلة تعريبات | Games Arabic' }

    const title = `${seriesItem.name} - سلسلة تعريبات | Games Arabic`
    const description = seriesItem.description || `تحميل تعريبات ${seriesItem.name} بالعربي - سلسلة كاملة مترجمة`
    const imageUrl = seriesItem.bannerUrl || seriesItem.logoUrl || `https://games-arabic.com/og-default.jpg`

    return {
      title,
      description,
      keywords: [seriesItem.name, 'سلسلة', 'تعريب', 'Games Arabic', 'تعريب ألعاب'],
      authors: [{ name: 'Games Arabic' }],
      alternates: { canonical: `https://games-arabic.com/series/${seriesItem.slug}` },
      openGraph: {
        title,
        description,
        images: [{ url: imageUrl, width: 1200, height: 630, alt: seriesItem.name }],
        type: 'website',
        siteName: 'Games Arabic',
        locale: 'ar_AR',
        url: `https://games-arabic.com/series/${seriesItem.slug}`,
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
    return { title: 'سلسلة تعريبات | Games Arabic' }
  }
}

export default function SeriesDetailRoutePage() {
  return <SeriesDetailPage />
}
