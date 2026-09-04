import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'

export async function GET() {
  try {
    await requireAdmin()
    const roles = await db.specialRole.findMany({ take: 100, orderBy: { name: 'asc' } })
    return ok({ roles })
  } catch (err) {
    return internalError('خطأ في الخادم')
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
        description: body.description || '',
      },
    })
    return ok({ role })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
