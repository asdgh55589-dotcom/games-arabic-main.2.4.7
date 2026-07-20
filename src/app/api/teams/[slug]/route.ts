import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/teams/[slug] — تفاصيل فريق
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const team = await db.team.findFirst({
      where: { slug },
      include: {
        memberships: { orderBy: { joinedAt: 'desc' } },
        contactLinks: { orderBy: { order: 'asc' } },
        mods: {
          select: { id: true, name: true, slug: true, thumbnailUrl: true, downloads: true, endorsements: true },
          orderBy: { downloads: 'desc' },
          take: 20,
        },
        _count: { select: { mods: true } },
      },
    })

    if (!team) {
      return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 })
    }

    return NextResponse.json(
      { team },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (err) {
    console.error('[api/teams/[slug]] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
