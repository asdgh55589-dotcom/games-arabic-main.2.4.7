import type { NextRequest } from 'next/server'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { hasRoleAtLeast } from '@/lib/roles'

interface ChangelogBody {
  type?: string
  title?: string
  description?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  const { id } = await params
  const body = (await req.json()) as ChangelogBody

  const type = body.type || 'edit'
  const title = body.title?.trim()
  const description = body.description?.trim() || ''

  if (!title) {
    return validationFail('عنوان التغيير مطلوب')
  }

  if (!['release', 'update', 'edit'].includes(type)) {
    return validationFail('نوع التغيير غير صالح')
  }

  // Verify the mod exists and user has access
  const mod = await db.mod.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  })

  if (!mod) {
    return validationFail('التعريب غير موجود')
  }

  // Allow admin/manager/owner to create changelog for any mod
  const isAdmin = ['admin', 'manager', 'owner'].includes(user.role)
  if (mod.authorId !== user.id && !isAdmin) {
    return forbidden('ليس لديك صلاحية لتعديل هذا التعريب')
  }

  const changelog = await db.modChangelog.create({
    data: {
      modId: id,
      type,
      title,
      description,
      changedById: user.id,
      changedByRole: user.role,
    },
  })

  return ok({ data: changelog }, { status: 201 })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth-gated: no anonymous enumeration of any mod's changelog history.
  // Owner and staff (moderator+) may list; everyone else gets 403 — even for
  // PUBLISHED mods, whose visible changelog already ships inside GET /api/mods/[slug].
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const { id } = await params

  const mod = await db.mod.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  })
  if (!mod) {
    return notFound('التعريب غير موجود')
  }

  const isOwner = mod.authorId === user.id
  const isStaff = hasRoleAtLeast(user.role, 'moderator')
  if (!isOwner && !isStaff) {
    return forbidden('ليس لديك صلاحية لعرض سجل تغييرات هذا التعريب')
  }

  const changelogs = await db.modChangelog.findMany({
    where: { modId: id },
    include: {
      changedBy: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok({ data: changelogs })
}
