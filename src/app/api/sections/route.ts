import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(_req: NextRequest) {
  try {
    const sections = await db.section.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        nameEn: true,
        key: true,
        icon: true,
        color: true,
        order: true,
      },
    })

    return ok(sections)
  } catch (err) {
    logger.error('[sections GET] failed:', err)
    return internalError('Failed')
  }
}
