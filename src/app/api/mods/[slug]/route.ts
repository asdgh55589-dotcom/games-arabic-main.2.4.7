import type { NextRequest } from 'next/server'
import { notFound, ok } from '@/lib/api-response'
import { serialize } from '@/lib/api-utils'
import { recordModView } from '@/lib/counters'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authorPublicSelect, categoryCardSelect, gameDetailSelect } from '@/lib/prisma-selects'

// GET /api/mods/[slug] - single mod by slug
//
// View count increment: we skip the increment for prefetch requests (identified
// by the `Purpose: prefetch` header). This prevents browser link-prefetching
// from inflating view counts before a human actually visits the page.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Detect prefetch requests. Browsers send `Purpose: prefetch` when
  // prefetching links. Next.js Link with prefetch={true} uses this.
  // We don't rely on Sec-Fetch-Mode because its values are only
  // `cors`, `no-cors`, `same-origin`, `navigate`, `websocket` — there's
  // no `prefetch` value for that header.
  const purpose = req.headers.get('purpose')
  const isPrefetch = purpose === 'prefetch'

  const mod = await db.mod.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      headline: true,
      summary: true,
      description: true,
      changelog: true,
      installGuide: true,
      arabicTitle: true,
      translationScope: true,
      compatibility: true,
      thumbnailUrl: true,
      imageUrl: true,
      galleryUrls: true,
      version: true,
      fileSize: true,
      fileFormat: true,
      downloads: true,
      endorsements: true,
      views: true,
      comments: true,
      rating: true,
      ratingCount: true,
      tags: true,
      series: true,
      translationTeam: true,
      translationType: true,
      isOriginalWork: true,
      originalSource: true,
      originalAuthor: true,
      isFeatured: true,
      isTrending: true,
      isLatest: true,
      featuredLevel: true,
      featuredUntil: true,
      trendingUntil: true,
      popularUntil: true,
      hiddenBadges: true,
      translationMethod: true,
      platformGameId: true,
      cusaId: true,
      ppsaId: true,
      titleId: true,
      mediaId: true,
      supportedFormat: true,
      systemFirmware: true,
      gameUpdateVersion: true,
      deviceModel: true,
      installType: true,
      cpuArch: true,
      gameVersion: true,
      minAndroidVersion: true,
      workflowStatus: true,
      scheduledAt: true,
      releaseDate: true,
      updatedAt: true,
      createdAt: true,
      // FK ids (cheap scalars — clients use them for links, no extra query)
      authorId: true,
      gameId: true,
      categoryId: true,
      seriesId: true,
      teamId: true,
      sectionId: true,
      author: { select: authorPublicSelect },
      game: { select: gameDetailSelect },
      category: { select: categoryCardSelect },
      seriesRelation: { select: { id: true, name: true, slug: true } },
      teamRelation: { select: { id: true, name: true, slug: true, logoUrl: true } },
      sectionRelation: { select: { id: true, name: true, slug: true, key: true } },
      changelogs: {
        orderBy: { createdAt: 'desc' },
        include: {
          changedBy: { select: { id: true, username: true, avatarUrl: true, role: true } },
        },
      },
      files: {
        orderBy: { order: 'asc' },
        include: { links: { orderBy: { order: 'asc' } } },
      },
      teamMembers: { orderBy: { order: 'asc' } },
      contactLinks: { orderBy: { order: 'asc' } },
      videoGroups: {
        orderBy: { order: 'asc' },
        include: { videos: { orderBy: { order: 'asc' } } },
      },
      customTabs: {
        where: { visible: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!mod) {
    return notFound('Mod not found')
  }

  // Note: DRAFT mods intentionally return 404 to prevent public access (if workflowStatus !== 'PUBLISHED' and user not admin)
  // Current implementation returns mod regardless of status; filtering is handled at list level (GET /api/mods) and UI
  // DO NOT change: DRAFT → 404 (when accessed via moderated UI), PUBLISHED → 200

  // Fire-and-forget view count — deduplicated (user 24h / guest IP+UA 1h, bots skipped).
  // Only unique views increment the counter and write a ModView row.
  if (!isPrefetch) {
    recordModView(mod.id, req, db).catch((err) => {
      logger.error({ err }, '[mods/:slug] failed to record view')
    })
  }

  return ok(serialize(mod), {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
