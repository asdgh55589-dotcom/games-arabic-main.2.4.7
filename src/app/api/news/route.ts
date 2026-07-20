import { NextRequest, NextResponse } from 'next/server'
import { getActiveNews } from '@/lib/news-helpers'

// GET /api/news?type=ticker|featured — الأخبار النشطة
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || undefined
    const limit = Number.parseInt(searchParams.get('limit') || '20')

    const news = await getActiveNews({ type, limit })

    return NextResponse.json(
      { news },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
        },
      }
    )
  } catch (err) {
    console.error('[api/news] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
