import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireCreator, requireModerator } from '@/lib/auth'
import { parsePagination, pickSort } from '@/lib/api-utils'
import { syncSeriesCounts } from '@/lib/series-helpers'
import { slugify } from '@/lib/utils'
import { syncTeamCounts } from '@/lib/team-helpers'
import { checkAndUpgradeTier } from '@/lib/tier-engine'
import { okPaginated, ok, validationFail, internalError, forbidden } from '@/lib/api-response'
import { CreateModSchema } from '@/lib/schemas'
import { calculateModQualityScore } from '@/lib/mod-quality'
import { canCreateMod } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

const SORTS = ['newest', 'oldest', 'downloads', 'endorsements', 'views', 'name'] as const
type Sort = (typeof SORTS)[number]

const ORDER_BY: Record<Sort, Record<string, 'desc' | 'asc'>> = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  downloads: { downloads: 'desc' },
  endorsements: { endorsements: 'desc' },
  views: { views: 'desc' },
  name: { name: 'asc' },
}

// GET /api/admin/mods — قائمة كل التعريبات (مع pagination + فلترة)
export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || null
    const sort = pickSort(searchParams.get('sort'), SORTS, 'newest')
    const platform = searchParams.get('platform')
    const featured = searchParams.get('featured')
    const trending = searchParams.get('trending')
    const workflowStatus = searchParams.get('workflowStatus')
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 24,
      maxLimit: 100,
    })

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { summary: { contains: search } },
        { tags: { contains: search } },
        { series: { contains: search } },
      ]
    }
    if (platform) where.game = { platform }
    if (featured === 'true') where.isFeatured = true
    if (trending === 'true') where.isTrending = true
    if (workflowStatus) where.workflowStatus = workflowStatus

    const [total, mods] = await Promise.all([
      db.mod.count({ where }),
      db.mod.findMany({
        where,
        orderBy: ORDER_BY[sort],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              role: true,
              tier: true,
              specialRoles: true,
            },
          },
          game: { select: { id: true, name: true, slug: true, platform: true } },
          category: { select: { id: true, name: true, slug: true } },
          _count: {
            select: {
              files: true,
              commentsRecords: true,
              teamMembers: true,
            },
          },
        },
      }),
    ])

    return okPaginated(mods, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[admin/mods GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed to fetch mods')
  }
}

