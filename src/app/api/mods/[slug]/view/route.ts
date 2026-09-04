import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { ok, notFound, internalError, rateLimited } from '@/lib/api-response'
import { recordModView, isBot } from '@/lib/counters'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// POST /api/mods/[slug]/view — تسجيل مشاهدة مع dedup
//
// نفس namespace الـ dedup المستخدم في GET /api/mods/[slug] — فالتكرار بين
// المسارين غير مؤثر (أول نداء فقط يُحتسب). الواجهة الحالية تعتمد على GET،
// وهذا المسار متاح للعملاء التي تريد تسجيل المشاهدات صراحة.
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 30, window: 60, keyPrefix: 'mods:view' })
    if (!rl.success) {
      return rateLimited()
    }

    const userAgent = req.headers.get('user-agent')
    if (isBot(userAgent)) {
      return ok({ viewsCount: null, counted: false })
    }

    const { slug } = await params
    const mod = await db.mod.findUnique({
      where: { slug },
      select: { id: true, views: true },
    })
    if (!mod) {
      return notFound('التعريب غير موجود')
    }

    const result = await recordModView(mod.id, req, db)

    return ok({
      counted: result.counted,
      // العداد بعد الزيادة إن حُسبت، وإلا القيمة الحالية
      viewsCount: result.counted ? mod.views + 1 : mod.views,
    })
  } catch (err) {
    console.error('[view POST] failed:', err)
    return internalError('Failed')
  }
}
