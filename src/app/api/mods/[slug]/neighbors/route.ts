import { notFound, ok } from '@/lib/api-response'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ slug: string }>
}

const navSelect = { slug: true, name: true } as const

// GET /api/mods/[slug]/neighbors — previous/next mod within the same game.
//
// Replaces the client pattern of fetching up to 100 full ModSummary rows
// (`/api/games/:slug/mods?limit=100`) just to find two adjacent links.
// Ordering mirrors that list (downloads desc); navigation stays circular.
export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params

  const mod = await db.mod.findUnique({
    where: { slug },
    select: { id: true, gameId: true },
  })
  if (!mod) {
    return notFound('Mod not found')
  }

  const where = mod.gameId ? { gameId: mod.gameId } : {}
  const ids = await db.mod.findMany({
    where,
    orderBy: { downloads: 'desc' },
    select: { id: true },
  })

  const idx = ids.findIndex((m) => m.id === mod.id)
  if (idx === -1 || ids.length <= 1) {
    return ok(
      { previous: null, next: null },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
    )
  }

  const prevId = ids[(idx - 1 + ids.length) % ids.length].id
  const nextId = ids[(idx + 1) % ids.length].id
  const [previous, next] = await Promise.all([
    db.mod.findUnique({ where: { id: prevId }, select: navSelect }),
    db.mod.findUnique({ where: { id: nextId }, select: navSelect }),
  ])

  return ok(
    { previous, next },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
  )
}
