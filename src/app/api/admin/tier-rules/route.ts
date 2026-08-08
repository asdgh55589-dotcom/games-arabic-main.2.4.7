import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const rules = await db.tierRule.findMany({ orderBy: { tier: 'asc' } })
    return NextResponse.json({ rules })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()

    if (body.tier === undefined || body.tier === null) {
      return NextResponse.json({ error: 'رقم المستوى مطلوب' }, { status: 400 })
    }

    const tier = parseInt(String(body.tier), 10)
    if (isNaN(tier) || tier < 1 || tier > 99) {
      return NextResponse.json({ error: 'رقم المستوى غير صالح' }, { status: 400 })
    }

    const exists = await db.tierRule.findUnique({ where: { tier } })
    if (exists) {
      return NextResponse.json({ error: 'هذا المستوى موجود بالفعل' }, { status: 409 })
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
        features: JSON.stringify(body.features || [])
      }
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
