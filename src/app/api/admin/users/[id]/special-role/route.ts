import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseSpecialRoles, formatSpecialRoles } from '@/lib/tier-helpers'
import { getUseCases } from '@/application/use-cases/factory'
import { ok, internalError, notFound, validationFail } from '@/lib/api-response'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const { roleKey } = body

    const role = await db.specialRole.findUnique({ where: { key: roleKey } })
    if (!role) {
      return notFound('الدور غير موجود')
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }

    const currentRoles = parseSpecialRoles(user.specialRoles)
    if (currentRoles.includes(roleKey)) {
      return validationFail({ message: 'المستخدم يملك هذا الدور بالفعل' })
    }

    currentRoles.push(roleKey)
    await db.user.update({
      where: { id },
      data: { specialRoles: formatSpecialRoles(currentRoles) }
    })

    try {
      const useCases = getUseCases()
      await useCases.sendSpecialRoleAssigned.execute({
        userId: id,
        roleKey,
        roleName: role.name,
        assignedBy: 'admin',
      })
    } catch {}

    return ok({ message: `تم اضافة دور ${role.name}` })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const roleKey = searchParams.get('roleKey')

    if (!roleKey) {
      return validationFail({ message: 'roleKey مطلوب' })
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }

    const currentRoles = parseSpecialRoles(user.specialRoles)
    const newRoles = currentRoles.filter(r => r !== roleKey)
    await db.user.update({
      where: { id },
      data: { specialRoles: formatSpecialRoles(newRoles) }
    })

    const role = await db.specialRole.findUnique({ where: { key: roleKey } })
    try {
      const useCases = getUseCases()
      await useCases.sendSpecialRoleRemoved.execute({
        userId: id,
        roleKey,
        roleName: role?.name || roleKey,
        removedBy: 'admin',
      })
    } catch {}

    return ok({ message: 'تم سحب الدور' })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
