import { NextRequest } from 'next/server'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, validationFail, notFound, forbidden, internalError } from '@/lib/api-response'
import { CreateModSchema } from '@/lib/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const { id } = await params
    const mod = await db.mod.findUnique({ where: { id } })
    if (!mod) return notFound('التعريب غير موجود')

    const isAdmin = ['admin', 'manager', 'owner'].includes(user.role)
    if (mod.authorId !== user.id && !isAdmin) {
      return forbidden('لا تملك صلاحية تعديل هذا التعريب')
    }

    const body = await req.json()
    const { action, ...modData } = body as { action?: string; [key: string]: unknown }

    const parsed = CreateModSchema.partial().safeParse(modData)
    if (!parsed.success) {
      return validationFail('بيانات غير صالحة')
    }

    let workflowStatus = mod.workflowStatus
    if (action === 'submit' && mod.workflowStatus === 'DRAFT') {
      workflowStatus = 'IN_REVIEW'
    } else if (action === 'draft' && mod.workflowStatus === 'IN_REVIEW') {
      // Allow reverting to draft? Not in spec, but keep simple
      workflowStatus = mod.workflowStatus
    }

    const data = parsed.data as Record<string, unknown>
    // Handle galleryUrls/tags arrays
    if (Array.isArray(data.galleryUrls)) {
      data.galleryUrls = (data.galleryUrls as string[]).join(',')
    }
    if (Array.isArray(data.tags)) {
      data.tags = (data.tags as string[]).join(',')
    }

    const updated = await db.mod.update({
      where: { id },
      data: {
        ...data,
        workflowStatus,
        ...(action === 'submit' && mod.workflowStatus === 'DRAFT' ? { submittedAt: new Date() } : {}),
      },
    })

    return ok({ mod: updated, message: 'تم تحديث التعريب بنجاح' })
  } catch (err) {
    console.error('[creator/mods PATCH] failed:', err)
    return internalError('فشل تحديث التعريب')
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const { id } = await params
    const mod = await db.mod.findUnique({
      where: { id },
      include: { game: true, author: true },
    })
    if (!mod) return notFound('التعريب غير موجود')

    const isAdmin = ['admin', 'manager', 'owner'].includes(user.role)
    if (mod.authorId !== user.id && !isAdmin) {
      return forbidden('لا تملك صلاحية عرض هذا التعريب')
    }

    return ok(mod)
  } catch (err) {
    console.error('[creator/mods GET] failed:', err)
    return internalError('فشل جلب التعريب')
  }
}
