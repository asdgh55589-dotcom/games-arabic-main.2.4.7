import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest) {
  try {
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        gameId: true,
      },
    })

    return ok(categories)
  } catch (err) {
    console.error('[categories GET] failed:', err)
    return internalError('Failed')
  }
}
