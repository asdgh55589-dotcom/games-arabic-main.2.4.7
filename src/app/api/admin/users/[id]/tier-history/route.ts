import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const history = await db.tierHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return NextResponse.json({ history })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
