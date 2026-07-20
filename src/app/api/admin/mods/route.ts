import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { parsePagination, pickSort } from '@/lib/api-utils'
import { syncSeriesCounts } from '@/lib/series-helpers'
import { syncTeamCounts } from '@/lib/team-helpers'
import { checkAndUpgradeTier } from '@/lib/tier-engine'

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
    const { page, limit } = parsePagination(
      searchParams.get('page'),
      searchParams.get('limit'),
      { limit: 24, maxLimit: 100 }
    )

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

    const [total, mods] = await Promise.all([
      db.mod.count({ where }),
      db.mod.findMany({
        where,
        orderBy: ORDER_BY[sort],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
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

    return NextResponse.json({
      mods,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[admin/mods GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to fetch mods' }, { status })
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
    const user = await requireModerator()
    const body = await req.json()

    // ===== التحقق من الحقول المطلوبة =====
    const required = ['name', 'summary', 'description', 'gameId', 'thumbnailUrl', 'imageUrl']
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `الحقل "${field}" مطلوب` },
          { status: 400 }
        )
      }
    }

    // توليد slug فريد
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    let slug = body.slug || slugify(body.name)
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
          name: body.name,
          summary: body.summary,
          description: body.description,
          changelog: body.changelog || '',
          installGuide: body.installGuide || '',
          arabicTitle: body.arabicTitle || '',
          compatibility: body.compatibility || '',
          authorId: user.id,
          gameId: body.gameId,
          categoryId: body.categoryId || null,
          thumbnailUrl: body.thumbnailUrl,
          imageUrl: body.imageUrl,
          galleryUrls: Array.isArray(body.galleryUrls) ? body.galleryUrls.join(',') : (body.galleryUrls || ''),
          version: body.version || '1.0.0',
          fileSize: body.fileSize || 'MB 0',
          fileFormat: body.fileFormat || 'zip',
          tags: Array.isArray(body.tags) ? body.tags.join(',') : (body.tags || ''),
          series: body.series || '',
          seriesId: body.seriesId || null,
          translationTeam: body.translationTeam || '',
          teamId: body.teamId || null,
          translationType: body.translationType || 'unofficial',
          isFeatured: Boolean(body.isFeatured),
          isTrending: Boolean(body.isTrending),
          isLatest: body.isLatest !== undefined ? Boolean(body.isLatest) : true,
          releaseDate: body.releaseDate ? new Date(body.releaseDate) : new Date(),
        },
      })

      // ملفات التحميل
      if (Array.isArray(body.files)) {
        for (let i = 0; i < body.files.length; i++) {
          const f = body.files[i]
          if (!f.title) continue
          await tx.modFile.create({
            data: {
              modId: created.id,
              title: f.title,
              description: f.description || null,
              alert: f.alert || null,
              version: f.version || body.version,
              releaseDate: f.releaseDate ? new Date(f.releaseDate) : new Date(),
              fileSize: f.fileSize || body.fileSize,
              fileFormat: f.fileFormat || body.fileFormat,
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
        for (let i = 0; i < body.teamMembers.length; i++) {
          const m = body.teamMembers[i]
          if (!m.name) continue
          await tx.modTeamMember.create({
            data: {
              modId: created.id,
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
        for (let i = 0; i < body.contactLinks.length; i++) {
          const c = body.contactLinks[i]
          if (!c.url) continue
          await tx.modContactLink.create({
            data: {
              modId: created.id,
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
        for (let i = 0; i < body.videoGroups.length; i++) {
          const g = body.videoGroups[i]
          if (!g.name) continue
          const group = await tx.modVideoGroup.create({
            data: {
              modId: created.id,
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
        for (let i = 0; i < body.customTabs.length; i++) {
          const t = body.customTabs[i]
          if (!t.name) continue
          const tabSlug = t.slug || slugify(t.name)
          await tx.modCustomTab.create({
            data: {
              modId: created.id,
              name: t.name,
              slug: tabSlug,
              content: t.content || '',
              order: t.order ?? i,
              visible: t.visible !== undefined ? Boolean(t.visible) : true,
            },
          })
        }
      }

      return created
    })

    // Check for tier upgrade
    checkAndUpgradeTier(mod.authorId).catch(console.error)

    // تحديث عدّادات السلسلة/الفريق/اللعبة بعد الإنشاء
    if (mod.seriesId) await syncSeriesCounts(mod.seriesId).catch(() => {})
    if (mod.teamId) await syncTeamCounts(mod.teamId).catch(() => {})

    return NextResponse.json({ mod }, { status: 201 })
  } catch (err) {
    console.error('[admin/mods POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to create mod' }, { status })
  }
}
