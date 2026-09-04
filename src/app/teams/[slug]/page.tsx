import type { Metadata } from 'next'
import { TeamDetailPage } from '@/views/team-detail'

interface TeamDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: TeamDetailPageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/teams/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: 300 },
      },
    )
    if (!res.ok) return { title: 'فريق تعريب | Games Arabic' }
    const { data } = await res.json()
    const team = data?.team

    if (!team) return { title: 'فريق تعريب | Games Arabic' }

    const title = `${team.name} - فريق تعريب | Games Arabic`
    const description =
      team.description?.slice(0, 160) ||
      `فريق ${team.name} للتعريب العربي - تعرف على أعمال الفريق وإنجازاته`
    const imageUrl = team.logoUrl || team.bannerUrl || `https://games-arabic.com/og-default.jpg`

    return {
      title,
      description,
      keywords: [team.name, 'فريق تعريب', 'Games Arabic', 'تعريب ألعاب', 'مترجمين'],
      authors: [{ name: team.name }],
      alternates: { canonical: `https://games-arabic.com/teams/${encodeURIComponent(team.slug)}` },
      openGraph: {
        title,
        description,
        images: [{ url: imageUrl, width: 1200, height: 630, alt: team.name }],
        type: 'website',
        siteName: 'Games Arabic',
        locale: 'ar_AR',
        url: `https://games-arabic.com/teams/${encodeURIComponent(team.slug)}`,
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
    return { title: 'فريق تعريب | Games Arabic' }
  }
}

export default function TeamDetailRoutePage() {
  return <TeamDetailPage />
}
