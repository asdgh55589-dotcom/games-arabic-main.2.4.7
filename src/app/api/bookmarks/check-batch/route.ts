import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

// POST /api/bookmarks/check-batch — التحقق من حالة الحفظ لعدة تعريبات في طلب واحد
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ bookmarkedIds: [] })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true },
    })
    if (!neonUser) {
      return NextResponse.json({ bookmarkedIds: [] })
    }

    const body = await req.json().catch(() => ({}))
    const modIds: string[] = Array.isArray(body.modIds) ? body.modIds : []
    if (modIds.length === 0) {
      return NextResponse.json({ bookmarkedIds: [] })
    }

    // طلب واحد لجلب كل الـ bookmarks
    const bookmarks = await db.bookmark.findMany({
      where: {
        userId: neonUser.id,
        modId: { in: modIds },
      },
      select: { modId: true },
    })

    return NextResponse.json({ bookmarkedIds: bookmarks.map(b => b.modId) })
  } catch (err) {
    console.error('[bookmarks/check-batch POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
