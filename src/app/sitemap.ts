import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://games-arabic.com'

  // Fetch all published content — with fail-safe for each query
  const [mods, games, sections, seriesList, teams] = await Promise.all([
    db.mod
      .findMany({
        where: { workflowStatus: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      })
      .catch(() => [] as { slug: string; updatedAt: Date }[]),
    db.game
      .findMany({ select: { slug: true, updatedAt: true } })
      .catch(() => [] as { slug: string; updatedAt: Date }[]),
    db.section
      .findMany({ select: { key: true, updatedAt: true } })
      .catch(() => [] as { key: string; updatedAt: Date }[]),
    db.series
      .findMany({ select: { slug: true, updatedAt: true } })
      .catch(() => [] as { slug: string; updatedAt: Date }[]),
    db.team
      .findMany({ select: { slug: true, updatedAt: true } })
      .catch(() => [] as { slug: string; updatedAt: Date }[]),
  ])

  const now = new Date()

  return [
    // Static high-priority pages
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/games`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/explore`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/community`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/series`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/teams`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },

    // Dynamic content — mods
    ...mods.map((m) => ({
      url: `${baseUrl}/mod/${m.slug}`,
      lastModified: m.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    // Games
    ...games.map((g) => ({
      url: `${baseUrl}/games/${g.slug}`,
      lastModified: g.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // Platforms (Section key)
    ...sections.map((p) => ({
      url: `${baseUrl}/platform/${p.key}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // Series
    ...seriesList.map((s) => ({
      url: `${baseUrl}/series/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    // Teams
    ...teams.map((t) => ({
      url: `${baseUrl}/teams/${t.slug}`,
      lastModified: t.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
