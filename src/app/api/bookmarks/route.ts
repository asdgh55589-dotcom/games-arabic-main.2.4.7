import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser) return null
  return db.user.findFirst({
    where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
    select: { id: true },
  })
}

// POST /api/bookmarks — حفظ تعريب في المفضلة
export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { modId } = body
    if (!modId) {
      return NextResponse.json({ error: 'modId is required' }, { status: 400 })
    }

    const mod = await db.mod.findUnique({ where: { id: modId }, select: { id: true } })
    if (!mod) {
      return NextResponse.json({ error: 'Mod not found' }, { status: 404 })
    }

    const existing = await db.bookmark.findUnique({
      where: { userId_modId: { userId: currentUser.id, modId } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Already bookmarked' }, { status: 409 })
    }

    await db.bookmark.create({
      data: { userId: currentUser.id, modId },
    })

    return NextResponse.json({ bookmarked: true })
  } catch (err) {
    console.error('[bookmarks POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// DELETE /api/bookmarks — إلغاء الحفظ
export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const modId = searchParams.get('modId')
    if (!modId) {
      return NextResponse.json({ error: 'modId is required' }, { status: 400 })
    }

    await db.bookmark.deleteMany({
      where: { userId: currentUser.id, modId },
    })

    return NextResponse.json({ bookmarked: false })
  } catch (err) {
    console.error('[bookmarks DELETE] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
