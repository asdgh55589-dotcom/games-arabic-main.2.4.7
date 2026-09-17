import { NextResponse } from 'next/server'
import { forbidden, unauthorized } from '@/lib/api-response'
import { AuthError, requireModerator } from '@/lib/auth'
import { getTeamPoints } from '@/lib/points'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
  } catch (err) {
    if (err instanceof AuthError) {
      if ((err as AuthError).status === 401) return unauthorized('يجب تسجيل الدخول')
      if ((err as AuthError).status === 403) return forbidden('ليس لديك صلاحية لعرض المكافآت')
    }
    return unauthorized('يجب تسجيل الدخول')
  }
  try {
    const { id } = await params
    const rewards = await getTeamPoints(id)
    return NextResponse.json(rewards)
  } catch (error) {
    console.error('[team-rewards GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
