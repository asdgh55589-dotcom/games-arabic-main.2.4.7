import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser) return null
  const neonUser = await db.user.findFirst({
    where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
    select: { id: true },
  })
  return neonUser
}

// DELETE /api/notifications/bulk — حذف عدة إشعارات دفعة واحدة
export async function DELETE(req: NextRequest) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 })
    }

    const deleted = await db.notification.deleteMany({
      where: {
        id: { in: ids },
        userId: neonUser.id,
      },
    })

    return NextResponse.json({ deleted: deleted.count })
  } catch (err) {
    console.error('[notifications bulk DELETE] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
