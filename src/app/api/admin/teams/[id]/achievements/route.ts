import { NextResponse } from 'next/server'
import { forbidden, unauthorized } from '@/lib/api-response'
import { AuthError, requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
  } catch (err) {
    if (err instanceof AuthError) {
      if ((err as AuthError).status === 401) return unauthorized('يجب تسجيل الدخول')
      if ((err as AuthError).status === 403) return forbidden('ليس لديك صلاحية لعرض الإنجازات')
    }
    return unauthorized('يجب تسجيل الدخول')
  }
  try {
    const { id } = await params

    const [all, earned] = await Promise.all([
      db.achievement.findMany({ where: { isActive: true }, orderBy: { points: 'asc' } }),
      db.teamAchievement.findMany({
        where: { teamId: id },
        include: { achievement: true },
        orderBy: { earnedAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      all: all.map((a) => ({
        ...a,
        requirement: typeof a.requirement === 'string' ? JSON.parse(a.requirement) : a.requirement,
      })),
      earned: earned.map((e) => ({
        ...e,
        achievement: {
          ...e.achievement,
          requirement:
            typeof e.achievement.requirement === 'string'
              ? JSON.parse(e.achievement.requirement)
              : e.achievement.requirement,
        },
      })),
    })
  } catch (error) {
    console.error('[team-achievements GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
