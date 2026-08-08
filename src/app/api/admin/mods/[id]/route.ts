import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, canEditMod, canDelete } from '@/lib/auth'
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
        author: { select: { id: true, username: true, avatarUrl: true } },
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
      },
    })

    if (!mod) {
      return NextResponse.json({ error: 'Mod not found' }, { status: 404 })
    }

    return NextResponse.json({ mod })
  } catch (err) {
    console.error('[admin/mods/[id] GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// PUT /api/admin/mods/[id] — تعديل تعريب
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params
    const body = await req.json()

    // التأكد إن التعريب موجود
    const existing = await db.mod.findUnique({ where: { id }, select: { authorId: true, seriesId: true, teamId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Mod not found' }, { status: 404 })
    }

    // التحقق من الصلاحية
    if (!canEditMod(user, existing)) {
      return NextResponse.json(
        { error: 'Forbidden — you can only edit your own mods' },
        { status: 403 }
      )
    }

    // تتبّع تغيير seriesId/teamId لمزامنة العدّادات
    const oldSeriesId = existing.seriesId
    const oldTeamId = existing.teamId

    // تحديث الحقول الأساسية
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'name', 'summary', 'description', 'changelog', 'installGuide', 'arabicTitle', 'compatibility',
      'categoryId', 'thumbnailUrl', 'imageUrl', 'galleryUrls', 'version', 'fileSize', 'fileFormat',
      'tags', 'series', 'seriesId', 'translationTeam', 'teamId', 'translationType',
      'isFeatured', 'isTrending', 'isLatest', 'releaseDate',
    ]
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'releaseDate') {
          updateData[field] = body[field] ? new Date(body[field]) : new Date()
        } else if (['isFeatured', 'isTrending', 'isLatest'].includes(field)) {
          updateData[field] = Boolean(body[field])
        } else if (field === 'tags' && Array.isArray(body.tags)) {
          updateData[field] = body.tags.join(',')
        } else if (field === 'galleryUrls') {
          updateData[field] = Array.isArray(body.galleryUrls) ? body.galleryUrls.join(',') : body.galleryUrls
        } else {
          updateData[field] = body[field]
        }
      }
    }

    // slug لو اتعدّل
    if (body.slug && body.slug !== existing.slug) {
      updateData.slug = slugify(body.slug)
    }

    await db.$transaction(async (tx) => {
      await tx.mod.update({ where: { id }, data: updateData })

      // ===== تحديث الـ relations =====

      // ملفات التحميل — امسح القديمة وأنشئ الجديدة
      if (Array.isArray(body.files)) {
        await tx.modFile.deleteMany({ where: { modId: id } })
        for (let i = 0; i < body.files.length; i++) {
          const f = body.files[i]
          if (!f.title) continue
          await tx.modFile.create({
            data: {
              modId: id,
              title: f.title,
              description: f.description || null,
              alert: f.alert || null,
              version: f.version || body.version || '1.0.0',
              releaseDate: f.releaseDate ? new Date(f.releaseDate) : new Date(),
              fileSize: f.fileSize || body.fileSize || 'MB 0',
              fileFormat: f.fileFormat || body.fileFormat || 'zip',
              order: f.order ?? i,
              links: {
                create: Array.isArray(f.links)
                  ? f.links.map((l: { url: string; label?: string }, j: number) => ({
                      url: l.url,
                      label: l.label || null,
                      order: j,
                    }))
                  : [],
              },
            },
          })
        }
      }

      // أعضاء الفريق
      if (Array.isArray(body.teamMembers)) {
        await tx.modTeamMember.deleteMany({ where: { modId: id } })
        for (let i = 0; i < body.teamMembers.length; i++) {
          const m = body.teamMembers[i]
          if (!m.name) continue
          await tx.modTeamMember.create({
            data: {
              modId: id,
              name: m.name,
              avatarUrl: m.avatarUrl || null,
              role: m.role || 'مترجم',
              contribution: m.contribution || null,
              order: m.order ?? i,
            },
          })
        }
      }

      // روابط التواصل
      if (Array.isArray(body.contactLinks)) {
        await tx.modContactLink.deleteMany({ where: { modId: id } })
        for (let i = 0; i < body.contactLinks.length; i++) {
          const c = body.contactLinks[i]
          if (!c.url) continue
          await tx.modContactLink.create({
            data: {
              modId: id,
              type: c.type || 'website',
              label: c.label || '',
              url: c.url,
              order: c.order ?? i,
            },
          })
        }
      }

      // أقسام الفيديوهات
      if (Array.isArray(body.videoGroups)) {
        await tx.modVideoGroup.deleteMany({ where: { modId: id } })
        for (let i = 0; i < body.videoGroups.length; i++) {
          const g = body.videoGroups[i]
          if (!g.name) continue
          const group = await tx.modVideoGroup.create({
            data: {
              modId: id,
              name: g.name,
              order: g.order ?? i,
            },
          })
          if (Array.isArray(g.videos)) {
            for (let j = 0; j < g.videos.length; j++) {
              const v = g.videos[j]
              if (!v.title || !v.url) continue
              await tx.modVideo.create({
                data: {
                  groupId: group.id,
                  title: v.title,
                  url: v.url,
                  thumbnail: v.thumbnail || null,
                  duration: v.duration || null,
                  description: v.description || null,
                  views: v.views || 0,
                  likes: v.likes || 0,
                  commentsCount: v.commentsCount || 0,
                  channel: v.channel || null,
                  order: v.order ?? j,
                },
              })
            }
          }
        }
      }

      // التبويبات المخصصة
      if (Array.isArray(body.customTabs)) {
        await tx.modCustomTab.deleteMany({ where: { modId: id } })
        for (let i = 0; i < body.customTabs.length; i++) {
          const t = body.customTabs[i]
          if (!t.name) continue
          const tabSlug = t.slug || slugify(t.name)
          await tx.modCustomTab.create({
            data: {
              modId: id,
              name: t.name,
              slug: tabSlug,
              content: t.content || '',
              order: t.order ?? i,
              visible: t.visible !== undefined ? Boolean(t.visible) : true,
            },
          })
        }
      }
    })

    // مزامنة عدّادات السلسلة/الفريق لو تغيّرت
    const newSeriesId = body.seriesId !== undefined ? (body.seriesId || null) : oldSeriesId
    const newTeamId = body.teamId !== undefined ? (body.teamId || null) : oldTeamId
    if (newSeriesId !== oldSeriesId) {
      if (oldSeriesId) await syncSeriesCounts(oldSeriesId).catch(() => {})
      if (newSeriesId) await syncSeriesCounts(newSeriesId).catch(() => {})
    }
    if (newTeamId !== oldTeamId) {
      if (oldTeamId) await syncTeamCounts(oldTeamId).catch(() => {})
      if (newTeamId) await syncTeamCounts(newTeamId).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/mods/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to update mod' }, { status })
  }
}

// DELETE /api/admin/mods/[id] — حذف تعريب (admin/owner فقط)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params

    if (!canDelete(user)) {
      return NextResponse.json(
        { error: 'Forbidden — only admins can delete mods' },
        { status: 403 }
      )
    }

    const existing = await db.mod.findUnique({ where: { id }, select: { id: true, seriesId: true, teamId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Mod not found' }, { status: 404 })
    }

    const { seriesId, teamId } = existing

    // cascading deletes هتمسح كل الـ relations تلقائياً
    await db.mod.delete({ where: { id } })

    // مزامنة عدّادات السلسلة/الفريق بعد الحذف
    if (seriesId) await syncSeriesCounts(seriesId).catch(() => {})
    if (teamId) await syncTeamCounts(teamId).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/mods/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to delete mod' }, { status })
  }
}
