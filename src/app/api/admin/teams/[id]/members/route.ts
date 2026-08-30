import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, AuthError } from '@/lib/auth'
import { ok, validationFail, notFound, internalError, unauthorized, forbidden } from '@/lib/api-response'

// POST /api/admin/teams/[id]/members — إضافة عضو
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
  } catch (err) {
    if (err instanceof AuthError) {
      if ((err as AuthError).status === 401) return unauthorized('يجب تسجيل الدخول')
      if ((err as AuthError).status === 403) return forbidden('ليس لديك صلاحية لإضافة عضو')
    }
    return unauthorized('يجب تسجيل الدخول')
  }
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.name?.trim()) {
      return validationFail({ field: 'name', message: 'اسم العضو مطلوب' })
    }

    // تحقق من وجود المستخدم إذا تم تمرير userId (يجب أن يكون ربطاً عبر /link لكن نحمي من FK error)
    if (body.userId) {
      if (typeof body.userId !== 'string') {
        return validationFail({ field: 'userId', message: 'userId غير صالح' })
      }
      const targetUser = await db.user.findUnique({ where: { id: body.userId }, select: { id: true } })
      if (!targetUser) return notFound('المستخدم المستهدف غير موجود')
      // منع التكرار في نفس الفريق
      const existing = await db.teamMembership.findFirst({ where: { teamId: id, userId: body.userId } })
      if (existing) return validationFail({ field: 'userId', message: 'هذا الحساب مرتبط بالفعل بعضو آخر في نفس الفريق' })
    }

    const team = await db.team.findUnique({ where: { id } })
    if (!team) {
      return notFound('الفريق غير موجود')
    }

    const member = await db.teamMembership.create({
      data: {
        teamId: id,
        userId: body.userId || null,
        name: body.name.trim(),
        avatarUrl: body.avatarUrl || null,
        role: body.role || 'member',
        bio: body.bio || null,
      },
    })

    return ok(member)
  } catch (err) {
    console.error('[admin/teams/[id]/members POST] failed:', err)
    return internalError('Failed')
  }
}

// PUT /api/admin/teams/[id]/members — تعديل عضو
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
  } catch (err) {
    if (err instanceof AuthError) {
      if ((err as AuthError).status === 401) return unauthorized('يجب تسجيل الدخول')
      if ((err as AuthError).status === 403) return forbidden('ليس لديك صلاحية لتعديل عضو')
    }
    return unauthorized('يجب تسجيل الدخول')
  }
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.memberId) {
      return validationFail({ field: 'memberId', message: 'memberId مطلوب' })
    }

    const existing = await db.teamMembership.findFirst({ where: { id: body.memberId, teamId: id } })
    if (!existing) {
      return notFound('العضو غير موجود')
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        return validationFail({ field: 'name', message: 'اسم العضو مطلوب' })
      }
      data.name = body.name.trim()
    }
    if (body.role !== undefined) data.role = body.role
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl || null
    if (body.bio !== undefined) data.bio = body.bio || null
    // لا نلمس userId هنا — الربط يتم فقط عبر /link endpoint

    const member = await db.teamMembership.update({ where: { id: body.memberId }, data })
    return ok(member)
  } catch (err) {
    console.error('[admin/teams/[id]/members PUT] failed:', err)
    return internalError('Failed')
  }
}

// DELETE /api/admin/teams/[id]/members — حذف عضو
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
  } catch (err) {
    if (err instanceof AuthError) {
      if ((err as AuthError).status === 401) return unauthorized('يجب تسجيل الدخول')
      if ((err as AuthError).status === 403) return forbidden('ليس لديك صلاحية لحذف عضو')
    }
    return unauthorized('يجب تسجيل الدخول')
  }
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return validationFail({ field: 'memberId', message: 'memberId مطلوب' })
    }

    await db.teamMembership.deleteMany({
      where: { id: memberId, teamId: id },
    })

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/teams/[id]/members DELETE] failed:', err)
    return internalError('Failed')
  }
}
