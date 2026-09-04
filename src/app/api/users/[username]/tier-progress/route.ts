import type { NextRequest } from 'next/server'
import { internalError, notFound, ok } from '@/lib/api-response'
import { db } from '@/lib/db'
import { calculateUserTier } from '@/lib/tier-engine'

interface RouteParams {
  params: Promise<{ username: string }>
}

// GET /api/users/[username]/tier-progress — تقدم المستوى للعرض في البروفايل
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true, role: true, tier: true },
    })
    if (!user) return notFound('المستخدم غير موجود')

    const result = await calculateUserTier(user.id)
    return ok(result)
  } catch (err) {
    console.error('[tier-progress GET] failed:', err)
    return internalError('فشل جلب تقدم المستوى')
  }
}
