import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serialize } from '@/lib/api-utils'
import type { GameDetail, ApiError } from '@/lib/types'

// GET /api/games/[slug] - get a single game by slug with its categories
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const game = await db.game.findUnique({
    where: { slug },
    include: {
      categories: true,
      _count: { select: { mods: true } },
    },
  })

  if (!game) {
    return NextResponse.json<ApiError>(
      { error: 'Game not found' },
      { status: 404 }
    )
  }

  return NextResponse.json<{ game: GameDetail }>({ game: serialize(game) })
}
