import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ tier: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { tier: tierStr } = await params
    const tier = parseInt(tierStr, 10)
    const body = await request.json()

    const rule = await db.tierRule.update({
      where: { tier },
      data: {
        name: body.name,
        nameEn: body.nameEn,
        requiredMods: body.requiredMods,
        requiredDownloads: body.requiredDownloads,
        requiredRating: body.requiredRating,
        requiredQualityScore: body.requiredQualityScore,
        badge: body.badge,
        badgeColor: body.badgeColor,
        features: JSON.stringify(body.features || []),
      },
    })

    return ok({ rule })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { tier: tierStr } = await params
    const tier = parseInt(tierStr, 10)

    await db.tierRule.delete({ where: { tier } })

    return ok({ message: 'تم الحذف' })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
