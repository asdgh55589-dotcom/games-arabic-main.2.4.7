import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { revalidateTag } from '@/lib/cache'
import { ok, validationFail, internalError } from '@/lib/api-response'

// GET /api/admin/ads — قائمة كل الإعلانات
export async function GET() {
  try {
    await requireModerator()
    const ads = await db.homepageAd.findMany({
      take: 10,
      select: {
        id: true,
        type: true,
        url: true,
        title: true,
        description: true,
        link: true,
        size: true,
        order: true,
        visible: true,
        createdAt: true,
        clicksCount: true,
      },
      orderBy: { order: 'asc' },
    })
    return ok(ads)
  } catch (err) {
    console.error('[admin/ads GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}

// POST /api/admin/ads — إنشاء إعلان جديد
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    if (!body.url) {
      return validationFail({ url: 'url مطلوب' })
    }

    const ad = await db.homepageAd.create({
      data: {
        type: body.type || 'youtube',
        url: body.url,
        title: body.title || '',
        description: body.description || '',
        link: body.link || null,
        size: body.size || 'medium',
        order: body.order || 0,
        visible: body.visible !== undefined ? Boolean(body.visible) : true,
      },
    })

    await revalidateTag('ads')

    return ok(ad)
  } catch (err) {
    console.error('[admin/ads POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}
