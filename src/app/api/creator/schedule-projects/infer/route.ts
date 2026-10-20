import type { NextRequest } from 'next/server'
import { fail, internalError, ok, unauthorized } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getActiveSocialPlatforms } from '@/lib/social/platforms'
import { resolvePlatformRoutes } from '@/lib/social/route-resolve'

/**
 * GET /api/creator/schedule-projects/infer?platformKey=PS5 — استنتاج
 * أهداف النشر لمنصة (لمعالج النماذج). جلسة استوديو فقط، بلا توكنات:
 * أهداف قابلة للاستخدام + عدد المستبعدة + المنصات الاجتماعية بروابطها
 * + وجود بوت افتراضي (للتجربة الجافة) — كلها بيانات عرض آمنة.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return unauthorized('سجّل الدخول أولاً')

    const { searchParams } = new URL(req.url)
    const platformKey = searchParams.get('platformKey') ?? ''
    if (!platformKey) {
      const msg = 'حدّد platformKey'
      return fail('VALIDATION_ERROR', msg, 422, { platformKey: msg }, undefined, req.nextUrl.pathname)
    }

    const resolved = await resolvePlatformRoutes(platformKey, new Date())
    const socialPlatforms = getActiveSocialPlatforms().map((p) => ({
      key: p.key,
      labelAr: p.labelAr,
      href: p.href,
      status: p.status,
    }))

    return ok({
      platformKey,
      defaultRuleId: resolved.defaultRuleId,
      targets: resolved.targets.map((t) => ({
        ruleId: t.ruleId,
        destinationId: t.destinationId,
        chatId: t.chatId,
        title: t.title,
        threadId: t.threadId,
        botId: t.botId,
        botLabel: t.botLabel,
        isDefault: t.isDefault,
        link: t.chatId.startsWith('@') ? `https://t.me/${t.chatId.slice(1)}` : null,
      })),
      excluded: resolved.excluded,
      socialPlatforms,
      hasDefaultBot: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    })
  } catch (err) {
    logger.error('[creator/schedule-projects/infer GET] failed:', err)
    return internalError('تعذّر استنتاج الأهداف')
  }
}
