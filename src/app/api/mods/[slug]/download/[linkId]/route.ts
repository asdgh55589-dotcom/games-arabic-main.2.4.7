import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUserIdFromRequestCookies } from '@/lib/auth'
import { ok, notFound, internalError, fail } from '@/lib/api-response'
import { recordDownload, isBot, isInternalRequest } from '@/lib/counters'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ slug: string; linkId: string }>
}

// GET — تسجيل تحميل فعلي عبر رابط معيّن ثم تمرير الرابط الخارجي.
// العداد يزيد فقط للأحداث الفريدة (نطاق الـ dedup لكل FILE، ومستخدم مسجَّل
// TTL 24 ساعة / زائر ساعة — انظر lib/counters.ts).
// محمي بـ rate limiting + deduplication + atomic transaction.
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. Rate limiting — 10 طلب/دقيقة لكل IP/مستخدم
    // الطلب الداخلي من الخادم (ISR) يُستثنى: سلة الـ rate limit مرتبطة بـ IP
    // فقط، والخادم يخرج من IP واحد مشترك → استنزاف السلة يدّ على كل الزوار.
    if (!isInternalRequest(req)) {
      const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'mods:download:link' })
      if (!rl.success) {
        return fail('RATE_LIMITED', 'تم تجاوز الحد المسموح للتحميل، حاول مرة أخرى بعد دقيقة', 429)
      }
    }

    const { slug, linkId } = await params

    // Find mod by slug
    const mod = await db.mod.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!mod) {
      return notFound('التعريب غير موجود')
    }

    // Find the link
    const link = await db.modFileLink.findUnique({
      where: { id: linkId },
      select: { id: true, url: true, fileId: true },
    })
    if (!link) {
      return notFound('الرابط غير موجود')
    }

    // Verify the link belongs to this mod (via its file)
    const parentFile = await db.modFile.findFirst({
      where: { id: link.fileId, modId: mod.id },
      select: { id: true },
    })
    if (!parentFile) {
      return notFound('الرابط غير موجود')
    }

    // C1 — الطلب الداخلي (ISR) لا يُحتسب، لكن الرابط الخارجي يُعاد كما هو.
    // الحارس نفسه مطبَّق أيضاً داخل recordDownload (lib/counters.ts) — تكرار
    // مقصود: أي مسار ينادي recordDownload محميّ حتى لو استُدعي مباشرة.
    if (!isBot(req.headers.get('user-agent')) && !isInternalRequest(req)) {
      const userId = await getUserIdFromRequestCookies(req)
      await recordDownload(
        {
          modId: mod.id,
          linkId: link.id,
          // R24 — نطاق الـ dedup لكل FILE: بدون هذا يتحوّل كل رابط مرآة إلى
          // تحميل محسوب مستقل لنفس الملف في اليوم نفسه.
          fileId: parentFile.id,
          linkUrl: link.url,
          userId,
        },
        req,
        db
      ).catch((err) => logger.error({ err }, '[download/[linkId]] record failed'))
    }

    return ok({ url: link.url })
  } catch (err) {
    logger.error({ err }, '[download/[linkId] GET] failed')
    return internalError('Failed')
  }
}
