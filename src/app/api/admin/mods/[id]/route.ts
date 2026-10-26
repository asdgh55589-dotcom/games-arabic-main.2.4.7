export const maxDuration = 60

import { revalidatePath } from 'next/cache'
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { canDelete, canEditMod, requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { snapshotReportsForTarget } from '@/lib/reports/snapshot'
import { syncGameCounts } from '@/lib/game-helpers'
import { invalidateGameModsCache } from '@/lib/game-mods-cache'
import { parseIaUrl } from '@/lib/ia'
import { logger } from '@/lib/logger'
import { calculateModQualityScore } from '@/lib/mod-quality'
import { syncSeriesCounts } from '@/lib/series-helpers'
import { syncTeamCounts } from '@/lib/team-helpers'
import { slugify } from '@/lib/utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/mods/[id] — تعريب واحد بكل الـ relations
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    const mod = await db.mod.findUnique({
      where: { id },
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
        reviewer: { select: { id: true, username: true, avatarUrl: true, role: true } },
        game: true,
        category: true,
        files: {
          orderBy: { order: 'asc' },
          include: { links: { orderBy: { order: 'asc' } } },
        },
        teamMembers: { orderBy: { order: 'asc' } },
        contactLinks: { orderBy: { order: 'asc' } },
        videoGroups: {
          orderBy: { order: 'asc' },
          include: { videos: { orderBy: { order: 'asc' } } },
        },
        customTabs: { orderBy: { order: 'asc' } },
        siteLinks: { orderBy: { order: 'asc' } },
        changelogs: { orderBy: { createdAt: 'desc' }, include: { changedBy: { select: { id: true, username: true, avatarUrl: true, role: true } } } },
        workflowHistory: {
          orderBy: { changedAt: 'desc' },
          take: 20,
          include: {
            changedByUser: {
              select: { id: true, username: true, avatarUrl: true, role: true },
            },
          },
        },
        versionHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdByUser: { select: { id: true, username: true } },
            _count: { select: { files: true } },
          },
        },
      },
    })

    if (!mod) {
      return notFound()
    }

    return ok(mod)
  } catch (err) {
    logger.error('[admin/mods/[id] GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed')
  }
}

