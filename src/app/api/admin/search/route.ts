import { NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'
import { search } from '@/lib/search'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all'
    const platform = searchParams.get('platform') || undefined
    const status = searchParams.get('status') || undefined

    if (!q || q.trim().length < 2) {
      return NextResponse.json({
        results: [],
        counts: { mod: 0, game: 0, team: 0, user: 0 },
        total: 0,
      })
    }

    const results = await search(q, {
      type: type as any,
      platform,
      status,
    })

    await logAction({
      action: 'search',
      entity: 'system',
      details: JSON.stringify({ query: q, type, resultCount: results.total }),
      request,
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('[search GET]', error)
    return NextResponse.json({ error: 'خطأ في البحث' }, { status: 500 })
  }
}
