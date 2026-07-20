import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const roles = await db.specialRole.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ roles })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const role = await db.specialRole.create({
      data: {
        key: body.key,
        name: body.name,
        nameEn: body.nameEn,
        icon: body.icon || 'Star',
        color: body.color || '#6b7280',
        description: body.description || ''
      }
    })
    return NextResponse.json({ role })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
