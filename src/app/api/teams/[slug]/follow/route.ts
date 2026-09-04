import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import {
  ok,
  notFound,
  unauthorized,
  conflict,
  internalError,
  validationFail,
} from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ slug: string }>
}

async function requireUser() {
  return getOptionalSession()
}

// GET /api/teams/[slug]/follow — حالة المتابعة
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser()
    const { slug } = await params

    const team = await db.team.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!team) {
      return notFound()
    }

    const isFollowing = currentUser
      ? !!(await db.teamFollow.findUnique({
          where: { teamId_userId: { teamId: team.id, userId: currentUser.id } },
        }))
      : false

    const followersCount = await db.teamFollow.count({ where: { teamId: team.id } })

    return ok({ isFollowing, followersCount })
  } catch (err) {
    console.error('[team-follow GET] failed:', err)
    return internalError('Failed')
  }
}

// POST /api/teams/[slug]/follow — متابعة فريق
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) {
      return unauthorized()
    }

    const { slug } = await params
    const team = await db.team.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    })
    if (!team) {
      return notFound()
    }

    if (team.ownerId === currentUser.id) {
      return validationFail('Cannot follow your own team')
    }

    const existing = await db.teamFollow.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: currentUser.id } },
    })
    if (existing) {
      return conflict('Already following')
    }

    await db.teamFollow.create({
      data: { teamId: team.id, userId: currentUser.id },
    })

    const followersCount = await db.teamFollow.count({ where: { teamId: team.id } })

    return ok({ isFollowing: true, followersCount })
  } catch (err) {
    console.error('[team-follow POST] failed:', err)
    return internalError('Failed')
  }
}

// DELETE /api/teams/[slug]/follow — إلغاء متابعة فريق
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) {
      return unauthorized()
    }

    const { slug } = await params
    const team = await db.team.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!team) {
      return notFound()
    }

    await db.teamFollow.deleteMany({
      where: { teamId: team.id, userId: currentUser.id },
    })

    const followersCount = await db.teamFollow.count({ where: { teamId: team.id } })

    return ok({ isFollowing: false, followersCount })
  } catch (err) {
    console.error('[team-follow DELETE] failed:', err)
    return internalError('Failed')
  }
}
