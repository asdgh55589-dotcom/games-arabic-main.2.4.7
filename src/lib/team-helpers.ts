import { db } from './db'

/** حدّث العدد المخزّن لفريق معين */
export async function syncTeamCounts(teamId: string) {
  const count = await db.mod.count({ where: { teamId } })
  await db.team.update({
    where: { id: teamId },
    data: { modCount: count },
  })
}
