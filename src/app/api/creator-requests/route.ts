import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, unauthorized, forbidden, validationFail, internalError } from '@/lib/api-response'

// POST /api/creator-requests — تقديم طلب ترقية لمُعَرِّب
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    // فقط الأعضاء العاديون يمكنهم التقديم
    if (user.role !== 'member') {
      return forbidden('أنت بالفعل معرّب أو لديك صلاحيات أعلى')
    }

    // منع الطلبات المكررة (قيد المراجعة)
    const existing = await db.creatorRequest.findFirst({
      where: { userId: user.id, status: 'pending' },
    })
    if (existing) {
      return validationFail('لديك طلب قيد المراجعة بالفعل')
    }

    const body = await req.json()
    const { experience, preferredGames, portfolioLinks, reason } = body as {
      experience?: string
      preferredGames?: string
      portfolioLinks?: string
      reason?: string
    }

    if (!experience?.trim() || !reason?.trim()) {
      return validationFail('الخبرة وسبب الرغبة مطلوبان')
    }

    const created = await db.creatorRequest.create({
      data: {
        userId: user.id,
        experience: experience.trim(),
        preferredGames: preferredGames?.trim() || null,
        portfolioLinks: portfolioLinks?.trim() || null,
        reason: reason.trim(),
      },
    })

    // إشعار المشرفين
    try {
      const admins = await db.user.findMany({
        where: { role: { in: ['admin', 'manager', 'owner'] } },
        select: { id: true },
      })
      for (const admin of admins) {
        await db.notification.create({
          data: {
            userId: admin.id,
            actorId: user.id,
            type: 'admin_request',
            title: '🎨 طلب ترقية جديد لمُعَرِّب',
            message: `${user.username} قدم طلباً ليصبح معرّباً`,
            data: { requestId: created.id, username: user.username },
          },
        })
      }
    } catch (e) {
      console.error('[creator-requests POST] admin notify failed:', e)
    }

    return ok(created, { status: 201 })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden((err as Error).message)
    console.error('[creator-requests POST] failed:', err)
    return internalError('فشل إرسال الطلب')
  }
}

// GET /api/creator-requests — حالة طلب المستخدم الحالي
export async function GET() {
  try {
    const user = await requireAuth()

    const latest = await db.creatorRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (!latest) return ok(null)
    return ok(latest)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    console.error('[creator-requests GET] failed:', err)
    return internalError('فشل جلب حالة الطلب')
  }
}
