import cron from 'node-cron'
import { db } from '@/lib/db'
import { generateDailySummary } from './email-service'

// جدولة الملخص كل 3 أيام الساعة 8 صباحاً
cron.schedule('0 8 */3 * *', async () => {
  console.log('Generating notification summaries...')

  const usersWithUnread = await db.user.findMany({
    where: {
      notifications: {
        some: { isRead: false },
      },
    },
    include: {
      notificationPreference: true,
    },
  })

  for (const user of usersWithUnread) {
    if (user.notificationPreference?.dailySummary) {
      try {
        await generateDailySummary(user.id)
        console.log(`Summary sent to user ${user.id}`)
      } catch (error) {
        console.error(`Failed to send summary to user ${user.id}:`, error)
      }
    }
  }

  console.log('Notification summaries completed')
})
