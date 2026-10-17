/**
 * lib/schedule-projects.ts — عمليات مهمة الجدولة الموحدة (المرحلة 4).
 *
 * SocialScheduleProject هي المصدر الوحيد المعتمد لكروني الموقع
 * والاجتماعي معاً. المسارات القديمة (Mod.scheduledAt /
 * SocialPost.scheduledFor) تبقى عاملة للتوافق — التفعيل يضبطها جنباً
 * إلى جنب بدل استبدالها.
 *
 * الحالات: draft (مسودة قابلة للتحرير) → scheduled (مفعّلة) →
 * running (جانب بدأ) → done (كل الجوانب المشمولة) / failed (فشل
 * طرفي) / canceled (إلغاء صريح يعيد المنشور المجدول).
 */

import { db } from '@/lib/db'
import { resolvePlatformRoutes } from '@/lib/social/route-resolve'
import { validateDestinationThread } from '@/lib/telegram-destinations'

export const SCHEDULE_MODES = ['site_only', 'social_only', 'both'] as const
export type ScheduleMode = (typeof SCHEDULE_MODES)[number]

export const SCHEDULE_STATUSES = [
  'draft',
  'scheduled',
  'running',
  'done',
  'failed',
  'canceled',
] as const

export interface ScheduleTargetSnapshot {
  destinationId: string
  threadId?: number | null
  botId?: string | null
}

export interface UpsertProjectInput {
  modId?: string | null
  mode: ScheduleMode
  sitePublishAt?: string | Date | null
  socialPublishAt?: string | Date | null
  targets?: ScheduleTargetSnapshot[]
  createdById?: string | null
  /** draft افتراضياً؛ scheduled = تفعيل فوري (يتحقق من المستقبلية). */
  status?: 'draft' | 'scheduled'
}

