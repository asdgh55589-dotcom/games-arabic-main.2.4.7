import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireManager } from '@/lib/auth'
import { slugify } from '@/lib/utils'
import { ok, validationFail, internalError } from '@/lib/api-response'
import { clearHomeCache } from '@/lib/home-cache'

const MAX_ACTIVE_MAIN_SECTIONS = 7

export async function GET() {
  try {
    await requireManager()

    const sections = await db.section.findMany({
      take: 20,
      orderBy: { order: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        nameEn: true,
        key: true,
        icon: true,
        color: true,
        order: true,
        isActive: true,
        createdAt: true,
        _count: { select: { mods: true } },
      },
    })

    return ok(sections)
  } catch (err) {
    console.error('[admin/sections GET] failed:', err)
    return internalError('Failed')
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireManager()
    const body = await req.json()
    const { name, nameEn, key, icon, color, order, isActive } = body

    if (!name || !key) {
      return validationFail({ name: 'الاسم مطلوب', key: 'المفتاح مطلوب' })
    }

    // Check max active sections
    const activeCount = await db.section.count({ where: { isActive: true } })
    if (isActive !== false && activeCount >= MAX_ACTIVE_MAIN_SECTIONS) {
      return validationFail({
        isActive: `لا يمكن تجاوز ${MAX_ACTIVE_MAIN_SECTIONS} أقسام نشطة`,
      })
    }

    const slug = slugify(nameEn || name)

    // Handle ordering: if order is explicitly provided, shift existing sections
    const targetOrder = order !== undefined && order !== null ? Number(order) : activeCount

    const section = await db.$transaction(async (tx) => {
      if (order !== undefined && order !== null) {
        // Shift all sections with order >= targetOrder to make room
        await tx.section.updateMany({
          where: { order: { gte: targetOrder } },
          data: { order: { increment: 1 } },
        })
      }

      return tx.section.create({
        data: {
          slug,
          name,
          nameEn: nameEn || name,
          key,
          icon: icon || 'Monitor',
          color: color || '#6b7280',
          order: targetOrder,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        },
      })
    })

    clearHomeCache()

    return ok(section)
  } catch (err) {
    console.error('[admin/sections POST] failed:', err)
    const message = (err as Error).message || 'Failed'
    if (message.includes('Unique constraint')) {
      return validationFail({ key: 'هذا المفتاح موجود مسبقاً' })
    }
    return internalError('Failed')
  }
}
