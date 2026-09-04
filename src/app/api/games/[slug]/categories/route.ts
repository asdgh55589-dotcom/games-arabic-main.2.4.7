import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, internalError } from '@/lib/api-response'

// GET /api/games/[slug]/categories — أقسام لعبة معينة
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const game = await db.game.findUnique({
      where: { slug },
      include: { categories: true },
    })

    if (!game) {
      return notFound('Game not found')
    }

    return ok(game.categories)
  } catch (err) {
    console.error('[api/games/[slug]/categories] failed:', err)
    return internalError('Failed to fetch categories')
  }
}
