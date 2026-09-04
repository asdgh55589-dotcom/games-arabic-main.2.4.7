import { NextResponse } from 'next/server'
import { getTeamPoints } from '@/lib/points'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rewards = await getTeamPoints(id)
    return NextResponse.json(rewards)
  } catch (error) {
    console.error('[team-rewards GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
