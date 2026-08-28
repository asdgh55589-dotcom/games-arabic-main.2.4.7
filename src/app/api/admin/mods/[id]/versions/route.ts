import { NextRequest } from 'next/server'
import { ok, validationFail, notFound, internalError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/mods/[id]/versions — جلب جميع إصدارات التعريب
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    const mod = await db.mod.findUnique({ where: { id }, select: { id: true } })
    if (!mod) return notFound()

    const versions = await db.modVersion.findMany({
      where: { modId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { files: true } },
      },
    })

    return ok(versions)
  } catch (err) {
    console.error('[admin/mods/[id]/versions GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to fetch versions')
  }
}

// POST /api/admin/mods/[id]/versions — إنشاء إصدار جديد
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params
    const body = await req.json()

    const { changelog, version: requestedVersion } = body as {
      changelog?: string
      version?: string
    }

    // جلب التعريب الحالي
    const mod = await db.mod.findUnique({
      where: { id },
      select: {
        id: true,
        version: true,
        name: true,
        files: true,
      },
    })
    if (!mod) return notFound()

    // توليد رقم الإصدار
    let newVersion = requestedVersion
    if (!newVersion) {
      // تلقائي: آخر رقم + patch
      const parts = mod.version.split('.')
      const patch = parseInt(parts[2] || '0', 10) + 1
      newVersion = `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`
    }

    // التأكد إن الإصدار غير مكرر
    const existing = await db.modVersion.findFirst({
      where: { modId: id, version: newVersion },
    })
    if (existing) {
      return validationFail({ version: `Version ${newVersion} already exists` })
    }

    // إنشاء الإصدار + تحديث التعريب في transaction
    const created = await db.$transaction(async (tx) => {
      // إنشاء سجل الإصدار
      const versionRecord = await tx.modVersion.create({
        data: {
          modId: id,
          version: newVersion,
          changelog: changelog || '',
          createdBy: user.id,
        },
      })

      // ربط ملفات التعريب الحالية بالإصدار الجديد (نسخ)
      if (mod.files.length > 0) {
        await tx.modFile.updateMany({
          where: { modId: id },
          data: { versionId: versionRecord.id },
        })
      }

      // تحديث رقم إصدار التعريب
      await tx.mod.update({
        where: { id },
        data: {
          version: newVersion,
          isLatestVersion: true,
        },
      })

      // تعطيل isLatestVersion للإصدارات القديمة
      await tx.modVersion.updateMany({
        where: {
          modId: id,
          id: { not: versionRecord.id },
        },
        data: {},
      })

      return versionRecord
    })

    return ok(created)
  } catch (err) {
    console.error('[admin/mods/[id]/versions POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to create version')
  }
}

// DELETE /api/admin/mods/[id]/versions?id=xxx — حذف إصدار
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const versionId = searchParams.get('id')

    if (!versionId) {
      return validationFail({ id: 'version id is required' })
    }

    // التأكد إن الإصدار موجود ومرتبط بالتعريب
    const version = await db.modVersion.findFirst({
      where: { id: versionId, modId: id },
    })
    if (!version) return notFound()

    // حذف الإصدار
    await db.modVersion.delete({ where: { id: versionId } })

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/mods/[id]/versions DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to delete version')
  }
}
