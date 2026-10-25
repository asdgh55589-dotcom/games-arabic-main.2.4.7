export const maxDuration = 60

import type { NextRequest } from 'next/server'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { forbidden, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { canCreateMod, canTranslateMod } from '@/lib/permissions'
import { CreateCreatorModSchema } from '@/lib/schemas'
import { stripModRelations, syncModRelations } from '@/lib/mod-relations'
import { slugify } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { ModStatusFilterSchema, parseFilterParam } from '@/lib/creator-query'

export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  const { searchParams } = new URL(req.url)
  // E4 — whitelist: unknown status values previously flowed into
  // `where.workflowStatus` unchecked.
  const statusParsed = parseFilterParam(searchParams, 'status', ModStatusFilterSchema, 'all')
  if (!statusParsed.ok) {
    return validationFail('الحالة غير صالحة')
  }
  const status = statusParsed.value
  const q = searchParams.get('q')?.trim() || ''
  const sort = searchParams.get('sort') || 'createdAt'
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

  const where: Record<string, unknown> = { authorId: user.id }

  if (status && status !== 'all') {
    if (status === 'IN_REVIEW') {
      ;(where as Record<string, unknown>).workflowStatus = { in: ['DRAFT', 'IN_REVIEW'] }
    } else {
      ;(where as Record<string, unknown>).workflowStatus = status
    }
  }

  if (q) {
    ;(where as Record<string, unknown>).name = { contains: q, mode: 'insensitive' }
  }

  // Validate sort field to prevent injection
  const allowedSorts = ['createdAt', 'updatedAt', 'downloads', 'views', 'rating', 'name']
  const sortField = allowedSorts.includes(sort) ? sort : 'createdAt'

  // count + page rows run in parallel (same where, no shared dependency).
  const [total, mods] = await Promise.all([
    db.mod.count({ where }),
    db.mod.findMany({
      where,
      select: {
        id: true,
        name: true,
        headline: true,
        slug: true,
        workflowStatus: true,
        views: true,
        downloads: true,
        endorsements: true,
        rating: true,
        ratingCount: true,
        comments: true,
        createdAt: true,
        updatedAt: true,
        isOriginalWork: true,
        originalSource: true,
        scheduledAt: true,
        thumbnailUrl: true,
        game: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return ok({
    mods,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  // 5 creations/hour per creator (spam guard for mod submissions).
  const limited = await rateLimitMiddleware(req, {
    limit: 5,
    window: 3600,
    keyPrefix: `creator:mod-create:${user.id}`,
  })
  if (limited) return limited

  const body = await req.json()
  const { action, ...modData } = body as { action?: string; [key: string]: unknown }

  // Defense in depth: privileged fields must never reach the DB from a
  // creator request, even if the schema is bypassed. Reject explicitly.
  if (
    'isFeatured' in modData ||
    'isTrending' in modData ||
    'isLatest' in modData
  ) {
    return forbidden('هذه الحقول مخصصة للمشرفين فقط')
  }

  const parsed = CreateCreatorModSchema.safeParse(modData)
  if (!parsed.success) {
    return validationFail(parsed.error.issues[0]?.message || 'بيانات غير صالحة')
  }

  const data = parsed.data as unknown as {
    isOriginalWork?: boolean
    originalSource?: string | null
    originalAuthor?: string | null
    name: string
    [key: string]: unknown
  }

  // المصدر يُحدَّد تلقائياً من دور المستخدم — تُتجاهل أي قيمة مرسلة.
  // الناشر لا يُطالَب بمصدر: يُنشأ التعريب بدونه، والأدمن يضيفه لاحقاً.
  const isOriginalWork = user.role !== 'publisher'
  ;(data as Record<string, unknown>).isOriginalWork = isOriginalWork
  if (!isOriginalWork) {
    data.originalSource = null
    data.originalAuthor = null
  }

  if (!canCreateMod(user.role, isOriginalWork)) {
    if (isOriginalWork) {
      return forbidden('المُعَرِّب يمكنه فقط إنشاء تعريبات من ترجمته الخاصة')
    }
    return forbidden('الناشر يمكنه فقط نشر تعريبات من مصادر خارجية')
  }

  // مسار المعرّب: العمل المترجم الخاص يتطلب صلاحية الترجمة explicitly.
  if (isOriginalWork && !canTranslateMod(user.role)) {
    return forbidden('لا تملك صلاحية الترجمة')
  }

  const workflowStatus = action === 'submit' ? 'IN_REVIEW' : 'DRAFT'

  const baseSlug = slugify(data.name as string)
  let slug = baseSlug
  const existing = await db.mod.findUnique({ where: { slug } })
  if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`

  // fallback للـ gameId — لم يعد مطلوباً في الواجهة (استُبدل بـ seriesId/teamId)
  let effectiveGameId = (data as unknown as { gameId?: string }).gameId
  // اربط التعريب بلعبة من نفس المنصة المختارة في النموذج (حتى لا يضيع حق الاختيار)
  const bodyPlatform =
    typeof (body as unknown as { platform?: unknown }).platform === 'string'
      ? ((body as unknown as { platform: string }).platform || '').trim().toUpperCase()
      : ''
  if (!effectiveGameId && bodyPlatform) {
    const platformGame = await db.game.findFirst({
      where: { platform: bodyPlatform },
      select: { id: true },
    })
    effectiveGameId = platformGame?.id || (undefined as unknown as string)
  }
  if (!effectiveGameId) {
    const fallbackGame = await db.game.findFirst({ select: { id: true } })
    effectiveGameId = fallbackGame?.id || (undefined as unknown as string)
  }
  if (!effectiveGameId) {
    return validationFail('لا توجد لعبة في قاعدة البيانات — أنشئ لعبة افتراضية أولاً')
  }

  // التحقق من التصنيف والقسم عند إرسالهما
  const categoryId = (data as unknown as { categoryId?: string | null }).categoryId
  if (categoryId) {
    const exists = await db.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    })
    if (!exists) return validationFail('التصنيف المحدد غير موجود')
  }
  const sectionId = (data as unknown as { sectionId?: string | null }).sectionId
  if (sectionId) {
    const exists = await db.section.findUnique({
      where: { id: sectionId },
      select: { id: true },
    })
    if (!exists) return validationFail('القسم المحدد غير موجود')
  }
  // Defense in depth: teamId requires membership/ownership; seriesId must exist.
  const teamId = (data as unknown as { teamId?: string | null }).teamId
  if (typeof teamId === 'string' && teamId) {
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: { id: true, ownerId: true },
    })
    if (!team) return validationFail('الفريق المحدد غير موجود')
    const isMember = await db.teamMembership.findFirst({
      where: { teamId, userId: user.id },
      select: { id: true },
    })
    if (team.ownerId !== user.id && !isMember) {
      return forbidden('لا تملك صلاحية الربط بهذا الفريق')
    }
  }
  const seriesId = (data as unknown as { seriesId?: string | null }).seriesId
  if (typeof seriesId === 'string' && seriesId) {
    const series = await db.series.findUnique({
      where: { id: seriesId },
      select: { id: true },
    })
    if (!series) return validationFail('السلسلة المحددة غير موجودة')
  }

  const mod = await db.mod.create({
    data: {
      // P3: relation arrays are persisted explicitly below (Prisma rejects
      // them inline) — stripModRelations keeps only scalar fields here.
      ...stripModRelations(data as unknown as Record<string, unknown>),
      gameId: effectiveGameId,
      authorId: user.id,
      workflowStatus,
      slug,
      galleryUrls: Array.isArray((data as unknown as { galleryUrls?: unknown }).galleryUrls)
        ? (data as unknown as { galleryUrls: string[] }).galleryUrls.join(',')
        : (data as unknown as { galleryUrls?: string }).galleryUrls || '',
      tags: Array.isArray((data as unknown as { tags?: unknown }).tags)
        ? (data as unknown as { tags: string[] }).tags.join(',')
        : (data as unknown as { tags?: string }).tags || '',
    } as unknown as Parameters<typeof db.mod.create>[0]['data'],
  })

  // P3: persist files/videos/members/links/tabs as real relations.
  try {
    await syncModRelations(db, mod.id, data as unknown as Parameters<typeof syncModRelations>[2], {
      uploadedBy: user.id,
    })
  } catch (relErr) {
    logger.error('[creator/mods POST] relations failed:', relErr)
  }

  // Notify admins if submitted for review (fire-and-forget)
  if (action === 'submit') {
    void (async () => {
      try {
        const admins = await db.user.findMany({
          where: { role: { in: ['admin', 'manager', 'owner'] } },
          select: { id: true },
        })
        if (admins.length > 0) {
          await db.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              actorId: user.id,
              type: 'admin_report',
              title: '📦 تعريب جديد بانتظار المراجعة',
              message: `${user.username} أرسل تعريب "${data.name}" للمراجعة`,
              data: { modId: mod.id, modName: data.name },
            })),
          })
        }
      } catch (err) {
        console.error('Failed to notify admins of new mod submission:', err)
      }
    })()
  }

  return ok(
    { mod, message: action === 'submit' ? 'تم إرسال التعريب للمراجعة' : 'تم حفظ التعريب كمسودة' },
    { status: 201 },
  )
  } catch (err) {
    logger.error('[creator/mods POST] failed:', err)
    return internalError(err instanceof Error ? err.message : 'Internal server error')
  }
}
