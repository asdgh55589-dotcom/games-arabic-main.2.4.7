import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { slugify } from '@/lib/utils'
import { ok, conflict, validationFail, internalError } from '@/lib/api-response'

// GET /api/admin/teams — قائمة الفرق
export async function GET() {
  try {
    await requireModerator()
    const teams = await db.team.findMany({
      orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true, role: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        mods: { where: { workflowStatus: 'PUBLISHED' }, select: { id: true, downloads: true } },
        _count: { select: { mods: true, memberships: true, follows: true } },
      },
    })
    return ok(teams)
  } catch (err) {
    console.error('[admin/teams GET] failed:', err)
    return internalError('Failed')
  }
}

// POST /api/admin/teams — إنشاء فريق جديد
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    if (!body.name?.trim()) {
      return validationFail({ field: 'name', message: 'الاسم مطلوب' })
    }

    const slug = slugify(body.name)
    const existing = await db.team.findUnique({ where: { slug } })
    if (existing) {
      return conflict('فريق بنفس الاسم موجود بالفعل')
    }

    const team = await db.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          slug,
          name: body.name.trim(),
          description: body.description || '',
          logoUrl: body.logoUrl || '',
          bannerUrl: body.bannerUrl || '',
          websiteUrl: body.websiteUrl || '',
          discordUrl: body.discordUrl || '',
          isOfficial: body.isOfficial || false,
          isFeatured: body.isFeatured || false,
          order: body.order || 0,
        },
      })

      if (Array.isArray(body.contactLinks)) {
        for (let i = 0; i < body.contactLinks.length; i++) {
          const c = body.contactLinks[i]
          if (!c.url) continue
          await tx.teamContactLink.create({
            data: {
              teamId: created.id,
              type: c.type || 'website',
              label: c.label || '',
              url: c.url,
              order: c.order ?? i,
            },
          })
        }
      }

      return created
    })

    return ok(team)
  } catch (err) {
    console.error('[admin/teams POST] failed:', err)
    return internalError('Failed')
  }
}
