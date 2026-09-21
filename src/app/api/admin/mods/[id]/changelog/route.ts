import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

interface ChangelogBody {
  type?: string
  title?: string
  description?: string
}

// POST /api/admin/mods/[id]/changelog — سجل تغيير عند تعديل تعريب (مرآة creator)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireModerator()
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

    const mod = await db.mod.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!mod) {
      return validationFail('التعريب غير موجود')
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
  } catch (err) {
    console.error('[admin/mods/[id]/changelog POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to save changelog')
  }
}
