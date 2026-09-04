import type { NextRequest } from 'next/server'
import { internalError, notFound, ok } from '@/lib/api-response'
import { db } from '@/lib/db'

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
