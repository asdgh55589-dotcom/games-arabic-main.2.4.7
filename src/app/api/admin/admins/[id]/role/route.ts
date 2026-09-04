import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, invalidateUserSessions } from '@/lib/auth'
import { ok, fail, forbidden, internalError, notFound } from '@/lib/api-response'
import { canAssignRole } from '@/lib/permissions'
import { logUserAction } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

// PUT /api/admin/admins/[id]/role — ترقية/تنزيل
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireOwner()
    const { id } = await params
    const body = await req.json()
    const newRole = body.newRole || body.role

    if (!newRole) {
      return fail('VALIDATION_ERROR', 'الدور الجديد مطلوب', 400)
    }

    if (id === currentUser.id) {
      return forbidden('لا يمكنك تغيير دورك الخاص')
    }

    const target = await db.user.findUnique({ where: { id } })
    if (!target) return notFound('المستخدم غير موجود')

    if (target.role === 'owner' && currentUser.role !== 'owner') {
      return forbidden('فقط المالك يمكنه تعديل مالك آخر')
    }

    if (!canAssignRole(currentUser.role, newRole)) {
      return forbidden(`لا تملك صلاحية تعيين هذا الدور: ${newRole}`)
    }

    if (target.role === newRole) {
      return fail('VALIDATION_ERROR', 'المستخدم لديه نفس الدور بالفعل', 400)
    }

    await db.user.update({
      where: { id },
      data: { role: newRole },
    })

    await invalidateUserSessions(id)

    const action = getRoleAction(target.role, newRole)
    await logUserAction({
      userId: id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action,
      reason: `تغيير الدور من ${target.role} إلى ${newRole}`,
      request: req,
    })

    return ok({ success: true, message: `تم تغيير الدور إلى ${newRole}` })
  } catch (err) {
    const status = (err as any)?.status
    if (status === 401 || status === 403) return fail('FORBIDDEN', (err as Error).message, status)
    console.error('[admins role PUT] failed:', err)
    return internalError('فشل تغيير الدور')
  }
}

function getRoleAction(oldRole: string, newRole: string): string {
  const order = ['member', 'creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  const oldIdx = order.indexOf(oldRole)
  const newIdx = order.indexOf(newRole)
  if (newIdx > oldIdx) return 'PROMOTED'
  if (newIdx < oldIdx) return 'DEMOTED'
  return 'ROLE_CHANGED'
}
