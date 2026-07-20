import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { upgradeUser } from '@/lib/tier-engine'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const { tier, notes } = body

    if (typeof tier !== 'number' || tier < 0 || tier > 5) {
      return NextResponse.json({ error: 'مستوى غير صالح' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    await upgradeUser(id, tier, 'admin', admin.id, notes)

    return NextResponse.json({ message: `تم ترقية ${user.username} إلى المستوى ${tier}` })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
