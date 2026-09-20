import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { ADMIN_PAGES_FLAT } from '@/lib/admin-pages'
import { logUserAction } from '@/lib/audit'
import { invalidateUserSessions, requireOwner } from '@/lib/auth'
import { db } from '@/lib/db'

interface Params {
  params: Promise<{ id: string }>
}

const VALID_KEYS = new Set(ADMIN_PAGES_FLAT.map((d) => d.key))

function sanitizePages(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null
  const keys = [...new Set(input.filter((k): k is string => typeof k === 'string'))].filter((k) =>
    VALID_KEYS.has(k),
  )
  return keys
}

// GET /api/admin/users/[id]/pages — الصفحات المخصصة لمستخدم (مالك فقط).
// تُرجع null عندما لا يوجد تخصيص (النظام الافتراضي حسب الرتبة).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireOwner()
    const { id } = await params
    const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!target) return notFound('المستخدم غير موجود')
    const rows = await db.staffPageAccess.findMany({ where: { userId: id }, select: { page: true } })
    const pages = rows.map((r) => r.page).filter((k) => VALID_KEYS.has(k))
    return ok({ pages: pages.length > 0 ? pages : null, role: target.role })
  } catch (err) {
    const status = (err as any)?.status
    if (status === 401 || status === 403) return fail('FORBIDDEN', (err as Error).message, status)
    console.error('[admin user pages GET] failed:', err)
    return internalError('فشل تحميل صلاحيات الصفحات')
  }
}

// PUT /api/admin/users/[id]/pages — حفظ قائمة بيضاء (مالك فقط، صفحة واحدة على الأقل).
// يُبطل جلسات المستخدم ليُجبر على دخول جديد بالصلاحيات الجديدة.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireOwner()
    const { id } = await params
    if (id === currentUser.id) {
      return forbidden('لا يمكنك تقييد صفحاتك الخاصة')
    }

    const target = await db.user.findUnique({ where: { id } })
    if (!target) return notFound('المستخدم غير موجود')
    if (target.role === 'owner') {
      return forbidden('المالك لديه كل الصلاحيات دائماً')
    }
    if (!['moderator', 'admin', 'manager'].includes(target.role)) {
      return forbidden('تخصيص الصفحات للإداريين فقط (مشرف/إداري/مدير)')
    }

    const body = await req.json().catch(() => null)
    const pages = sanitizePages(body?.pages)
    if (!pages || pages.length === 0) {
      return fail('VALIDATION_ERROR', 'اختر صفحة واحدة على الأقل (أو احذف التخصيص للعودة للافتراضي)', 400)
    }

    await db.$transaction([
      db.staffPageAccess.deleteMany({ where: { userId: id } }),
      db.staffPageAccess.createMany({ data: pages.map((page) => ({ userId: id, page })) }),
    ])

    await invalidateUserSessions(id)

    await logUserAction({
      userId: id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'PAGES_UPDATED',
      reason: `تحديد صفحات اللوحة: ${pages.join(', ')}`,
      request: req,
    })

    return ok({ success: true, pages, message: 'تم الحفظ — سيحتاج المستخدم لتسجيل الدخول مجدداً' })
  } catch (err) {
    const status = (err as any)?.status
    if (status === 401 || status === 403) return fail('FORBIDDEN', (err as Error).message, status)
    console.error('[admin user pages PUT] failed:', err)
    return internalError('فشل حفظ صلاحيات الصفحات')
  }
}

// DELETE /api/admin/users/[id]/pages — حذف التخصيص والعودة للنظام الافتراضي (مالك فقط).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireOwner()
    const { id } = await params
    if (id === currentUser.id) {
      return forbidden('لا يمكنك تعديل صلاحياتك الخاصة')
    }
    const target = await db.user.findUnique({ where: { id }, select: { id: true } })
    if (!target) return notFound('المستخدم غير موجود')

    await db.staffPageAccess.deleteMany({ where: { userId: id } })
    await invalidateUserSessions(id)

    await logUserAction({
      userId: id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'PAGES_UPDATED',
      reason: 'إزالة تخصيص الصفحات — عودة للنظام الافتراضي حسب الرتبة',
    })

    return ok({ success: true, pages: null })
  } catch (err) {
    const status = (err as any)?.status
    if (status === 401 || status === 403) return fail('FORBIDDEN', (err as Error).message, status)
    console.error('[admin user pages DELETE] failed:', err)
    return internalError('فشل حذف التخصيص')
  }
}
