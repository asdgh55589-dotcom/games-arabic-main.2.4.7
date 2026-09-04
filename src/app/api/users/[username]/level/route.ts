import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, internalError } from '@/lib/api-response'
import { calculateUserTier } from '@/lib/tier-engine'
import { getTierConfig } from '@/lib/tiers'

interface RouteParams {
  params: Promise<{ username: string }>
}

// GET /api/users/[username]/level — بيانات المستوى كما في صفحة /level السابقة
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: {
        id: true,
        username: true,
        role: true,
        tier: true,
        tierHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!user) return notFound('المستخدم غير موجود')

    const tierResult = await calculateUserTier(user.id)
    const currentConfig = getTierConfig(user.role, user.tier)

    return ok({
      user: {
        username: user.username,
        role: user.role,
        tier: user.tier,
      },
      currentConfig,
      tierProgress: tierResult,
      tierHistory: user.tierHistory,
    })
  } catch (err) {
    console.error('[level GET] failed:', err)
    return internalError('فشل جلب بيانات المستوى')
  }
}
