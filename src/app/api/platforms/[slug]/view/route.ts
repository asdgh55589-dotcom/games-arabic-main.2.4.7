import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUserIdFromRequestCookies } from '@/lib/auth'
import { getClientIP } from '@/lib/counters'
import { ok, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// POST /api/platforms/[slug]/view — تتبع مشاهدات صفحة المنصة
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    if (!slug || slug.length > 50) {
      return ok({ tracked: false })
    }

    const userId = await getUserIdFromRequestCookies(req as unknown as Request).catch(() => null)
    const ip = getClientIP(req as unknown as Request)

    await db.platformView.create({
      data: { platform: slug, userId: userId || null, ipAddress: ip },
    })

    return ok({ tracked: true })
  } catch (err) {
    console.error('[platforms/view] failed:', err)
    return internalError('Failed to track platform view')
  }
}
