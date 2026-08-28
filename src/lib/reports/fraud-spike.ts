import { db } from '@/lib/db'

const SPIKE_THRESHOLD = 10 // 10 تقارير في ساعة واحدة = طفرة
const SPIKE_WINDOW_MS = 60 * 60 * 1000 // ساعة واحدة

export async function checkFraudSpike() {
  const oneHourAgo = new Date(Date.now() - SPIKE_WINDOW_MS)

  const recentCount = await db.report.count({
    where: { createdAt: { gte: oneHourAgo } },
  })

  if (recentCount >= SPIKE_THRESHOLD) {
    // تحقق هل أرسلنا تنبيهاً بالفعل خلال آخر ساعة (تجنب الإزعاج)
    const recentAlert = await db.notification.findFirst({
      where: {
        type: 'admin_report',
        title: { contains: 'ارتفاع مفاجئ' },
        createdAt: { gte: oneHourAgo },
      },
    })

    if (!recentAlert) {
      const admins = await db.user.findMany({
        where: { role: { in: ['admin', 'owner', 'manager'] } },
        select: { id: true },
        take: 10,
      })

      for (const admin of admins) {
        await db.notification.create({
          data: {
            userId: admin.id,
            type: 'admin_report',
            title: '🚨 ارتفاع مفاجئ في البلاغات',
            message: `تم رصد ${recentCount} بلاغ خلال آخر ساعة — قد يكون هجوماً منسقاً أو مخالفة كبيرة`,
          },
        })
      }

      console.log(`[FraudSpike] تم تنبيه المسؤولين: ${recentCount} بلاغ/ساعة`)
    }
  }
}
