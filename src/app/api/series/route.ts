import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'

// GET /api/series — قائمة بكل السلاسل (من Series model الجديد)
export async function GET() {
  try {
    const series = await db.series.findMany({
      orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        bannerUrl: true,
        logoUrl: true,
        color: true,
        isFeatured: true,
        isOfficial: true,
        modCount: true,
        totalDownloads: true,
        totalEndorsements: true,
      },
    })

    return ok(series, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    console.error('[api/series] failed:', err)
    return internalError('Failed to fetch series')
  }
}
