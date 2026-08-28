import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'

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

    // حساب تاريخ البداية
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    // استعلامان فقط بدلاً من 2*N استعلام
    const [newUsersRaw, activeUsersRaw] = await Promise.all([
      db.user.findMany({
        where: { joinedAt: { gte: startDate } },
        select: { joinedAt: true },
        take: 5000,
        orderBy: { joinedAt: 'desc' },
      }),
      db.user.findMany({
        where: { lastLoginAt: { gte: startDate } },
        select: { lastLoginAt: true },
        take: 5000,
        orderBy: { lastLoginAt: 'desc' },
      }),
    ])

    // تجميع النتائج حسب التاريخ
    const newUsersByDate = new Map<string, number>()
    const activeUsersByDate = new Map<string, number>()

    for (const user of newUsersRaw) {
      const dateKey = user.joinedAt.toISOString().split('T')[0]
      newUsersByDate.set(dateKey, (newUsersByDate.get(dateKey) || 0) + 1)
    }

    for (const user of activeUsersRaw) {
      if (!user.lastLoginAt) continue
      const dateKey = user.lastLoginAt.toISOString().split('T')[0]
      activeUsersByDate.set(dateKey, (activeUsersByDate.get(dateKey) || 0) + 1)
    }

    // بناء المصفوفات النهائية
    const labels: string[] = []
    const newUsers: number[] = []
    const activeUsers: number[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]

      labels.push(dateKey)
      newUsers.push(newUsersByDate.get(dateKey) || 0)
      activeUsers.push(activeUsersByDate.get(dateKey) || 0)
    }

    return ok({ labels, newUsers, activeUsers })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
