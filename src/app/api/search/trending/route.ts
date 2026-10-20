import { setCacheControl } from '@/lib/api-cache'
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
    // Section 4 item 27: suggestions are public — cache instead of refetching
    // on every empty search.
    const res = ok({ queries: rows.map((r) => r.query) })
    setCacheControl(res.headers, { type: 'public', maxAge: 60, swr: 120 })
    return res
  } catch {
    return ok({ queries: [] })
  }
}
