import type { NextRequest } from 'next/server'
import { notFound, ok } from '@/lib/api-response'
import { serialize } from '@/lib/api-utils'
import { db } from '@/lib/db'

// GET /api/games/[slug] - get a single game by slug with its categories
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await db.game.findUnique({
    where: { slug },
    include: {
      categories: true,
      _count: { select: { mods: true } },
    },
  })

  if (!game) {
    return notFound('Game not found')
  }

  return ok(serialize(game))
}
