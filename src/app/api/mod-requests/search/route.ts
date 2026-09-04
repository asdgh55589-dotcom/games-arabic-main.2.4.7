import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'

// GET /api/mod-requests/search?q=keyword — بحث سريع عن طلبات مطابقة (public)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''

    if (q.length < 2) return ok({ requests: [] })

    const requests = await db.modRequest.findMany({
      where: {
        status: 'open',
        gameName: { contains: q, mode: 'insensitive' },
      },
      include: {
        user: { select: { username: true } },
        acceptedUser: { select: { username: true } },
      },
      orderBy: [{ interestCount: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    })

    return ok({ requests })
  } catch (err) {
    console.error('[mod-requests/search GET] failed:', err)
    return internalError('فشل البحث')
  }
}
