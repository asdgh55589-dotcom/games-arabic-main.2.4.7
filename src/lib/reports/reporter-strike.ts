import { db } from '@/lib/db'

// مستويات العقوبات للمُبلّغين الكيديين — يحاكي repeat-offender.ts
const STRIKE_LEVEL_1 = { rejected: 5, maxAccuracy: 0.3 } // تحذير
const STRIKE_LEVEL_2 = { rejected: 10, maxAccuracy: 0.3 } // تقييد 1 بلاغ/يوم

export async function checkReporterStrikes(reporterId: string) {
  if (!reporterId) return

  const trust = await db.userTrustScore.findUnique({
    where: { userId: reporterId },
  })

  if (!trust || trust.totalReports === 0) return

  const accuracy = trust.confirmedReports / trust.totalReports
  const user = await db.user.findUnique({
    where: { id: reporterId },
    select: { id: true, username: true, role: true },
  })

  if (!user) return

  // المستوى 2: 10+ مرفوض + دقة منخفضة → تقييد لبلاغ واحد يومياً
  if (trust.rejectedReports >= STRIKE_LEVEL_2.rejected && accuracy < STRIKE_LEVEL_2.maxAccuracy) {
    const alreadyRestricted = await db.userAction.findFirst({
      where: {
        userId: reporterId,
        action: 'restrict',
        metadata: { contains: 'reporter_strike_l2' },
      },
    })

    if (!alreadyRestricted) {
      await db.userAction.create({
        data: {
          userId: reporterId,
          action: 'restrict',
          metadata: JSON.stringify({
            type: 'reporter_strike_l2',
            rejectedReports: trust.rejectedReports,
            accuracy,
          }),
        },
      })

      await db.notification.create({
        data: {
          userId: reporterId,
          type: 'admin_action',
          title: '⚠️ تقييد صلاحيات الإبلاغ',
          message: 'تم تقييدك لبلاغ واحد يومياً بسبب بلاغات كيدية متكررة. راجع سياسات الإبلاغ.',
        },
      })

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
            title: '🚨 تقييد تلقائي لمُبلِّغ كيدي',
            message: `تم تقييد ${user.username} لبلاغ واحد/يوم (${trust.rejectedReports} مرفوض، دقة ${(accuracy * 100).toFixed(0)}%)`,
          },
        })
      }

      console.log(
        `[ReporterStrike] L2 restrict: ${user.username} (${trust.rejectedReports} مرفوض، دقة ${(accuracy * 100).toFixed(0)}%)`,
      )
    }
    return // تمت معالجة المستوى 2، تخطي المستوى 1
  }

  // المستوى 1: 5+ مرفوض + دقة منخفضة → تحذير
  if (trust.rejectedReports >= STRIKE_LEVEL_1.rejected && accuracy < STRIKE_LEVEL_1.maxAccuracy) {
    const alreadyWarned = await db.userAction.findFirst({
      where: {
        userId: reporterId,
        action: 'warn',
        metadata: { contains: 'reporter_strike_l1' },
      },
    })

    if (!alreadyWarned) {
      await db.userAction.create({
        data: {
          userId: reporterId,
          action: 'warn',
          metadata: JSON.stringify({
            type: 'reporter_strike_l1',
            rejectedReports: trust.rejectedReports,
            accuracy,
          }),
        },
      })

      await db.notification.create({
        data: {
          userId: reporterId,
          type: 'admin_action',
          title: '⚠️ تحذير: بلاغات كيدية',
          message: `تم تحذيرك بسبب ${trust.rejectedReports} بلاغات مرفوضة. البلاغات الكيدية المتكررة ستؤدي لتقييد حسابك.`,
        },
      })

      console.log(
        `[ReporterStrike] L1 warn: ${user.username} (${trust.rejectedReports} مرفوض، دقة ${(accuracy * 100).toFixed(0)}%)`,
      )
    }
  }
}
