import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, internalError, notFound, validationFail, forbidden } from '@/lib/api-response'
import {
  parseSpecialRoles,
  formatSpecialRoles,
  canHaveSpecialRole,
  SPECIAL_ROLES,
  type SpecialRole,
} from '@/lib/special-roles'
import type { UserRole } from '@/lib/roles'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const role = (body.role || body.roleKey) as SpecialRole

    if (!role || !SPECIAL_ROLES[role]) {
      return validationFail('الدور الخاص غير صالح')
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }

    // Check eligibility
    if (!canHaveSpecialRole(user.role as UserRole, role)) {
      return forbidden(
        `هذا الدور الخاص يتطلب دور أساسي "${SPECIAL_ROLES[role].minMainRole}" أو أعلى`,
      )
    }

    const currentRoles = parseSpecialRoles(user.specialRoles)

    if (currentRoles.includes(role)) {
      return validationFail('المستخدم لديه هذا الدور بالفعل')
    }

    // isExclusive check (optional)
    if (SPECIAL_ROLES[role].isExclusive) {
      const exclusiveHolders = await db.user.findMany({
        where: {
          specialRoles: { contains: role },
          NOT: { id },
        },
        select: { id: true, username: true },
      })
      if (exclusiveHolders.length > 0) {
        // Allow but warn — not blocking, just log
        console.warn(
          `[special-role] exclusive role ${role} already held by ${exclusiveHolders.map((u) => u.username).join(', ')}`,
        )
      }
    }

    currentRoles.push(role)

    await db.user.update({
      where: { id },
      data: { specialRoles: formatSpecialRoles(currentRoles) },
    })

    try {
      const { logUserAction } = await import('@/lib/audit')
      await logUserAction({
        userId: id,
        actorId: admin.id,
        action: 'SPECIAL_ROLE_ADDED',
        details: JSON.stringify({ role, roleNameAr: SPECIAL_ROLES[role].nameAr }),
      } as unknown as Parameters<typeof logUserAction>[0])
    } catch {}

    // Notify user
    try {
      await db.notification.create({
        data: {
          userId: id,
          actorId: admin.id,
          type: 'admin_action',
          title: `🎖️ حصلت على دور خاص!`,
          message: `تهانينا! تم منحك دور "${SPECIAL_ROLES[role].nameAr}"`,
          data: { role, roleNameAr: SPECIAL_ROLES[role].nameAr },
        },
      })
    } catch {}

    return ok({ success: true, specialRoles: currentRoles })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401 || status === 403) return forbidden('غير مصرح')
    console.error('[special-role POST] failed:', err)
    return internalError('خطأ في الخادم')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    let role: string | null = null
    try {
      const body = await request.json()
      role = (body.role || body.roleKey) as string
    } catch {
      const { searchParams } = new URL(request.url)
      role = searchParams.get('role') || searchParams.get('roleKey')
    }

    if (!role) {
      return validationFail('role مطلوب')
    }

    const specialRole = role as SpecialRole

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }

    const currentRoles = parseSpecialRoles(user.specialRoles)

    if (!currentRoles.includes(specialRole)) {
      return validationFail('المستخدم ليس لديه هذا الدور')
    }

    const newRoles = currentRoles.filter((r) => r !== specialRole)

    await db.user.update({
      where: { id },
      data: { specialRoles: formatSpecialRoles(newRoles) },
    })

    try {
      const { logUserAction } = await import('@/lib/audit')
      await logUserAction({
        userId: id,
        actorId: admin.id,
        action: 'SPECIAL_ROLE_REMOVED',
        details: JSON.stringify({ role: specialRole }),
      } as unknown as Parameters<typeof logUserAction>[0])
    } catch {}

    // Optional notification on removal
    try {
      await db.notification.create({
        data: {
          userId: id,
          actorId: admin.id,
          type: 'admin_action',
          title: `ℹ️ تم سحب دور خاص`,
          message: `تم سحب دور "${SPECIAL_ROLES[specialRole]?.nameAr || specialRole}" من حسابك`,
          data: { role: specialRole },
        },
      })
    } catch {}

    return ok({ success: true, specialRoles: newRoles })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401 || status === 403) return forbidden('غير مصرح')
    console.error('[special-role DELETE] failed:', err)
    return internalError('خطأ في الخادم')
  }
}
