import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, validationFail, internalError, unauthorized } from '@/lib/api-response'

// GET: List requests (public) — يعرض open + accepted + completed مرتبة حسب الشعبية
export async function GET() {
  try {
    const requests = await db.modRequest.findMany({
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        acceptedUser: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: [{ interestCount: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    })
    return ok({ requests })
  } catch (err) {
    console.error('[mod-requests GET] failed:', err)
    return internalError('فشل جلب الطلبات')
  }
}

// POST: Create a request (any logged-in user)
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await req.json()
    const { gameName, platform, notes, storeLinks, storeLink } = body as {
      gameName?: string
      platform?: string
      notes?: string
      storeLinks?: string[]
      storeLink?: string // legacy single
    }

    if (!gameName?.trim() || !platform?.trim()) {
      return validationFail('يرجى ملء اسم اللعبة والمنصة')
    }

    // تطبيع روابط المتاجر: يدعم storeLinks[] أو storeLink المفرد
    let links: string[] = []
    if (Array.isArray(storeLinks)) {
      links = storeLinks.map((s) => s?.trim()).filter((s): s is string => Boolean(s))
    } else if (typeof storeLink === 'string' && storeLink.trim()) {
      links = [storeLink.trim()]
    }

    // تحقق كل رابط
    for (const link of links) {
      try {
        const u = new URL(link)
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('invalid')
      } catch {
        return validationFail(`رابط غير صحيح: ${link}`)
      }
    }

    // حد أقصى 5 روابط
    if (links.length > 5) return validationFail('الحد الأقصى 5 روابط')
    const storeLinksJson = links.length > 0 ? JSON.stringify(links) : null
    const firstLink = links[0] || null

    const existing = await db.modRequest.findFirst({
      where: {
        userId: user.id,
        gameName: { equals: gameName.trim(), mode: 'insensitive' },
        status: 'open',
      },
    })

    if (existing) {
      return validationFail('لديك طلب مفتوح بالفعل لهذه اللعبة')
    }

    const request = await db.modRequest.create({
      data: {
        userId: user.id,
        gameName: gameName.trim(),
        platform: platform.trim(),
        storeLink: firstLink,
        storeLinks: storeLinksJson,
        notes: notes?.trim() || null,
      },
    })

    // إشعار المشرفين والإدارة
    try {
      const reviewers = await db.user.findMany({
        where: { role: { in: ['moderator', 'admin', 'manager', 'owner'] } },
        select: { id: true },
      })
      for (const reviewer of reviewers) {
        await db.notification.create({
          data: {
            userId: reviewer.id,
            actorId: user.id,
            type: 'admin_request',
            title: '📝 طلب تعريب جديد',
            message: `${user.username} طلب تعريب "${gameName.trim()}" على منصة ${platform.trim()}`,
            data: { requestId: request.id, gameName: gameName.trim(), platform: platform.trim() },
          },
        })
      }
    } catch {}

    return ok({ request, message: 'تم إرسال طلبك بنجاح' }, { status: 201 })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    console.error('[mod-requests POST] failed:', err)
    return internalError('فشل إنشاء الطلب')
  }
}
