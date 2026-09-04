import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { syncTeamCounts } from '@/lib/team-helpers'
import { ok, notFound, validationFail, internalError } from '@/lib/api-response'

// PUT /api/admin/teams/[id]/mods — ربط/فصل تعريبة
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const team = await db.team.findUnique({ where: { id } })
    if (!team) {
      return notFound('الفريق غير موجود')
    }

    if (body.linkModId) {
      const mod = await db.mod.findUnique({ where: { id: body.linkModId } })
      if (!mod) {
        return notFound('التعريبة غير موجودة')
      }
      const prevTeamId = mod.teamId
      await db.mod.update({ where: { id: body.linkModId }, data: { teamId: id } })
      await syncTeamCounts(id)
      if (prevTeamId) await syncTeamCounts(prevTeamId)
    } else if (body.unlinkModId) {
      await db.mod.updateMany({
        where: { id: body.unlinkModId, teamId: id },
        data: { teamId: null },
      })
      await syncTeamCounts(id)
    } else {
      return validationFail({ message: 'linkModId أو unlinkModId مطلوب' })
    }

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/teams/[id]/mods PUT] failed:', err)
    return internalError('Failed')
  }
}
