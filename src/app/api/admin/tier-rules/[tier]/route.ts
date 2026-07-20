import { NextRequest, NextResponse } from 'next/server'
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
        features: JSON.stringify(body.features || [])
      }
    })

    return NextResponse.json({ rule })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
