import type { NextRequest } from 'next/server'
import { internalError, notFound, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { slugify } from '@/lib/utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/admin/mods/[id]/duplicate — نسخ تعريب
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const { copyFiles = true, customTitle } = body as {
      copyFiles?: boolean
      customTitle?: string
    }

    // جلب التعريب الأصلي بكل العلاقات
    const original = await db.mod.findUnique({
      where: { id },
      include: {
        files: { include: { links: true }, orderBy: { order: 'asc' } },
        teamMembers: { orderBy: { order: 'asc' } },
        contactLinks: { orderBy: { order: 'asc' } },
        videoGroups: {
          include: { videos: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        customTabs: { orderBy: { order: 'asc' } },
      },
    })

    if (!original) return notFound()

    // توليد slug فريد
    const baseSlug = slugify(original.name)
    const copySlug = `${baseSlug}-copy-${Date.now().toString(36)}`

    // إنشاء النسخة في transaction
    const duplicate = await db.$transaction(async (tx) => {
      const created = await tx.mod.create({
        data: {
          slug: copySlug,
          name: customTitle || `نسخة من: ${original.name}`,
          headline: original.headline,
          summary: original.summary,
          description: original.description,
          changelog: original.changelog,
          installGuide: original.installGuide,
          arabicTitle: original.arabicTitle,
          translationScope: original.translationScope,
          compatibility: original.compatibility,
          authorId: user.id,
          gameId: original.gameId,
          categoryId: original.categoryId,
          thumbnailUrl: original.thumbnailUrl,
          imageUrl: original.imageUrl,
          galleryUrls: original.galleryUrls,
          version: '1.0.0',
          fileSize: original.fileSize,
          fileFormat: original.fileFormat,
          tags: original.tags,
          series: original.series,
          seriesId: original.seriesId,
          translationTeam: original.translationTeam,
          teamId: original.teamId,
          sectionId: original.sectionId,
          translationType: original.translationType,
          workflowStatus: 'DRAFT',
        },
      })

      // نسخ الملفات
      if (copyFiles && original.files.length > 0) {
        for (const file of original.files) {
          const newFile = await tx.modFile.create({
            data: {
              modId: created.id,
              title: file.title,
              description: file.description,
              alert: file.alert,
              version: file.version,
              releaseDate: file.releaseDate,
              fileSize: file.fileSize,
              fileFormat: file.fileFormat,
              order: file.order,
            },
          })

          // نسخ روابط الملف
          if (file.links.length > 0) {
            await tx.modFileLink.createMany({
              data: file.links.map((l) => ({
                fileId: newFile.id,
                url: l.url,
                label: l.label,
                order: l.order,
              })),
            })
          }
        }
      }

      // نسخ أعضاء الفريق
      if (original.teamMembers.length > 0) {
        await tx.modTeamMember.createMany({
          data: original.teamMembers.map((m) => ({
            modId: created.id,
            name: m.name,
            avatarUrl: m.avatarUrl,
            role: m.role,
            contribution: m.contribution,
            order: m.order,
          })),
        })
      }

      // نسخ روابط التواصل
      if (original.contactLinks.length > 0) {
        await tx.modContactLink.createMany({
          data: original.contactLinks.map((c) => ({
            modId: created.id,
            type: c.type,
            label: c.label,
            url: c.url,
            order: c.order,
          })),
        })
      }

      // نسخ التبويبات المخصصة
      if (original.customTabs.length > 0) {
        await tx.modCustomTab.createMany({
          data: original.customTabs.map((t) => ({
            modId: created.id,
            name: t.name,
            slug: t.slug,
            content: t.content,
            order: t.order,
            visible: t.visible,
          })),
        })
      }

      return created
    })

    return ok(duplicate)
  } catch (err) {
    console.error('[admin/mods/[id]/duplicate POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed to duplicate mod')
  }
}
