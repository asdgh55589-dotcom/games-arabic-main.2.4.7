import { ok } from '@/lib/api-response'
import { db } from '@/lib/db'

// GET /api/search/trending — أشهر استعلامات البحث (للاقتراحات)
export async function GET() {
  try {
    const rows = await db.searchClick.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 6,
    })
    return ok({ queries: rows.map((r) => r.query) })
  } catch {
    return ok({ queries: [] })
  }
}
