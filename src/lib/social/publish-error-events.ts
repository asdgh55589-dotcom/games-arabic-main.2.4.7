/**
 * lib/social/publish-error-events.ts — مسجّل أحداث أخطاء النشر (المرحلة 6).
 *
 * كل فشل في مسارات النشر يكتب صفاً في `publish_error_events` عبر كتالوج
 * `lib/publish-errors.ts` (رمز/سبب عربي/إصلاح/قابلية إعادة). الاستمرار
 * على كيان (بوت/وجهة/منشور) يصحّ بلا حل ← عدّادة تدهور (3 فشل متتالية)
 * تبعث تنبيهاً استباقياً مرةً واحدة لكل شريحة فشل — والعجلة العكسية:
 * النجاح (تلقائيًا) أو رفع الدليل يدويًا يمسح resolvedAt فيعود العد
 * للصفر.
 *
 * الإشعارات عبر NotificationService القائمة (تنظيف محايد — فشل الإشعار
 * لا يكسر النشر أبداً):
 * - الفشل النهائي: المؤلف + مدراء المحتوى (in-app + بريد، dedup 30 د).
 * - نجاح اكتمال كل الوجهات: المؤلف في التطبيق فقط (حفيف قابل للكتم).
 * - التدهور (3): المؤلف + المدراء (in-app + بريد).
 * - التقرير الدوري: مدراء المحتوى (in-app + بريد) عبر كرون publish-digest.
 */

import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { type PublishErrorDef, type PublishErrorScope, publishErrorDef } from '@/lib/publish-errors'

interface EventDraft {
  code: string
  scope: PublishErrorScope
  refId?: string | null
  message?: string | null
  attempt?: number
}

/** عتبة التدهور: 3 فشل متتالية على الكيان نفسه (بلا نجاح بينهما). */
export const DEGRADATION_THRESHOLD = 3

/** نافذة دمج الحدث نفسه على الكيان نفسه (بلا صف جديد query storm). */
const EVENT_DEDUPE_WINDOW_MS = 30 * 60_000

/** قناع التوكن/المراجع الحساسة في النص الخام قبل تخزينه. */
export function sanitizeMessage(raw: string, max = 280): string {
  return String(raw)
    .replace(/bot\d+:[\w-]{10,}/g, 'توكن-مُقنَّع')
    .replace(/Bearer\s+\S+/gi, 'توكن-مُقنَّع')
    .slice(0, max)
}

export async function sendToService(input: {
  userId: string
  type: string
  channels: string[]
  data?: Record<string, unknown>
  templateVariables?: Record<string, unknown>
}): Promise<void> {
  try {
    const [{ getNotificationService }, { NotificationType, NotificationChannel }] =
      await Promise.all([import('@/infrastructure/di/notification-container'), import('@/domain')])
    const service = getNotificationService()
    await service.send({
      userId: input.userId,
      type: NotificationType[input.type as keyof typeof NotificationType],
      channels: input.channels.map(
        (c) => NotificationChannel[c as keyof typeof NotificationChannel],
      ),
      data: input.data,
      templateVariables: input.templateVariables,
    })
  } catch (err) {
    // الإشعار محايد: فشله لا يكسر النشر أبداً.
    logger.warn('[publish-error-events] notification send failed:', err)
  }
}

/** مدراء المحتوى (moderator+) — المستفيدون من التنبيهات الدورية والفشل. */
export async function contentManagers(): Promise<Array<{ id: string }>> {
  try {
    return await db.user.findMany({
      where: { role: { in: ['moderator', 'manager', 'admin', 'owner'] } },
      select: { id: true },
      take: 50,
    })
  } catch (err) {
    logger.warn('[publish-error-events] content managers lookup failed:', err)
    return []
  }
}

/**
 * تسجيل حدث خطأ. يدمج الأحداث المفتوحة المكررة (نفس الرمز/النطاق/المرجع
 * خلال 30 د) — بلا صفوف معرّق. النتيجة `degraded: true` تعني أن هذه
 * الكتابة بلغت عدّادة التدهور 3 (وتنبّه مرة واحدة عبر notifiedAt).
 */
