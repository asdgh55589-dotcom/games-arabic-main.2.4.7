import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, okPaginated, internalError, validationFail, conflict } from '@/lib/api-response'

export async function GET() {
  try {
    await requireAdmin()
    const rules = await db.tierRule.findMany({ orderBy: { tier: 'asc' } })
    return ok({ rules })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()

    if (body.tier === undefined || body.tier === null) {
      return validationFail({ error: 'رقم المستوى مطلوب' })
    }

    const tier = parseInt(String(body.tier), 10)
    if (isNaN(tier) || tier < 1 || tier > 99) {
      return validationFail({ error: 'رقم المستوى غير صالح' })
    }

    const exists = await db.tierRule.findUnique({ where: { tier } })
    if (exists) {
      return conflict('هذا المستوى موجود بالفعل')
    }

    const rule = await db.tierRule.create({
      data: {
        tier,
        name: body.name || '',
        nameEn: body.nameEn || '',
        requiredMods: body.requiredMods || 0,
        requiredDownloads: body.requiredDownloads || 0,
        requiredRating: body.requiredRating || 0,
        requiredQualityScore: body.requiredQualityScore || 0,
        badge: body.badge || '',
        badgeColor: body.badgeColor || '#6b7280',
        features: JSON.stringify(body.features || []),
      },
    })

    return ok({ rule })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
