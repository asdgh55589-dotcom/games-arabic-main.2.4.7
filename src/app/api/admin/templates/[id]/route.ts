import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireManager } from '@/lib/auth'
import { ok, notFound, validationFail, internalError } from '@/lib/api-response'
import { UpdateTemplateSchema } from '@/lib/schemas'
import Handlebars from 'handlebars/dist/cjs/handlebars.js'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params
    const body = await req.json()

    const existing = await db.notificationTemplate.findUnique({ where: { id } })
    if (!existing) {
      return notFound('القالب غير موجود')
    }

    const parsed = UpdateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const data = parsed.data

    // Validate Handlebars syntax if templates are being updated
    if (data.titleTemplate) {
      try {
        Handlebars.compile(data.titleTemplate)
      } catch (e) {
        return validationFail({ titleTemplate: `خطأ في صيغة القالب: ${(e as Error).message}` })
      }
    }
    if (data.bodyTemplate) {
      try {
        Handlebars.compile(data.bodyTemplate)
      } catch (e) {
        return validationFail({ bodyTemplate: `خطأ في صيغة القالب: ${(e as Error).message}` })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.type !== undefined) updateData.type = data.type
    if (data.channel !== undefined) updateData.channel = data.channel
    if (data.titleTemplate !== undefined) updateData.titleTemplate = data.titleTemplate
    if (data.bodyTemplate !== undefined) updateData.bodyTemplate = data.bodyTemplate
    if (data.variables !== undefined) updateData.variables = data.variables
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    // Increment version on any change
    updateData.version = existing.version + 1

    const updated = await db.notificationTemplate.update({
      where: { id },
      data: updateData,
    })

    return ok(updated)
  } catch (err) {
    console.error('[admin/templates/[id] PUT] failed:', err)
    const message = (err as Error).message || 'Failed'
    if (message.includes('Unique constraint')) {
      return validationFail({ type: 'يوجد قالب نشط لنفس النوع والقناة' })
    }
    return internalError('Failed to update template')
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const existing = await db.notificationTemplate.findUnique({ where: { id } })
    if (!existing) {
      return notFound('القالب غير موجود')
    }

    // Check if this is the last active template for its type+channel
    const activeCount = await db.notificationTemplate.count({
      where: {
        type: existing.type,
        channel: existing.channel,
        isActive: true,
        id: { not: id },
      },
    })

    if (existing.isActive && activeCount === 0) {
      return validationFail({
        isActive: 'لا يمكن حذف آخر قالب نشط لهذا النوع والقناة',
      })
    }

    await db.notificationTemplate.delete({ where: { id } })

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/templates/[id] DELETE] failed:', err)
    return internalError('Failed to delete template')
  }
}
