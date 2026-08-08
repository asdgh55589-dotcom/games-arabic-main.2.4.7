import { db } from './db'
import { slugify } from './utils'

// re-export for backward compatibility
export { slugify }

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
