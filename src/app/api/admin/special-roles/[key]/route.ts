import { NextRequest, NextResponse } from 'next/server'
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
        isActive: body.isActive
      }
    })
    return NextResponse.json({ role })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireAdmin()
    const { key } = await params
    await db.specialRole.delete({ where: { key } })
    return NextResponse.json({ message: 'تم حذف الدور' })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
