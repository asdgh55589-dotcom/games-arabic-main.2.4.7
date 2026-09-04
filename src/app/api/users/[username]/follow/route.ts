import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { getUseCases } from '@/application/use-cases/factory'
import { rateLimit } from '@/lib/rate-limit'
import {
  ok,
  notFound,
  unauthorized,
  conflict,
  internalError,
  validationFail,
  rateLimited,
} from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ username: string }>
}

async function requireUser() {
  return getOptionalSession()
}

// GET /api/users/[username]/follow — حالة المتابعة
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 30, window: 60, keyPrefix: 'follow:get' })
    if (!rl.success) return rateLimited()
    const currentUser = await requireUser()
    const { username } = await params

    const targetUser = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!targetUser) {
      return notFound()
    }

    const isFollowing = currentUser
      ? !!(await db.follow.findUnique({
          where: {
            followerId_followingId: { followerId: currentUser.id, followingId: targetUser.id },
          },
        }))
      : false

    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({ where: { followingId: targetUser.id } }),
      db.follow.count({ where: { followerId: targetUser.id } }),
    ])

    return ok({ isFollowing, followersCount, followingCount })
  } catch (err) {
    console.error('[follow GET] failed:', err)
    return internalError('حدث خطأ في الخادم')
  }
}

// POST /api/users/[username]/follow — متابعة مستخدم
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'follow:post' })
    if (!rl.success) return rateLimited()
    const currentUser = await requireUser()
    if (!currentUser) {
      return unauthorized('يجب تسجيل الدخول أولاً')
    }

    const { username } = await params
    const targetUser = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!targetUser) {
      return notFound()
    }

    if (currentUser.id === targetUser.id) {
      return validationFail({ _error: 'لا يمكنك متابعة نفسك' })
    }

    const existing = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUser.id, followingId: targetUser.id } },
    })
    if (existing) {
      return conflict('أنت تتابع هذا المستخدم بالفعل')
    }

    await db.follow.create({
      data: { followerId: currentUser.id, followingId: targetUser.id },
    })

    // إشعار المستخدم المتابع
    try {
      const useCases = getUseCases()
      await useCases.sendFollow.execute({
        followedUserId: targetUser.id,
        followerId: currentUser.id,
        followerName: currentUser.username || 'مستخدم',
      })
    } catch {}

    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({ where: { followingId: targetUser.id } }),
      db.follow.count({ where: { followerId: targetUser.id } }),
    ])

    return ok({ isFollowing: true, followersCount, followingCount })
  } catch (err) {
    console.error('[follow POST] failed:', err)
    return internalError('حدث خطأ في الخادم')
  }
}

// DELETE /api/users/[username]/follow — إلغاء المتابعة
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'follow:delete' })
    if (!rl.success) return rateLimited()
    const currentUser = await requireUser()
    if (!currentUser) {
      return unauthorized('يجب تسجيل الدخول أولاً')
    }

    const { username } = await params
    const targetUser = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!targetUser) {
      return notFound()
    }

    await db.follow.deleteMany({
      where: { followerId: currentUser.id, followingId: targetUser.id },
    })

    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({ where: { followingId: targetUser.id } }),
      db.follow.count({ where: { followerId: targetUser.id } }),
    ])

    return ok({ isFollowing: false, followersCount, followingCount })
  } catch (err) {
    console.error('[follow DELETE] failed:', err)
    return internalError('حدث خطأ في الخادم')
  }
}
