import { db } from '@/lib/db'

/**
 * game-helpers.ts — صيانة عدّادات اللعبة (Game).
 *
 * Game.totalDownloads / Game.totalEndorsements / Game.modCount كانت تُزاد فقط
 * (بدون خصم) — أي أنها تنحرف للأعلى للأبد عند حذف/أرشفة أي mod.
 * هذه الوحدة تُعيد حسابها من المصدر الحقيقي: الـ mods المنشورة الخاصة باللعبة.
 *
 * القاعدة المعمّرة (C-SEMANTICS):
 *   Game.totalDownloads    == SUM(Mod.downloads)    over PUBLISHED mods
 *   Game.totalEndorsements == SUM(Mod.endorsements) over PUBLISHED mods
 *   Game.modCount          == COUNT(Mod)            over PUBLISHED mods
 *
 * ملاحظة: موديل Game لا يملك عمود views — لا يوجد ما يُزامَن منه.
 */

/** تجميع عدّادات اللعبة من modsها المنشورة. */
export async function computeGameTotals(gameId: string) {
  const agg = await db.mod.aggregate({
    where: { gameId, workflowStatus: 'PUBLISHED' },
    _sum: { downloads: true, endorsements: true },
    _count: true,
  })

  return {
    modCount: agg._count,
    totalDownloads: agg._sum.downloads || 0,
    totalEndorsements: agg._sum.endorsements || 0,
  }
}

/**
 * حدّث الأعداد المخزّنة للعبة (totalDownloads/totalEndorsements/modCount)
 * من modsها المنشورة. الاستدعاء آمن (best-effort) من مواقع الاستدعاء:
 * `syncGameCounts(id).catch(() => {})`.
 *
 * ملاحظة:Game لا يمتلك عمود views.
 */
export async function syncGameCounts(gameId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const agg = await tx.mod.aggregate({
      where: { gameId, workflowStatus: 'PUBLISHED' },
      _sum: { downloads: true, endorsements: true },
      _count: true,
    })

    await tx.game.update({
      where: { id: gameId },
      data: {
        modCount: agg._count,
        totalDownloads: agg._sum.downloads || 0,
        totalEndorsements: agg._sum.endorsements || 0,
      },
    })
  })
}
