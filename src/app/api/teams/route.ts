import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/teams — قائمة بكل فرق التعريب
export async function GET() {
  try {
    const teams = await db.team.findMany({
      orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        isFeatured: true,
        isOfficial: true,
        modCount: true,
      },
    })

    return NextResponse.json(
      { teams },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    console.error('[api/teams] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
