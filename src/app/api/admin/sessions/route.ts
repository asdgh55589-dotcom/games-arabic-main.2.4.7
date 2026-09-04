import { type NextRequest, NextResponse } from 'next/server'
import { forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (err: any) {
    const status = err?.status || 401
    if (status === 401) return unauthorized('Unauthorized')
    return forbidden('Forbidden')
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const search = searchParams.get('search')?.trim() || ''
    const device = searchParams.get('device')?.trim() || ''
    const time = searchParams.get('time')?.trim() || '' // hour|day|week

    const where: any = {
      expiresAt: { gt: new Date() }, // نشط فقط
    }

    if (time === 'hour') {
      where.createdAt = { gte: new Date(Date.now() - 60 * 60 * 1000) }
    } else if (time === 'day') {
      where.createdAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    } else if (time === 'week') {
      where.createdAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }

    if (device) {
      // فلترة حسب UA يحتوي كلمة
      where.userAgent = { contains: device, mode: 'insensitive' }
    }

    if (search) {
      // بحث بالمستخدم (username/email) عبر علاقة User
      where.user = {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const [total, sessions, allForStats] = await Promise.all([
      db.session.count({ where }),
      db.session.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      // إحصائيات عامة (بدون فلترة search/device/time إلا للنشط)
      Promise.all([
        db.session.count({ where: { expiresAt: { gt: new Date() } } }),
        db.session.count({
          where: {
            expiresAt: { gt: new Date() },
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        db.session.findMany({
          where: { expiresAt: { gt: new Date() } },
          select: { userAgent: true },
        }),
      ]),
    ])

    const [totalActive, todayCount, allAgents] = allForStats
    const uniqueDevices = new Set(
      allAgents.map((a) => (a.userAgent || '').slice(0, 80)).filter(Boolean),
    ).size

    return ok({
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalActive,
        todayCount,
        uniqueDevices,
      },
    })
  } catch (err) {
    console.error('[admin/sessions] GET failed', err)
    return internalError('Failed to load sessions')
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (err: any) {
    const status = err?.status || 401
    if (status === 401) return unauthorized('Unauthorized')
    return forbidden('Forbidden')
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { token, sessionId, all } = body

    if (all) {
      // طرد الكل باستثناء جلسة الحالي (لا نعرف الحالية هنا — نحذف الكل)
      // نحذف كل الجلسات المنتهية؟ لا — نحذف النشطة كلها (إجراء خطير، يتطلب تأكيد في الواجهة)
      const deleted = await db.session.deleteMany({ where: { expiresAt: { gt: new Date() } } })
      return ok({ deleted: deleted.count })
    }

    if (token) {
      await db.session.deleteMany({ where: { token } })
      return ok({ success: true })
    }
    if (sessionId) {
      await db.session.delete({ where: { id: sessionId } })
      return ok({ success: true })
    }

    return NextResponse.json({ error: 'token أو sessionId مطلوب' }, { status: 400 })
  } catch (err) {
    console.error('[admin/sessions] POST failed', err)
    return internalError('Failed to revoke session')
  }
}