export async function recordPublishError(
  draft: EventDraft,
): Promise<{ eventId: string | null; degraded: boolean; alreadyOpen: boolean }> {
  const def: PublishErrorDef & { code: string } = publishErrorDef(draft.code)
  const scope = draft.scope
  const refId = draft.refId ?? null

  try {
    const dupeSince = new Date(Date.now() - EVENT_DEDUPE_WINDOW_MS)
    const existing = await db.publishErrorEvent.findFirst({
      where: { scope, code: def.code, refId, resolvedAt: null, createdAt: { gte: dupeSince } },
      select: { id: true, notifiedAt: true },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) return { eventId: existing.id, degraded: false, alreadyOpen: true }

    const event = await db.publishErrorEvent.create({
      data: {
        code: def.code,
        scope,
        refId,
        message: draft.message ? sanitizeMessage(draft.message) : null,
        causeAr: def.causeAr,
        fixAr: def.fixAr,
        retryable: def.retryable,
        attempt: Math.max(0, Math.trunc(draft.attempt ?? 0)),
      },
    })

    const openCount = await db.publishErrorEvent.count({
      where: { scope, refId, resolvedAt: null },
    })
    if (openCount >= DEGRADATION_THRESHOLD) {
      await alertDegraded(scope, refId, def, openCount)
      return { eventId: event.id, degraded: true, alreadyOpen: false }
    }
    return { eventId: event.id, degraded: false, alreadyOpen: false }
  } catch (err) {
    // التسجيل محايد — فشل قاعدة البيانات في كتابة الخطأ لا يكسر مسار النشر.
    logger.error('[publish-error-events] record failed:', err)
    return { eventId: null, degraded: false, alreadyOpen: false }
  }
}

/** تنبيه التدهور الاستباقي: درة واحدة لكل شريحة فشل (notifiedAt على الصفوف). */
async function alertDegraded(
  scope: PublishErrorScope,
  refId: string | null,
  def: PublishErrorDef & { code: string },
  openCount: number,
): Promise<void> {
  try {
    await db.publishErrorEvent.updateMany({
      where: { scope, refId, resolvedAt: null, notifiedAt: null },
      data: { notifiedAt: new Date() },
    })
  } catch (err) {
    logger.warn('[publish-error-events] degraded stamp failed:', err)
  }

  const managers = await contentManagers()
  for (const manager of managers) {
    await sendToService({
      userId: manager.id,
      type: 'PublishDegraded',
      channels: ['InApp', 'Email'],
      templateVariables: {
        entityLabel: `${scope}:${refId ?? '—'}`,
        failureCount: openCount,
        lastErrorText: `آخر رمز فشل: ${def.code} — ${def.causeAr}`,
      },
    })
  }
}

/** الحل اليدوي لحدث واحد (requireManager) — التدقيق مع الحدث. */
export async function resolveEventManually(
  eventId: string,
  actor: { id: string; username?: string } | undefined,
): Promise<{ ok: boolean; already?: boolean }> {
  const updated = await db.publishErrorEvent.updateMany({
    where: { id: eventId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedBy: actor?.id ?? null },
  })
  if (updated.count === 0) return { ok: false, already: true }
  if (actor?.id) {
    await logAction({
      userId: actor.id,
      username: actor.username,
      action: 'publish_error_resolve',
      entity: 'publish_error_event',
      entityId: eventId,
      details: 'حل يدوي من مركز الأخطاء',
    })
  }
  return { ok: true }
}

/**
 * الحل التلقائي المفتوح لأخطاء كيانات — يُستدعى عند النجاح (الانتهاء
 * الكامل لكل الأهداف أو نجاح إعادة المحاولة). resolvedBy يبقى null.
 */
export async function resolvePublishErrorsOpen(
  refs: Array<{ scope: PublishErrorScope; refId: string | null }>,
): Promise<number> {
  let total = 0
  for (const ref of refs) {
    try {
      const updated = await db.publishErrorEvent.updateMany({
        where: { scope: ref.scope, refId: ref.refId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      })
      total += updated.count
    } catch (err) {
      logger.warn('[publish-error-events] auto-resolve failed:', err)
    }
  }
  return total
}

/** الكيانات المتدهورة حالياً (>= عتبة الفشل المفتوح) — للوحة الصحة والتنبيه. */
export async function getDegradedEntities(): Promise<
  Array<{ scope: string; refId: string | null; openErrors: number; lastCreatedAt: Date }>
> {
  try {
    const open = await db.publishErrorEvent.groupBy({
      by: ['scope', 'refId'],
      where: { resolvedAt: null },
      _count: { _all: true },
      _max: { createdAt: true },
    })
    return open
      .filter((g) => g._count._all >= DEGRADATION_THRESHOLD)
      .map((g) => ({
        scope: g.scope,
        refId: g.refId,
        openErrors: g._count._all,
        lastCreatedAt: g._max.createdAt ?? new Date(0),
      }))
  } catch (err) {
    logger.warn('[publish-error-events] degraded lookup failed:', err)
    return []
  }
}

// ===== إشعارات الفشل/النجاح (تُستدعى من مسارات النشر) =====

export interface PublishFailureContext {
  postId: string
  postTitle?: string | null
  errorText?: string | null
  code?: string
  fixAr?: string
  attempt?: number
}
/** فشل نشر نهائي: المؤلف + المدراء (in-app + بريد) — dedup سياسة 30 د. */
export async function notifyPublishFailure(ctx: PublishFailureContext): Promise<void> {
  try {
    const post = ctx.postId
      ? await db.socialPost.findUnique({
          where: { id: ctx.postId },
          select: { createdById: true, title: true },
        })
      : null
    const recipients = new Set<string>()
    if (post?.createdById) recipients.add(post.createdById)
    for (const manager of await contentManagers()) recipients.add(manager.id)

    for (const userId of recipients) {
      await sendToService({
        userId,
        type: 'SocialPublishFailed',
        channels: ['InApp', 'Email'],
        templateVariables: {
          postTitle: ctx.postTitle ?? post?.title ?? ctx.postId,
          errorText: ctx.errorText ?? 'فشل النشر',
          fixText: ctx.fixAr ?? 'افتح مركز الأخطاء واضغط «كيف أصلحه؟»',
          errorRef: ctx.postId,
        },
      })
    }
  } catch (err) {
    logger.warn('[publish-error-events] failure notify failed:', err)
  }
}

/** نجاح اكتمال كل الوجهات: إشعار خفيف للمؤلف في التطبيق فقط (قابل للكتم). */
export async function notifyPublishSuccess(ctx: {
  postId: string
  postTitle?: string | null
  authorId?: string | null
  targetCount?: number
}): Promise<void> {
  try {
    if (!ctx.authorId) return
    await sendToService({
      userId: ctx.authorId,
      type: 'SocialPublishSucceeded',
      channels: ['InApp'],
      templateVariables: {
        postTitle: ctx.postTitle ?? ctx.postId,
        targetCount: Math.max(0, Math.trunc(ctx.targetCount ?? 1)),
      },
    })
  } catch (err) {
    logger.warn('[publish-error-events] success notify failed:', err)
  }
}
