import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireAdmin()
    const { key } = await params
    const body = await request.json()
    const role = await db.specialRole.update({
      where: { key },
      data: {
        name: body.name,
        nameEn: body.nameEn,
        icon: body.icon,
        color: body.color,
        description: body.description,
        isActive: body.isActive,
      },
    })
    return ok({ role })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    await requireAdmin()
    const { key } = await params
    await db.specialRole.delete({ where: { key } })
    return ok({ message: 'تم حذف الدور' })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
