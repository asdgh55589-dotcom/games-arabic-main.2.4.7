import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    return NextResponse.json(
      { series },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    console.error('[api/series] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
