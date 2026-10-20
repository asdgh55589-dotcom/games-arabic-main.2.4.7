/**
 * lib/social/route-resolve.ts — استنتاج أهداف النشر لمنصة كونسول.
 *
 * يقرأ `SocialPublishRoute` النشطة ضمن نافذتها الزمنية، مرتبة
 * (isDefault أولاً، ثم priority، ثم الأقدم)، ويستبعد دفاعياً الوجهات
 * المؤرشفة/المعطلة/غير-الموثقة (لا يمكن الإرسال إليها أصلاً).
 * لا شبكة ولا إرسال هنا — استنتاج خالص.
 */

import { db } from '@/lib/db'

export interface ResolvedRouteTarget {
  ruleId: string
  platformKey: string
  targetType: string
  destinationId: string
  chatId: string
  title: string | null
  threadId: number | null
  botId: string | null
  botLabel: string | null
  isDefault: boolean
  priority: number
}

export interface ResolvePlatformRoutesResult {
  platformKey: string
  defaultRuleId: string | null
  targets: ResolvedRouteTarget[]
  excluded: number
}

/**
 * أهداف منصة كونسول (PC | PS5 | …). تُستخدم في معاينة المصفوفة
 * ومعالج الجدولة — نفس المرجع الوحيد.
 */
export async function resolvePlatformRoutes(
  platformKey: string,
  now: Date = new Date(),
): Promise<ResolvePlatformRoutesResult> {
  const rules = await db.socialPublishRoute.findMany({
    where: {
      platformKey,
      isActive: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      ],
    },
    include: {
      destination: {
        select: {
          id: true,
          chatId: true,
          title: true,
          chatType: true,
          status: true,
          verificationStatus: true,
          archivedAt: true,
          messageThreadId: true,
        },
      },
      bot: { select: { id: true, label: true, status: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
  })

  const targets: ResolvedRouteTarget[] = []
  let excluded = 0
  for (const rule of rules) {
    const dest = rule.destination
    const effectiveThread = rule.threadId ?? dest?.messageThreadId ?? null
    const threadOk =
      effectiveThread == null ||
      (dest != null && (dest.chatType === 'group' || dest.chatType === 'supergroup'))
    const usable =
      dest &&
      !dest.archivedAt &&
      dest.status === 'active' &&
      dest.verificationStatus === 'verified' &&
      threadOk &&
      (!rule.botId || (rule.bot && rule.bot.status === 'active'))
    if (!usable || !dest) {
      excluded += 1
      continue
    }
    targets.push({
      ruleId: rule.id,
      platformKey: rule.platformKey,
      targetType: rule.targetType,
      destinationId: dest.id,
      chatId: dest.chatId,
      title: dest.title,
      threadId: rule.threadId ?? dest.messageThreadId ?? null,
      botId: rule.botId,
      botLabel: rule.bot?.label ?? null,
      isDefault: rule.isDefault,
      priority: rule.priority,
    })
  }

  return {
    platformKey,
    defaultRuleId: targets[0]?.ruleId ?? null,
    targets,
    excluded,
  }
}