export class ScheduleProjectError extends Error {
  code: string
  details?: Record<string, string>
  constructor(code: string, message: string, details?: Record<string, string>) {
    super(message)
    this.code = code
    this.details = details
  }
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function assertModeDatetimes(
  mode: ScheduleMode,
  siteAt: Date | null,
  socialAt: Date | null,
  requireFuture: boolean,
): void {
  const needSite = mode !== 'social_only'
  const needSocial = mode !== 'site_only'
  if (needSite && !siteAt) {
    throw new ScheduleProjectError(
      'VALIDATION_ERROR',
      'وضعية الموقع تتطلب تاريخ النشر على الموقع',
      { sitePublishAt: 'مطلوب' },
    )
  }
  if (needSocial && !socialAt) {
    throw new ScheduleProjectError(
      'VALIDATION_ERROR',
      'وضعية المنشور تتطلب تاريخ النشر الاجتماعي',
      { socialPublishAt: 'مطلوب' },
    )
  }
  if (requireFuture) {
    const now = Date.now()
    if (needSite && siteAt && siteAt.getTime() <= now) {
      throw new ScheduleProjectError('VALIDATION_ERROR', 'موعد الموقع يجب أن يكون في المستقبل', {
        sitePublishAt: 'في المستقبل',
      })
    }
    if (needSocial && socialAt && socialAt.getTime() <= now) {
      throw new ScheduleProjectError(
        'VALIDATION_ERROR',
        'الموعد الاجتماعي يجب أن يكون في المستقبل',
        { socialPublishAt: 'في المستقبل' },
      )
    }
  }
}

/**
 * إنشاء مهمة جدولة (مسودة أو مفعّلة). لا ينشئ SocialPost هنا —
 * الإنشاء يتم في التفعيل فقط.
 */
export async function createScheduleProject(input: UpsertProjectInput) {
  if (!SCHEDULE_MODES.includes(input.mode)) {
    throw new ScheduleProjectError('VALIDATION_ERROR', 'وضعية نشر غير معروفة', {
      mode: 'site_only | social_only | both',
    })
  }
  const siteAt = toDate(input.sitePublishAt)
  const socialAt = toDate(input.socialPublishAt)
  if ((input.sitePublishAt && !siteAt) || (input.socialPublishAt && !socialAt)) {
    throw new ScheduleProjectError('VALIDATION_ERROR', 'صيغة التاريخ غير صالحة', {})
  }
  const status = input.status ?? 'draft'
  assertModeDatetimes(input.mode, siteAt, socialAt, status === 'scheduled')

  if (input.modId) {
    const mod = await db.mod.findUnique({
      where: { id: input.modId },
      select: { id: true },
    })
    if (!mod) {
      throw new ScheduleProjectError('VALIDATION_ERROR', 'التعريب غير موجود', { modId: '؟' })
    }
  }

  const project = await db.socialScheduleProject.create({
    data: {
      modId: input.modId ?? null,
      mode: input.mode,
      sitePublishAt: siteAt,
      socialPublishAt: socialAt,
      targetIds: (input.targets ?? []) as unknown as object,
      createdById: input.createdById ?? null,
      status,
    },
  })

  if (status === 'scheduled') {
    await activateScheduleProject(project.id, input.createdById ?? null)
    return getScheduleProject(project.id)
  }
  return getScheduleProject(project.id)
}

/** تعديل مهمة قبل الإطلاق (مسودة/مجدولة فقط). */
export async function updateScheduleProject(id: string, patch: Partial<UpsertProjectInput>) {
  const existing = await db.socialScheduleProject.findUnique({ where: { id } })
  if (!existing) {
    throw new ScheduleProjectError('NOT_FOUND', 'مهمة الجدولة غير موجودة')
  }
  if (existing.status !== 'draft' && existing.status !== 'scheduled') {
    throw new ScheduleProjectError(
      'CONFLICT',
      `لا يمكن تعديل مهمة بحالة «${existing.status}» — انسخها كمهمة جديدة`,
    )
  }

  const mode = (patch.mode ?? existing.mode) as ScheduleMode
  if (patch.mode && !SCHEDULE_MODES.includes(patch.mode)) {
    throw new ScheduleProjectError('VALIDATION_ERROR', 'وضعية نشر غير معروفة')
  }
  const siteAt =
    patch.sitePublishAt !== undefined ? toDate(patch.sitePublishAt) : existing.sitePublishAt
  const socialAt =
    patch.socialPublishAt !== undefined ? toDate(patch.socialPublishAt) : existing.socialPublishAt
  if ((patch.sitePublishAt && !siteAt) || (patch.socialPublishAt && !socialAt)) {
    throw new ScheduleProjectError('VALIDATION_ERROR', 'صيغة التاريخ غير صالحة')
  }
  assertModeDatetimes(mode, siteAt, socialAt, existing.status === 'scheduled')

  await db.socialScheduleProject.update({
    where: { id },
    data: {
      mode,
      sitePublishAt: siteAt,
      socialPublishAt: socialAt,
      ...(patch.targets !== undefined ? { targetIds: patch.targets as unknown as object } : {}),
    },
  })

  // إعادة التفعيل بعد التعديل: حدّث المنشور المجدول المرتبط إن وُجد.
  if (existing.status === 'scheduled') {
    await activateScheduleProject(id, existing.createdById)
  }
  return getScheduleProject(id)
}

export async function getScheduleProject(id: string) {
  return db.socialScheduleProject.findUnique({
    where: { id },
    include: {
      mod: {
        select: {
          id: true,
          name: true,
          slug: true,
          workflowStatus: true,
          game: { select: { platform: true } },
        },
      },
      post: { select: { id: true, status: true, scheduledFor: true, externalId: true } },
    },
  })
}

export interface ListProjectsFilter {
  status?: string
  platform?: string
  ownerId?: string
  take?: number
  skip?: number
}

/** قائمة المهام لصفحة الأدمن (فلاتر الحالة/المنصة/المالك). */
export async function listScheduleProjects(filter: ListProjectsFilter = {}) {
  const where: Record<string, unknown> = {}
  if (filter.status) where.status = filter.status
  if (filter.ownerId) where.createdById = filter.ownerId
  // المنصة على اللعبة المرتبطة (Mod.game.platform) لا على المود نفسه.
  if (filter.platform) where.mod = { game: { platform: filter.platform } }

  const [total, projects] = await Promise.all([
    db.socialScheduleProject.count({ where }),
    db.socialScheduleProject.findMany({
      where,
      include: {
        mod: {
          select: {
            id: true,
            name: true,
            slug: true,
            workflowStatus: true,
            game: { select: { platform: true } },
          },
        },
        post: { select: { id: true, status: true, scheduledFor: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filter.take ?? 50,
      skip: filter.skip ?? 0,
    }),
  ])
  return { projects, total }
}

/** فحص هدف لقطة قبل التفعيل: وجهة سليمة + thread صالح + بوت موجود. */
async function checkSnapshotTarget(target: ScheduleTargetSnapshot): Promise<string | null> {
  const destination = await db.telegramDestination.findUnique({
    where: { id: target.destinationId },
    select: {
      chatId: true,
      chatType: true,
      archivedAt: true,
      lastHealthAt: true,
      lastHealthError: true,
    },
  })
  if (!destination || destination.archivedAt) return 'الوجهة غير موجودة أو مؤرشفة'
  const threadCheck = validateDestinationThread(destination.chatType, target.threadId ?? null, {
    canonicalId: destination.chatId,
    healthConfirmed: destination.lastHealthAt != null && destination.lastHealthError == null,
  })
  if (!threadCheck.ok) return threadCheck.message
  if (target.botId) {
    const bot = await db.socialTelegramBot.findUnique({
      where: { id: target.botId },
      select: { id: true },
    })
    if (!bot) return 'البوت المحدد غير موجود'
  }
  return null
}

/**
 * التفعيل (Category-6 action 11): يضبط Mod.scheduledAt للتوافق +
 * ينشئ/يُحدّث SocialPost مجدولاً بأهدافه + يعلّم المشروع scheduled.
 * يُستدعى من الحفظ-مع-تفعيل، ومن تعديل مهمة مجدولة، ومن صفحة الأدمن.
 */
export async function activateScheduleProject(projectId: string, actorId: string | null) {
  const project = await db.socialScheduleProject.findUnique({
    where: { id: projectId },
    include: { mod: { include: { game: { select: { platform: true } } } } },
  })
  if (!project) {
    throw new ScheduleProjectError('NOT_FOUND', 'مهمة الجدولة غير موجودة')
  }
  const mode = project.mode as ScheduleMode
  assertModeDatetimes(mode, project.sitePublishAt, project.socialPublishAt, true)

  let snapshots = (Array.isArray(project.targetIds) ? project.targetIds : []).map((t) => ({
    destinationId: String((t as Record<string, unknown>).destinationId ?? ''),
    threadId: ((t as Record<string, unknown>).threadId as number | null) ?? null,
    botId: ((t as Record<string, unknown>).botId as string | null) ?? null,
  }))

  // بلا لقطات: استنتاج من قواعد منصة لعبة المود (إن وُجدت) — وإلا رفض صريح.
  if (mode !== 'site_only' && snapshots.length === 0) {
    const gamePlatform = project.mod?.game?.platform ?? null
    if (gamePlatform) {
      const resolved = await resolvePlatformRoutes(gamePlatform, new Date())
      snapshots = resolved.targets.map((t) => ({
        destinationId: t.destinationId,
        threadId: t.threadId,
        botId: t.botId,
      }))
    }
    if (snapshots.length === 0) {
      throw new ScheduleProjectError(
        'VALIDATION_ERROR',
        'وضعية المنشور تتطلب هدفاً واحداً على الأقل — اختر من الأهداف المستنتجة أو أضف يدوياً',
        { targets: 'مطلوب' },
      )
    }
    // حفظ اللقطة المستنتجة لثبات السلوك (لا مفاجآت عند تغير القواعد).
    await db.socialScheduleProject.update({
      where: { id: projectId },
      data: { targetIds: snapshots as unknown as object },
    })
  }
  for (const snap of snapshots) {
    const problem = await checkSnapshotTarget(snap)
    if (problem) {
      throw new ScheduleProjectError('VALIDATION_ERROR', problem, { targets: problem })
    }
  }

  // الجانب الاجتماعي: إنشاء/تحديث المنشور المجدول بأهدافه.
  // لقطة المحتوى تُلتقط الآن (الاسم/النص/الأهداف) — التحرير لاحقاً للقالب
  // أو لأي إعدادات لن يغيّر ما سيُنشر؛ لذا أرشفة قالب بعد الجدولة آمنة.
  let postId = project.postId
  if (mode !== 'site_only') {
    const mod = project.mod
    const title = mod ? mod.name : 'منشور مجدول'
    const body = mod
      ? `${mod.name}\n\n${mod.headline || mod.summary || ''}\n\nرابط التعريب: /mod/${mod.slug}`.trim()
      : 'منشور مجدول'
    const postData = {
      platform: 'telegram',
      title: title.slice(0, 256),
      body,
      status: 'scheduled',
      scheduledFor: project.socialPublishAt,
      // احتياطي المسار الأحادي: أول وجهة (المحرك المتعدد هو المرجع الفعلي).
      destinationId: snapshots[0]?.destinationId ?? null,
      // مرآة سريعة لوضعية النشر (Phase 5) — قراءة عرض لا تُؤثر على المحرك.
      siteMode: mode,
    }
    if (postId) {
      await db.socialPost.update({ where: { id: postId }, data: postData })
      // استبدال الأهداف (صفوف العمل فقط — سجل التسليم يبقى).
      await db.socialPostTarget.deleteMany({ where: { postId } })
    } else {
      const created = await db.socialPost.create({
        data: { ...postData, createdById: actorId },
        select: { id: true },
      })
      postId = created.id
    }
    for (const snap of snapshots) {
      await db.socialPostTarget.create({
        data: {
          postId: postId as string,
          destinationId: snap.destinationId,
          botId: snap.botId,
          threadId: snap.threadId,
          status: 'pending',
        },
      })
    }
  }

  // الجانب الموقعي (توافق): scheduledAt + المرايا على المود.
  if (project.modId && mode !== 'social_only') {
    await db.mod.update({
      where: { id: project.modId },
      data: {
        scheduledAt: project.sitePublishAt,
        publishMode: mode,
        socialPostId: postId,
        socialScheduledAt: project.socialPublishAt,
      },
    })
  } else if (project.modId) {
    await db.mod.update({
      where: { id: project.modId },
      data: { publishMode: mode, socialPostId: postId, socialScheduledAt: project.socialPublishAt },
    })
  }

  await db.socialScheduleProject.update({
    where: { id: projectId },
    data: { status: 'scheduled', postId, error: null },
  })
  return getScheduleProject(projectId)
}

/**
 * إلغاء مهمة: المشروع canceled + المنشور المجدول المرتبط canceled +
 * تصفير scheduledAt التوافقي (المود نفسه لا يُمس).
 */
export async function cancelScheduleProject(id: string) {
  const project = await db.socialScheduleProject.findUnique({
    where: { id },
    select: { id: true, status: true, postId: true, modId: true, mode: true },
  })
  if (!project) {
    throw new ScheduleProjectError('NOT_FOUND', 'مهمة الجدولة غير موجودة')
  }
  if (project.status === 'done' || project.status === 'canceled') {
    throw new ScheduleProjectError('CONFLICT', 'المهمة منتهية أصلاً — لا إلغاء')
  }

  if (project.postId) {
    const post = await db.socialPost.findUnique({
      where: { id: project.postId },
      select: { status: true },
    })
    if (post && (post.status === 'scheduled' || post.status === 'draft')) {
      await db.socialPost.update({ where: { id: project.postId }, data: { status: 'canceled' } })
    }
  }
  if (project.modId && project.mode !== 'social_only') {
    await db.mod.update({ where: { id: project.modId }, data: { scheduledAt: null } })
  }
  await db.socialScheduleProject.update({ where: { id }, data: { status: 'canceled' } })
  return getScheduleProject(id)
}

export interface DryRunCheck {
  label: string
  ok: boolean
  message: string
}

export interface DryRunInput {
  mode: ScheduleMode
  sitePublishAt?: string | Date | null
  socialPublishAt?: string | Date | null
  platformKey?: string | null
  manualTargets?: ScheduleTargetSnapshot[]
}

/**
 * التجربة الجافة: فحص كامل بلا أي كتابة — الوضعية، المستقبلية، الأهداف
 * (مستنتجة أو يدوية) مع حالة كل وجهة وبوتها. تُستخدم في المعالج قبل الحفظ.
 */
export async function dryRunScheduleCheck(input: DryRunInput): Promise<{
  ok: boolean
  checks: DryRunCheck[]
}> {
  const checks: DryRunCheck[] = []
  const siteAt = toDate(input.sitePublishAt)
  const socialAt = toDate(input.socialPublishAt)

  try {
    assertModeDatetimes(input.mode, siteAt, socialAt, true)
    checks.push({ label: 'الوضعية والموعد', ok: true, message: 'سليم — الموعد في المستقبل' })
  } catch (err) {
    checks.push({
      label: 'الوضعية والموعد',
      ok: false,
      message: err instanceof Error ? err.message : 'تاريخ غير صالح',
    })
    return { ok: false, checks }
  }

  if (input.mode === 'site_only') {
    checks.push({ label: 'الموقع', ok: true, message: 'سيُنشر على Games-Arabic رسمياً' })
    return { ok: true, checks }
  }

  // الأهداف: يدوية مقدمة، وإلا مستنتجة من قواعد المنصة.
  let snapshots: ScheduleTargetSnapshot[] = input.manualTargets ?? []
  let inferred = false
  if (snapshots.length === 0 && input.platformKey) {
    const resolved = await resolvePlatformRoutes(input.platformKey, new Date())
    snapshots = resolved.targets.map((t) => ({
      destinationId: t.destinationId,
      threadId: t.threadId,
      botId: t.botId,
    }))
    inferred = true
    if (snapshots.length === 0) {
      checks.push({
        label: 'الأهداف',
        ok: false,
        message: 'لا أهداف مستنتجة لهذه المنصة — أضف قاعدة توجيه أو اختر يدوياً',
      })
      return { ok: false, checks }
    }
  }
  if (snapshots.length === 0) {
    checks.push({ label: 'الأهداف', ok: false, message: 'اختر هدفاً واحداً على الأقل' })
    return { ok: false, checks }
  }

  let allOk = true
  for (const [index, snap] of snapshots.entries()) {
    const dest = await db.telegramDestination.findUnique({
      where: { id: snap.destinationId },
      select: {
        chatId: true,
        title: true,
        status: true,
        verificationStatus: true,
        archivedAt: true,
        botId: true,
      },
    })
    const label = `الهدف ${index + 1}: ${dest?.title || dest?.chatId || snap.destinationId}`
    if (!dest || dest.archivedAt) {
      allOk = false
      checks.push({ label, ok: false, message: 'الوجهة غير موجودة أو مؤرشفة' })
      continue
    }
    if (dest.status !== 'active' || dest.verificationStatus !== 'verified') {
      allOk = false
      checks.push({ label, ok: false, message: `الوجهة غير جاهزة (status=${dest.status})` })
      continue
    }
    const botId = snap.botId ?? dest.botId
    if (botId) {
      const bot = await db.socialTelegramBot.findUnique({
        where: { id: botId },
        select: { status: true },
      })
      if (!bot || bot.status !== 'active') {
        allOk = false
        checks.push({ label, ok: false, message: 'البوت غير موجود أو غير نشط' })
        continue
      }
    } else if (!process.env.TELEGRAM_BOT_TOKEN) {
      allOk = false
      checks.push({ label, ok: false, message: 'لا بوت مسند ولا افتراضي — أسند بوتاً' })
      continue
    }
    checks.push({
      label,
      ok: true,
      message: inferred ? 'مستنتج من قواعد المنصة — جاهز' : 'يدوي — جاهز',
    })
  }

  return { ok: allOk, checks }
}

/**
 * إكمال جانب واحد من الكرونات (site | social). done عندما تكتمل كل
 * الجوانب المشمولة، failed عند أول فشل طرفي، وإلا running.
 */
export async function completeProjectSide(
  projectId: string,
  side: 'site' | 'social',
  error?: string,
): Promise<void> {
  const project = await db.socialScheduleProject.findUnique({
    where: { id: projectId },
    include: {
      mod: { select: { workflowStatus: true } },
      post: { select: { status: true } },
    },
  })
  if (!project) return
  if (project.status === 'done' || project.status === 'failed' || project.status === 'canceled') {
    return
  }

  if (error) {
    await db.socialScheduleProject.update({
      where: { id: projectId },
      data: { status: 'failed', error: `${side}: ${error}`.slice(0, 500) },
    })
    return
  }

  const needsSite = project.mode !== 'social_only'
  const needsSocial = project.mode !== 'site_only'
  const siteOk = !needsSite || project.mod?.workflowStatus === 'PUBLISHED'
  const socialOk = !needsSocial || project.post?.status === 'published'
  await db.socialScheduleProject.update({
    where: { id: projectId },
    data: { status: siteOk && socialOk ? 'done' : 'running' },
  })
}
