import type { NextRequest } from 'next/server'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, internalError, notFound } from '@/lib/api-response'

// PATCH: تمييز الصورة المكسورة كمُصلحة أو مُتجاهلة
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const status = body?.status as string

    if (!['fixed', 'ignored', 'detected'].includes(status)) {
      return internalError('حالة غير صالحة — يجب أن تكون fixed أو ignored')
    }

    const existing = await db.brokenImage.findUnique({ where: { id } })
    if (!existing) {
      return notFound('الصورة غير موجودة')
    }

    const updated = await db.brokenImage.update({
      where: { id },
      data: {
        status,
        fixedAt: status === 'fixed' ? new Date() : null,
      },
    })

    return ok(updated)
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      const { forbidden } = await import('@/lib/api-response')
      return forbidden('ليس لديك صلاحية تحديث الحالة')
    }
    console.error('[ImageHealth] فشل تحديث الحالة:', error)
    return internalError('فشل تحديث الحالة')
  }
}
