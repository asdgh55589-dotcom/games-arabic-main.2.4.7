import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, canDelete } from '@/lib/auth'
import { slugify } from '@/lib/utils'
import { ok, forbidden, notFound, internalError } from '@/lib/api-response'

// GET /api/admin/teams/[id] — تفاصيل الفريق
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const team = await db.team.findUnique({
      where: { id },
      include: {
        memberships: { orderBy: { joinedAt: 'desc' } },
        contactLinks: { orderBy: { order: 'asc' } },
        customTabs: { orderBy: { order: 'asc' } },
        mods: {
          select: {
            id: true,
            name: true,
            slug: true,
            downloads: true,
            endorsements: true,
            thumbnailUrl: true,
          },
          orderBy: { downloads: 'desc' },
        },
        _count: { select: { mods: true, memberships: true, follows: true } },
      },
    })

    if (!team) {
      return notFound('الفريق غير موجود')
    }

    return ok(team)
  } catch (err) {
    console.error('[admin/teams/[id] GET] failed:', err)
    return internalError('Failed')
  }
}

// PUT /api/admin/teams/[id] — تعديل الفريق
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const existing = await db.team.findUnique({ where: { id } })
    if (!existing) {
      return notFound('الفريق غير موجود')
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      data.name = body.name.trim()
      data.slug = slugify(body.name)
    }
    if (body.description !== undefined) data.description = body.description
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl
    if (body.bannerUrl !== undefined) data.bannerUrl = body.bannerUrl
    if (body.websiteUrl !== undefined) data.websiteUrl = body.websiteUrl
    if (body.discordUrl !== undefined) data.discordUrl = body.discordUrl
    if (body.isOfficial !== undefined) data.isOfficial = body.isOfficial
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
    if (body.order !== undefined) data.order = body.order
    if (body.ownerId !== undefined) data.ownerId = body.ownerId || null
    if (body.hiddenTabs !== undefined) data.hiddenTabs = body.hiddenTabs

    if (Array.isArray(body.contactLinks)) {
      const website = body.contactLinks.find(
        (c: { type?: string; url?: string }) => c.type === 'website' && c.url,
      )
      const discord = body.contactLinks.find(
        (c: { type?: string; url?: string }) => c.type === 'discord' && c.url,
      )
      if (website) data.websiteUrl = website.url
      if (discord) data.discordUrl = discord.url

      await db.$transaction(async (tx) => {
        await tx.teamContactLink.deleteMany({ where: { teamId: id } })
        for (let i = 0; i < body.contactLinks.length; i++) {
          const c = body.contactLinks[i]
          if (!c.url) continue
          await tx.teamContactLink.create({
            data: {
              teamId: id,
              type: c.type || 'website',
              label: c.label || '',
              url: c.url,
              order: c.order ?? i,
            },
          })
        }
        await tx.team.update({ where: { id }, data })
      })
    } else {
      await db.team.update({ where: { id }, data })
    }

    // Handle customTabs separately
    if (Array.isArray(body.customTabs)) {
      await db.$transaction(async (tx) => {
        await tx.teamCustomTab.deleteMany({ where: { teamId: id } })
        for (let i = 0; i < body.customTabs.length; i++) {
          const t = body.customTabs[i]
          if (!t.title) continue
          await tx.teamCustomTab.create({
            data: {
              teamId: id,
              title: t.title,
              content: t.content || '',
              order: t.order ?? i,
              visible: t.visible !== undefined ? Boolean(t.visible) : true,
            },
          })
        }
      })
    }

    const team = await db.team.findUnique({
      where: { id },
      include: {
        memberships: { orderBy: { joinedAt: 'desc' } },
        contactLinks: { orderBy: { order: 'asc' } },
        customTabs: { orderBy: { order: 'asc' } },
        mods: {
          select: {
            id: true,
            name: true,
            slug: true,
            downloads: true,
            endorsements: true,
            thumbnailUrl: true,
          },
          orderBy: { downloads: 'desc' },
        },
        _count: { select: { mods: true, memberships: true, follows: true } },
      },
    })
    return ok(team)
  } catch (err) {
    console.error('[admin/teams/[id] PUT] failed:', err)
    return internalError('Failed')
  }
}

// DELETE /api/admin/teams/[id] — حذف الفريق
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireModerator()
    if (!canDelete(user)) {
      return forbidden('لا تملك صلاحية الحذف')
    }
    const { id } = await params

    const existing = await db.team.findUnique({ where: { id } })
    if (!existing) {
      return notFound('الفريق غير موجود')
    }

    // إلغاء الربط من التعريبات
    await db.mod.updateMany({ where: { teamId: id }, data: { teamId: null } })
    await db.team.delete({ where: { id } })
    return ok({ success: true })
  } catch (err) {
    console.error('[admin/teams/[id] DELETE] failed:', err)
    return internalError('Failed')
  }
}
