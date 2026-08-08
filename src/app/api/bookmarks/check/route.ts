import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

// GET /api/bookmarks/check?modId=xxx — التحقق من حالة الحفظ
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ bookmarked: false })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true },
    })
    if (!neonUser) {
      return NextResponse.json({ bookmarked: false })
    }

    const { searchParams } = new URL(req.url)
    const modId = searchParams.get('modId')
    if (!modId) {
      return NextResponse.json({ error: 'modId is required' }, { status: 400 })
    }

    const bookmark = await db.bookmark.findUnique({
      where: { userId_modId: { userId: neonUser.id, modId } },
    })

    return NextResponse.json({ bookmarked: !!bookmark })
  } catch (err) {
    console.error('[bookmarks/check GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
