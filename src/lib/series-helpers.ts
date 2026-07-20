import { db } from './db'

/** حدّث العدد المخزّن لسلسلة معينة */
export async function syncSeriesCounts(seriesId: string) {
  const agg = await db.mod.aggregate({
    where: { seriesId },
    _sum: { downloads: true, endorsements: true },
    _count: true,
  })

  await db.series.update({
    where: { id: seriesId },
    data: {
      modCount: agg._count,
      totalDownloads: agg._sum.downloads || 0,
      totalEndorsements: agg._sum.endorsements || 0,
    },
  })
}

/** جلب slug من الاسم (عربي/إنجليزي) */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
