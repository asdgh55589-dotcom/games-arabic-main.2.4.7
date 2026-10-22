import type { NextRequest } from 'next/server'
import { internalError, okPaginated } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/admin/endorsements — قائمة كل التأييدات
export async function GET(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const modId = searchParams.get('modId')

    const where: Record<string, unknown> = {}
    if (modId) where.modId = modId

    const [total, endorsements] = await Promise.all([
      db.endorsement.count({ where }),
      db.endorsement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          mod: { select: { id: true, name: true, slug: true } },
        },
      }),
    ])

    // إحصائيات (مفلترة حسب modId لو موجود)
    //
    // المفردات الحقيقية للتفاعل (4 أنواع): fire | sparkle | thumbsup | thumbsdown
    // (القيم القديمة 'up'/'down' لم تعد تُكتب — التطبيع في مخطط البيانات).
    // thumbsdown ليس إعجاباً: likes = fire + sparkle + thumbsup فقط.
    const statsWhere: { modId?: string } = modId ? { modId } : {}
    const [grouped, topMods] = await Promise.all([
      db.endorsement.groupBy({
        by: ['value'],
        where: statsWhere,
        _count: { value: true },
      }),
      db.mod.findMany({
        orderBy: { endorsements: 'desc' },
        take: 10,
        select: { id: true, name: true, slug: true, endorsements: true },
      }),
    ])

    const countByValue = new Map<string, number>(grouped.map((g) => [g.value, g._count.value]))
    const fire = countByValue.get('fire') ?? 0
    const sparkle = countByValue.get('sparkle') ?? 0
    const thumbsup = countByValue.get('thumbsup') ?? 0
    const thumbsdown = countByValue.get('thumbsdown') ?? 0
    const likes = fire + sparkle + thumbsup
    const reactionTotal = likes + thumbsdown

    return okPaginated(
      {
        endorsements,
        stats: {
          //Reaction breakdown (the real 4-type vocabulary)
          fire,
          sparkle,
          thumbsup,
          thumbsdown,
          // Positive reactions only — thumbsdown is NOT a like
          likes,
          // All four reaction types
          total: reactionTotal,
          // Legacy aliases kept for the existing admin panel:
          // "up" = positive reactions, "down" = negative reactions
          up: likes,
          down: thumbsdown,
        },
        topMods,
      },
      { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    )
  } catch (err) {
    logger.error('[admin/endorsements GET] failed:', err)
    return internalError('Failed')
  }
}
