import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/creator/mods/[id]/workflow — سجل تغييرات حالة التعريب الخاص بالمُعَرِّب
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const { id } = await params
    const mod = await db.mod.findUnique({ where: { id }, select: { id: true, authorId: true } })
    if (!mod) return notFound('التعريب غير موجود')

    if (mod.authorId !== user.id) {
      return forbidden('لا تملك صلاحية عرض هذا التعريب')
    }

    const history = await db.workflowEntry.findMany({
      where: { modId: id },
      orderBy: { changedAt: 'desc' },
      include: {
        changedByUser: { select: { id: true, username: true, avatarUrl: true } },
      },
    })

    return ok(history)
  } catch (err) {
    console.error('[creator/mods/[id]/workflow GET] failed:', err)
    return internalError('فشل جلب سجل الحالة')
  }
}
