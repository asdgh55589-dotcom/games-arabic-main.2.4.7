import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serialize } from '@/lib/api-utils'
import type { ModDetail, ApiError } from '@/lib/types'

// GET /api/mods/[slug] - single mod by slug
//
// View count increment: we skip the increment for prefetch requests (identified
// by the `Purpose: prefetch` header). This prevents browser link-prefetching
// from inflating view counts before a human actually visits the page.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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
    include: {
      author: true,
      game: true,
      category: true,
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
    return NextResponse.json<ApiError>(
      { error: 'Mod not found' },
      { status: 404 }
    )
  }

  // Fire-and-forget view count increment — but only for real user visits,
  // not prefetch requests.
  if (!isPrefetch) {
    db.mod
      .update({
        where: { id: mod.id },
        data: { views: { increment: 1 } },
      })
      .catch((err) => {
        console.error('[mods/:slug] failed to increment views:', err)
      })
  }

  return NextResponse.json<{ mod: ModDetail }>({ mod: serialize(mod) })
}
