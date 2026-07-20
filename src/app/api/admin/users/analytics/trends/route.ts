import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    let days: number
    switch (period) {
      case '7d': days = 7; break
      case '90d': days = 90; break
      default: days = 30;
    }

    const labels: string[] = []
    const newUsers: number[] = []
    const activeUsers: number[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      labels.push(startOfDay.toISOString().split('T')[0])

      const [dayNewUsers, dayActiveUsers] = await Promise.all([
        db.user.count({
          where: {
            joinedAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        db.user.count({
          where: {
            lastLoginAt: { gte: startOfDay, lt: endOfDay }
          }
        })
      ])

      newUsers.push(dayNewUsers)
      activeUsers.push(dayActiveUsers)
    }

    return NextResponse.json({ labels, newUsers, activeUsers })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
