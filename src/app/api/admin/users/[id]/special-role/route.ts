import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseSpecialRoles, formatSpecialRoles } from '@/lib/tier-helpers'
import { createNotification } from '@/lib/notification-helpers'
import { NotificationType } from '@/lib/notifications/types'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const { roleKey } = body

    const role = await db.specialRole.findUnique({ where: { key: roleKey } })
    if (!role) {
      return NextResponse.json({ error: 'الدور غير موجود' }, { status: 404 })
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    const currentRoles = parseSpecialRoles(user.specialRoles)
    if (currentRoles.includes(roleKey)) {
      return NextResponse.json({ error: 'المستخدم يملك هذا الدور بالفعل' }, { status: 400 })
    }

    currentRoles.push(roleKey)
    await db.user.update({
      where: { id },
      data: { specialRoles: formatSpecialRoles(currentRoles) }
    })

    await createNotification({
      userId: id,
      type: NotificationType.SpecialRoleAssigned,
      title: 'تم منحك دور خاص',
      message: `تم منحك دور ${role.name}`,
      data: { roleKey }
    })

    return NextResponse.json({ message: `تم اضافة دور ${role.name}` })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const roleKey = searchParams.get('roleKey')

    if (!roleKey) {
      return NextResponse.json({ error: 'roleKey مطلوب' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    const currentRoles = parseSpecialRoles(user.specialRoles)
    const newRoles = currentRoles.filter(r => r !== roleKey)
    await db.user.update({
      where: { id },
      data: { specialRoles: formatSpecialRoles(newRoles) }
    })

    const role = await db.specialRole.findUnique({ where: { key: roleKey } })
    await createNotification({
      userId: id,
      type: NotificationType.SpecialRoleRemoved,
      title: 'تم سحب دور خاص',
      message: `تم سحب دور ${role?.name || roleKey}`,
      data: { roleKey }
    })

    return NextResponse.json({ message: 'تم سحب الدور' })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