// PUT /api/admin/mods/[id] — تعديل تعريب
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params
    const body = await req.json()

    // التأكد إن التعريب موجود
    const existing = await db.mod.findUnique({
      where: { id },
      select: {
        authorId: true,
        seriesId: true,
        teamId: true,
        slug: true,
        name: true,
        gameId: true,
      },
    })
    if (!existing) {
      return notFound()
    }

    // التحقق من الصلاحية
    if (!canEditMod(user, existing)) {
      return forbidden('You can only edit your own mods')
    }

    // تتبّع تغيير seriesId/teamId لمزامنة العدّادات
    const oldSeriesId = existing.seriesId
    const oldTeamId = existing.teamId

    // تحديث الحقول الأساسية
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'name',
      'headline',
      'summary',
      'description',
      'changelog',
      'installGuide',
      'arabicTitle',
      'translationScope',
      'compatibility',
      'categoryId',
      'thumbnailUrl',
      'imageUrl',
      'galleryUrls',
      'version',
      'fileSize',
      'fileFormat',
      'tags',
      'series',
      'seriesId',
      'translationTeam',
      'teamId',
      'sectionId',
      'translationType',
      'isOriginalWork',
      'originalSource',
      'originalAuthor',
      'extrasLabel',
      'releaseDate',
      'scheduledAt',
      'publishMode',
    ]
    const VALID_PUBLISH_MODES = ['site_only', 'social_only', 'both']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'releaseDate') {
          updateData[field] = body[field] ? new Date(body[field]) : new Date()
        } else if (field === 'scheduledAt') {
          updateData[field] = body[field] ? new Date(body[field]) : null
        } else if (field === 'publishMode') {
          if (!VALID_PUBLISH_MODES.includes(body[field] as string)) {
            const msg = 'وضعية نشر غير معروفة — site_only أو social_only أو both'
            return fail(
              'VALIDATION_ERROR',
              msg,
              422,
              { publishMode: msg },
              undefined,
              req.nextUrl.pathname,
            )
          }
          updateData[field] = body[field]
        } else if (field === 'isOriginalWork') {
          updateData[field] = Boolean(body[field])
        } else if (field === 'tags' && Array.isArray(body.tags)) {
          updateData[field] = body.tags.join(',')
        } else if (field === 'galleryUrls') {
          updateData[field] = Array.isArray(body.galleryUrls)
            ? body.galleryUrls.join(',')
            : body.galleryUrls
        } else {
          updateData[field] = body[field]
        }
      }
    }

    // slug لو اتعدّل
    if (body.slug && body.slug !== existing.slug) {
      updateData.slug = slugify(body.slug)
    }

    // إعادة حساب درجة الجودة
    const scoreData = {
      name: body.name || existing.name || '',
      summary: body.summary || '',
      description: body.description || '',
      arabicTitle: body.arabicTitle || '',
      translationScope: body.translationScope || '',
      compatibility: body.compatibility || '',
      tags: Array.isArray(body.tags) ? body.tags.join(',') : body.tags || '',
      changelog: body.changelog || '',
      installGuide: body.installGuide || '',
      thumbnailUrl: body.thumbnailUrl || '',
      imageUrl: body.imageUrl || '',
      galleryUrls: Array.isArray(body.galleryUrls)
        ? body.galleryUrls.join(',')
        : body.galleryUrls || '',
      files: body.files || [],
      teamMembers: body.teamMembers || [],
      gameId: body.gameId || '',
      teamId: body.teamId || null,
    }
    updateData.qualityScore = calculateModQualityScore(scoreData)

    await db.$transaction(async (tx) => {
      await tx.mod.update({ where: { id }, data: updateData })

      // ===== تحديث الـ relations =====

      // ملفات التحميل — bulk insert via createMany
      if (Array.isArray(body.files)) {
        await tx.modFile.deleteMany({ where: { modId: id } })
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
            modId: id,
            title: f.title as string,
            description: f.description || null,
            alert: f.alert || null,
            version: f.version || body.version || '1.0.0',
            releaseDate: f.releaseDate ? new Date(f.releaseDate) : new Date(),
            fileSize: f.fileSize || body.fileSize || 'MB 0',
            fileFormat: f.fileFormat || body.fileFormat || 'zip',
            order: f.order ?? i,
          }))
          // Use createManyAndReturn to get IDs for nested links
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
            provider: string
            storageKey: string | null
            uploadedBy: string | null
          }> = []
          validFiles.forEach((f, idx) => {
            const fileId = createdFiles[idx]?.id
            if (!fileId || !Array.isArray(f.links)) return
            f.links.forEach((l, j) => {
              if (!l.url) return
              // Provenance (P1): IA download URLs keep provider + storage key.
              const ia = parseIaUrl(l.url)
              allLinks.push({
                fileId,
                url: l.url,
                label: l.label || null,
                order: j,
                provider: ia ? 'ia' : 'direct',
                storageKey: ia ? `${ia.identifier}/${ia.key}` : null,
                uploadedBy: ia ? user.id : null,
              })
            })
          })
          if (allLinks.length > 0) {
            await tx.modFileLink.createMany({ data: allLinks })
          }
          // روابط المواقع (siteLinks) — nested per file
          const allSiteLinks: Array<{
            modId: string
            fileId: string
            url: string
            siteName: string | null
            pageTitle: string | null
            domain: string | null
            order: number
          }> = []
          validFiles.forEach((f, idx) => {
            const fileId = createdFiles[idx]?.id
            if (!fileId || !Array.isArray((f as any).siteLinks)) return
            ;(f as any).siteLinks.forEach((sl: any, j: number) => {
              if (!sl?.url) return
              allSiteLinks.push({
                modId: id,
                fileId,
                url: sl.url,
                siteName: sl.siteName || null,
                pageTitle: sl.pageTitle || null,
                domain: sl.domain || null,
                order: sl.order ?? j,
              })
            })
          })
          // Replace all file-level siteLinks for this mod (preserve external fileId:null ones).
          await tx.modSiteLink.deleteMany({ where: { modId: id, fileId: { not: null } } })
          if (allSiteLinks.length > 0) {
            await tx.modSiteLink.createMany({ data: allSiteLinks })
          }
        }
      }

      // أعضاء الفريق — bulk insert
      if (Array.isArray(body.teamMembers)) {
        await tx.modTeamMember.deleteMany({ where: { modId: id } })
        const membersData = body.teamMembers
          .map(
            (
              m: {
                name: string
                avatarUrl?: string
                role?: string
                contribution?: string
                order?: number
              },
              i: number,
            ) =>
              m.name
                ? {
                    modId: id,
                    name: m.name,
                    avatarUrl: m.avatarUrl || null,
                    role: m.role || 'مترجم',
                    contribution: m.contribution || null,
                    order: m.order ?? i,
                  }
                : null,
          )
          .filter(Boolean) as {
          modId: string
          name: string
          avatarUrl: string | null
          role: string
          contribution: string | null
          order: number
        }[]
        if (membersData.length > 0) {
          await tx.modTeamMember.createMany({ data: membersData })
        }
      }

      // روابط التواصل — bulk insert
      if (Array.isArray(body.contactLinks)) {
        await tx.modContactLink.deleteMany({ where: { modId: id } })
        const linksData = body.contactLinks
          .map((c: { url: string; type?: string; label?: string; order?: number }, i: number) =>
            c.url
              ? {
                  modId: id,
                  type: c.type || 'website',
                  label: c.label || '',
                  url: c.url,
                  order: c.order ?? i,
                }
              : null,
          )
          .filter(Boolean) as {
          modId: string
          type: string
          label: string
          url: string
          order: number
        }[]
        if (linksData.length > 0) {
          await tx.modContactLink.createMany({ data: linksData })
        }
      }

      // أقسام الفيديوهات — bulk insert
      if (Array.isArray(body.videoGroups)) {
        await tx.modVideoGroup.deleteMany({ where: { modId: id } })
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
            modId: id,
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

      // التبويبات المخصصة — bulk insert
      if (Array.isArray(body.customTabs)) {
        await tx.modCustomTab.deleteMany({ where: { modId: id } })
        const tabsData = body.customTabs
          .map(
            (
              t: {
                name: string
                slug?: string
                content?: string
                order?: number
                visible?: boolean
              },
              i: number,
            ) =>
              t.name
                ? {
                    modId: id,
                    name: t.name,
                    slug: t.slug || slugify(t.name),
                    content: t.content || '',
                    order: t.order ?? i,
                    visible: t.visible !== undefined ? Boolean(t.visible) : true,
                  }
                : null,
          )
          .filter(Boolean) as {
          modId: string
          name: string
          slug: string
          content: string
          order: number
          visible: boolean
        }[]
        if (tabsData.length > 0) {
          await tx.modCustomTab.createMany({ data: tabsData })
        }
      }
    })

    // مزامنة عدّادات السلسلة/الفريق لو تغيّرت
    const newSeriesId = body.seriesId !== undefined ? body.seriesId || null : oldSeriesId
    const newTeamId = body.teamId !== undefined ? body.teamId || null : oldTeamId
    if (newSeriesId !== oldSeriesId) {
      if (oldSeriesId) await syncSeriesCounts(oldSeriesId).catch(() => {})
      if (newSeriesId) await syncSeriesCounts(newSeriesId).catch(() => {})
    }
    if (newTeamId !== oldTeamId) {
      if (oldTeamId) await syncTeamCounts(oldTeamId).catch(() => {})
      if (newTeamId) await syncTeamCounts(newTeamId).catch(() => {})
    }

    // عدّادات اللعبة (totalDownloads/totalEndorsements/modCount) — تُحسب من
    // mods اللعبة المنشورة. تُزامَن عند تغيّر اللعبة نفسها أو حالة النشر.
    const newGameId = body.gameId !== undefined ? body.gameId || existing.gameId : existing.gameId
    if (newGameId && newGameId !== existing.gameId) {
      if (existing.gameId) await syncGameCounts(existing.gameId).catch(() => {})
      await syncGameCounts(newGameId).catch(() => {})
    }

    // Listing cache: edits may change PUBLISHED card fields (best-effort).
    if (existing.gameId) invalidateGameModsCache(existing.gameId).catch(() => {})

    // ISR: revalidate public pages after mod update
    try {
      revalidatePath('/')
      const updatedMod = await db.mod.findUnique({
        where: { id },
        select: { slug: true, gameId: true },
      })
      if (updatedMod) {
        if (updatedMod.gameId) {
          const game = await db.game.findUnique({
            where: { id: updatedMod.gameId },
            select: { slug: true, platform: true },
          })
          if (game) {
            revalidatePath('/platform/' + game.platform)
            revalidatePath('/games/' + game.slug)
          }
        }
        revalidatePath('/mod/' + updatedMod.slug)
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort ISR revalidation
    }

    return ok({ success: true })
  } catch (err) {
    logger.error('[admin/mods/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed to update mod')
  }
}

// DELETE /api/admin/mods/[id] — حذف تعريب (admin/owner فقط)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params

    if (!canDelete(user)) {
      return forbidden('Only admins can delete mods')
    }

    const existing = await db.mod.findUnique({
      where: { id },
      select: { id: true, seriesId: true, teamId: true, gameId: true },
    })
    if (!existing) {
      return notFound()
    }

    const { seriesId, teamId, gameId } = existing

    // Snapshot any reports targeting this mod before SetNull clears the FK.
    await db.$transaction(async (tx) => {
      await snapshotReportsForTarget({ modId: id }, tx)
      await tx.mod.delete({ where: { id } })
    })

    // مزامنة عدّادات السلسلة/الفريق/اللعبة بعد الحذف
    if (seriesId) await syncSeriesCounts(seriesId).catch(() => {})
    if (teamId) await syncTeamCounts(teamId).catch(() => {})
    if (gameId) await syncGameCounts(gameId).catch(() => {})
    // Listing cache: the deleted mod may have been PUBLISHED (best-effort).
    if (gameId) invalidateGameModsCache(gameId).catch(() => {})

    return ok({ success: true })
  } catch (err) {
    logger.error('[admin/mods/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed to delete mod')
  }
}