// POST /api/admin/mods — إنشاء تعريب جديد
//
// البيانات المطلوبة في الـ body:
//   - name, summary, description (مطلوبة)
//   - gameId (مطلوب)
//   - categoryId, version, fileSize, fileFormat (مطلوبة)
//   - thumbnailUrl, imageUrl (مطلوبة)
//   - كل باقي الحقول اختيارية
//
// التعقيد: بنقبل كمان arrays للـ files, teamMembers, contactLinks, videoGroups, customTabs
// وبتنشئهم في transaction واحدة.
export async function POST(req: NextRequest) {
  try {
    const user = await requireCreator()
    const body = await req.json()

    // ===== التحقق من الحقول باستخدام Zod =====
    const parsed = CreateModSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const data = parsed.data

    // التمييز بين عمل أصلي وإعادة نشر — creator مقابل publisher
    const isOriginalWork = (data as unknown as { isOriginalWork?: boolean }).isOriginalWork ?? true
    const originalSource = (data as unknown as { originalSource?: string }).originalSource
    const originalAuthor = (data as unknown as { originalAuthor?: string }).originalAuthor

    if (!canCreateMod(user.role, isOriginalWork)) {
      if (isOriginalWork) {
        return forbidden('يجب أن تكون مُعَرِّباً لإنشاء تعريبات من ترجمتك الخاصة')
      }
      return forbidden('يجب أن تكون ناشراً أو أعلى لنشر تعريبات من مصادر خارجية')
    }

    if (!isOriginalWork && !originalSource?.trim()) {
      return validationFail('يجب على الناشر ذكر المصدر الأصلي للتعريب')
    }

    // fallback للـ gameId — لم يعد مطلوباً في الواجهة (استُبدل بـ seriesId/teamId)
    // نحافظ على توافق قاعدة البيانات (gameId NOT NULL) عبر استخدام أول لعبة موجودة إن لم يُرسل
    let effectiveGameId: string | null = (data.gameId as string) || (body as any).gameId || null
    if (!effectiveGameId) {
      const fallbackGame = await db.game.findFirst({ select: { id: true } })
      effectiveGameId = fallbackGame?.id || null
    }
    if (!effectiveGameId) {
      return validationFail('لا توجد لعبة في قاعدة البيانات — أنشئ لعبة افتراضية أولاً')
    }

    // حساب درجة الجودة
    const qualityScore = calculateModQualityScore({
      name: data.name,
      summary: data.summary || '',
      description: data.description || '',
      arabicTitle: data.arabicTitle || '',
      translationScope: data.translationScope || '',
      compatibility: data.compatibility || '',
      tags: Array.isArray(data.tags) ? data.tags.join(',') : data.tags || '',
      changelog: data.changelog || '',
      installGuide: data.installGuide || '',
      thumbnailUrl: data.thumbnailUrl || '',
      imageUrl: data.imageUrl || '',
      galleryUrls: Array.isArray(data.galleryUrls)
        ? data.galleryUrls.join(',')
        : data.galleryUrls || '',
      files: body.files || [],
      teamMembers: body.teamMembers || [],
      gameId: effectiveGameId,
      teamId: data.teamId || null,
    })

    // توليد slug فريد
    let slug = data.slug || slugify(data.name)
    // لو الـ slug موجود، نضيف رقم
    const existingSlug = await db.mod.findUnique({ where: { slug } })
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    // ===== إنشاء التعريب + كل الـ relations في transaction =====
    const mod = await db.$transaction(async (tx) => {
      const created = await tx.mod.create({
        data: {
          slug,
          name: data.name,
          summary: data.summary,
          description: data.description,
          changelog: data.changelog || '',
          installGuide: data.installGuide || '',
          arabicTitle: data.arabicTitle || '',
          translationScope: data.translationScope || '',
          compatibility: data.compatibility || '',
          authorId: user.id,
          gameId: effectiveGameId!,
          categoryId: (data.categoryId as string) || null,
          thumbnailUrl: data.thumbnailUrl,
          imageUrl: data.imageUrl,
          galleryUrls: Array.isArray(data.galleryUrls)
            ? data.galleryUrls.join(',')
            : data.galleryUrls || '',
          version: data.version || '1.0.0',
          fileSize: data.fileSize || 'MB 0',
          fileFormat: data.fileFormat || 'zip',
          tags: Array.isArray(data.tags) ? data.tags.join(',') : data.tags || '',
          series: data.series || '',
          seriesId: data.seriesId || null,
          translationTeam: data.translationTeam || '',
          teamId: data.teamId || null,
          sectionId: data.sectionId || null,
          translationType: data.translationType || 'unofficial',
          isOriginalWork: isOriginalWork,
          originalSource: originalSource?.trim() || null,
          originalAuthor: originalAuthor?.trim() || null,
          isFeatured: Boolean(data.isFeatured),
          isTrending: Boolean(data.isTrending),
          isLatest: data.isLatest !== undefined ? Boolean(data.isLatest) : true,
          releaseDate: data.releaseDate ? new Date(data.releaseDate) : new Date(),
          qualityScore,
        },
      })

      // ملفات التحميل — bulk
      if (Array.isArray(body.files)) {
        const validFiles = (
          body.files as Array<{
            title?: string
            description?: string
            alert?: string
            version?: string
            releaseDate?: string
            fileSize?: string
            fileFormat?: string
            order?: number
            links?: Array<{ url: string; label?: string }>
          }>
        ).filter((f) => f.title)
        if (validFiles.length > 0) {
          const filesData = validFiles.map((f, i) => ({
            modId: created.id,
            title: f.title as string,
            description: f.description || null,
            alert: f.alert || null,
            version: f.version || body.version || '1.0.0',
            releaseDate: f.releaseDate ? new Date(f.releaseDate) : new Date(),
            fileSize: f.fileSize || body.fileSize || 'MB 0',
            fileFormat: f.fileFormat || body.fileFormat || 'zip',
            order: f.order ?? i,
          }))
          const createdFiles = await (
            tx.modFile as unknown as {
              createManyAndReturn: (args: {
                data: typeof filesData
              }) => Promise<Array<{ id: string }>>
            }
          ).createManyAndReturn({ data: filesData })
          const allLinks: Array<{
            fileId: string
            url: string
            label: string | null
            order: number
          }> = []
          validFiles.forEach((f, idx) => {
            const fileId = createdFiles[idx]?.id
            if (!fileId || !Array.isArray(f.links)) return
            f.links.forEach((l, j) => {
              if (l.url) allLinks.push({ fileId, url: l.url, label: l.label || null, order: j })
            })
          })
          if (allLinks.length > 0) {
            await tx.modFileLink.createMany({ data: allLinks })
          }
        }
      }

      // أعضاء الفريق — bulk
      if (Array.isArray(body.teamMembers)) {
        const membersData = (
          body.teamMembers as Array<{
            name?: string
            avatarUrl?: string
            role?: string
            contribution?: string
            order?: number
          }>
        )
          .filter((m) => m.name)
          .map((m, i) => ({
            modId: created.id,
            name: m.name as string,
            avatarUrl: m.avatarUrl || null,
            role: m.role || 'مترجم',
            contribution: m.contribution || null,
            order: m.order ?? i,
          }))
        if (membersData.length > 0) {
          await tx.modTeamMember.createMany({ data: membersData })
        }
      }

      // روابط التواصل — bulk
      if (Array.isArray(body.contactLinks)) {
        const linksData = (
          body.contactLinks as Array<{
            url?: string
            type?: string
            label?: string
            order?: number
          }>
        )
          .filter((c) => c.url)
          .map((c, i) => ({
            modId: created.id,
            type: c.type || 'website',
            label: c.label || '',
            url: c.url as string,
            order: c.order ?? i,
          }))
        if (linksData.length > 0) {
          await tx.modContactLink.createMany({ data: linksData })
        }
      }

      // أقسام الفيديوهات — bulk
      if (Array.isArray(body.videoGroups)) {
        const validGroups = (
          body.videoGroups as Array<{
            name?: string
            order?: number
            videos?: Array<{
              title?: string
              url?: string
              thumbnail?: string
              duration?: string
              description?: string
              views?: number
              likes?: number
              commentsCount?: number
              channel?: string
              publishedAt?: string
              order?: number
            }>
          }>
        ).filter((g) => g.name)
        if (validGroups.length > 0) {
          const groupsData = validGroups.map((g, i) => ({
            modId: created.id,
            name: g.name as string,
            order: g.order ?? i,
          }))
          const createdGroups = await (
            tx.modVideoGroup as unknown as {
              createManyAndReturn: (args: {
                data: typeof groupsData
              }) => Promise<Array<{ id: string }>>
            }
          ).createManyAndReturn({ data: groupsData })
          const allVideos: Array<{
            groupId: string
            title: string
            url: string
            thumbnail: string | null
            duration: string | null
            description: string | null
            views: number
            likes: number
            commentsCount: number
            channel: string | null
            publishedAt: Date | null
            order: number
          }> = []
          validGroups.forEach((g, idx) => {
            const groupId = createdGroups[idx]?.id
            if (!groupId || !Array.isArray(g.videos)) return
            g.videos.forEach((v, j) => {
              if (!v.title || !v.url) return
              allVideos.push({
                groupId,
                title: v.title,
                url: v.url,
                thumbnail: v.thumbnail || null,
                duration: v.duration || null,
                description: v.description || null,
                views: v.views || 0,
                likes: v.likes || 0,
                commentsCount: v.commentsCount || 0,
                channel: v.channel || null,
                publishedAt: v.publishedAt ? new Date(v.publishedAt) : null,
                order: v.order ?? j,
              })
            })
          })
          if (allVideos.length > 0) {
            await tx.modVideo.createMany({ data: allVideos })
          }
        }
      }

      // التبويبات المخصصة — bulk
      if (Array.isArray(body.customTabs)) {
        const tabsData = (
          body.customTabs as Array<{
            name?: string
            slug?: string
            content?: string
            order?: number
            visible?: boolean
          }>
        )
          .filter((t) => t.name)
          .map((t, i) => ({
            modId: created.id,
            name: t.name as string,
            slug: t.slug || slugify(t.name as string),
            content: t.content || '',
            order: t.order ?? i,
            visible: t.visible !== undefined ? Boolean(t.visible) : true,
          }))
        if (tabsData.length > 0) {
          await tx.modCustomTab.createMany({ data: tabsData })
        }
      }

      return created
    })

    // Check for tier upgrade
    checkAndUpgradeTier(mod.authorId).catch(console.error)

    // إشعار نشر التعريب
    try {
      const { getUseCases } = await import('@/application/use-cases/factory')
      const useCases = getUseCases()
      await useCases.sendModPublished.execute({
        modAuthorId: mod.authorId,
        modId: mod.id,
        modTitle: mod.name,
        modSlug: mod.slug,
      })
    } catch {}

    // تحديث عدّادات اللعبة والسلسلة — increment ذري (Issue 3.4/3.5)
    if (mod.gameId) {
      await db.game
        .update({ where: { id: mod.gameId }, data: { modCount: { increment: 1 } } })
        .catch(() => {})
    }
    if (mod.seriesId) {
      await db.series
        .update({ where: { id: mod.seriesId }, data: { modCount: { increment: 1 } } })
        .catch(() => {})
    }
    // تحديث عدّادات السلسلة/الفريق بعد الإنشاء (re-sync للتأكد)
    if (mod.seriesId) await syncSeriesCounts(mod.seriesId).catch(() => {})
    if (mod.teamId) await syncTeamCounts(mod.teamId).catch(() => {})

    // ISR: revalidate public pages after mod creation
    try {
      revalidatePath('/')
      if (mod.gameId) {
        const game = await db.game.findUnique({
          where: { id: mod.gameId },
          select: { slug: true, platform: true },
        })
        if (game) {
          revalidatePath('/platform/' + game.platform)
          revalidatePath('/games/' + game.slug)
        }
      }
      revalidatePath('/mod/' + mod.slug)
    } catch {}

    return ok(mod)
  } catch (err) {
    console.error('[admin/mods POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed to create mod')
  }
}
