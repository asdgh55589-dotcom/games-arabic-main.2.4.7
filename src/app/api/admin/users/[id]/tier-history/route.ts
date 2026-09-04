import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const history = await db.tierHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return ok({ history })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
