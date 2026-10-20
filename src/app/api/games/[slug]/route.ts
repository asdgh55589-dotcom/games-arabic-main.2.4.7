import type { NextRequest } from 'next/server'
import { setCacheControl } from '@/lib/api-cache'
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

  // Section 4 item 27: single game is public, cache like mods/[slug] (60/300).
  const res = ok(serialize(game))
  setCacheControl(res.headers, { type: 'public', maxAge: 60, swr: 300 })
  return res
}
