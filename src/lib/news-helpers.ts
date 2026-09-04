import { db } from './db'

/** جلب الأخبار النشطة (مرئية + منشورة + غير منتهية) */
export async function getActiveNews(options?: { type?: string; limit?: number }) {
  const where: Record<string, unknown> = {
    visible: true,
    publishAt: { lte: new Date() },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  }

  if (options?.type) {
    where.type = options.type
  }

  return db.news.findMany({
    where,
    orderBy: [{ isSticky: 'desc' }, { order: 'asc' }, { publishAt: 'desc' }],
    take: options?.limit || 20,
  })
}
