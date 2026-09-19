import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { CreateModSchema } from '@/lib/schemas'
import { stripModRelations, syncModRelations } from '@/lib/mod-relations'
import { rateLimitMiddleware } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    // 10 edits/hour per creator.
    const limited = await rateLimitMiddleware(req, {
      limit: 10,
      window: 3600,
      keyPrefix: `creator:mod-edit:${user.id}`,
    })
    if (limited) return limited

    const { id } = await params
    const mod = await db.mod.findUnique({ where: { id } })
    if (!mod) return notFound('التعريب غير موجود')

    if (mod.authorId !== user.id) {
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
    // المصدر يُدار من الأدمن فقط: يُجبَر isOriginalWork من الدور،
    // وقيم المصدر المرسلة تُتجاهل — القيم الحالية محفوظة ولا تُمس
    data.isOriginalWork = user.role !== 'publisher'
    delete data.originalSource
    delete data.originalAuthor
    // التحقق من التصنيف والقسم عند إرسالهما
    if (typeof data.categoryId === 'string' && data.categoryId) {
      const exists = await db.category.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      })
      if (!exists) return validationFail('التصنيف المحدد غير موجود')
    }
    if (typeof data.sectionId === 'string' && data.sectionId) {
      const exists = await db.section.findUnique({
        where: { id: data.sectionId },
        select: { id: true },
      })
      if (!exists) return validationFail('القسم المحدد غير موجود')
    }
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
        // P3: strip relation arrays (persisted via syncModRelations below).
        ...stripModRelations(data),
        workflowStatus,
        ...(action === 'submit' && mod.workflowStatus === 'DRAFT'
          ? { submittedAt: new Date() }
          : {}),
      },
    })

    // P3: replace relations sent in the payload; absent keys stay untouched.
    try {
      await syncModRelations(db, id, data as unknown as Parameters<typeof syncModRelations>[2], {
        uploadedBy: user.id,
      })
    } catch (relErr) {
      console.error('[creator/mods PATCH] relations failed:', relErr)
    }

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

    if (mod.authorId !== user.id) {
      return forbidden('لا تملك صلاحية عرض هذا التعريب')
    }

    return ok(mod)
  } catch (err) {
    console.error('[creator/mods GET] failed:', err)
    return internalError('فشل جلب التعريب')
  }
}
