import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { clearHomeCache } from '@/lib/home-cache'

interface RouteParams {
  params: Promise<{ id: string }>
}

const MAX_ACTIVE_MAIN_SECTIONS = 7

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params
    const body = await req.json()

    const existing = await db.section.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return notFound('القسم غير موجود')
    }

    // Check max active sections if toggling isActive
    if (body.isActive === true) {
      const activeCount = await db.section.count({ where: { isActive: true, id: { not: id } } })
      if (activeCount >= MAX_ACTIVE_MAIN_SECTIONS) {
        return validationFail({
          isActive: `لا يمكن تجاوز ${MAX_ACTIVE_MAIN_SECTIONS} أقسام نشطة`,
        })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.nameEn !== undefined) updateData.nameEn = body.nameEn
    if (body.key !== undefined) updateData.key = body.key
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.color !== undefined) updateData.color = body.color
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)

    // Handle order change with shifting inside transaction
    if (body.order !== undefined) {
      const newOrder = Number(body.order)
      const current = await db.section.findUnique({ where: { id }, select: { order: true } })
      if (current && current.order !== newOrder) {
        await db.$transaction(async (tx) => {
          if (newOrder < current.order) {
            // Moving up: shift sections between newOrder and current.order-1 up by 1
            await tx.section.updateMany({
              where: { order: { gte: newOrder, lt: current.order }, id: { not: id } },
              data: { order: { increment: 1 } },
            })
          } else {
            // Moving down: shift sections between current.order+1 and newOrder down by 1
            await tx.section.updateMany({
              where: { order: { gt: current.order, lte: newOrder }, id: { not: id } },
              data: { order: { decrement: 1 } },
            })
          }
          await tx.section.update({ where: { id }, data: { order: newOrder, ...updateData } })
        })
        clearHomeCache()
        return ok({ success: true })
      } else {
        updateData.order = newOrder
      }
    }

    await db.section.update({ where: { id }, data: updateData })
    clearHomeCache()

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/sections/[id] PUT] failed:', err)
    const message = (err as Error).message || 'Failed'
    if (message.includes('Unique constraint')) {
      return validationFail({ key: 'هذا المفتاح موجود مسبقاً' })
    }
    return internalError('Failed')
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const existing = await db.section.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { mods: true } } },
    })
    if (!existing) {
      return notFound('القسم غير موجود')
    }

    if (existing._count.mods > 0) {
      return validationFail({
        mods: `لا يمكن حذف القسم "${existing.name}" — يوجد ${existing._count.mods} تعريب مرتبط`,
      })
    }

    await db.section.delete({ where: { id } })
    clearHomeCache()

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/sections/[id] DELETE] failed:', err)
    return internalError('Failed')
  }
}
