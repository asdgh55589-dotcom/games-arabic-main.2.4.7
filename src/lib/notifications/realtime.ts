import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function sendRealtimeNotification(userId: string): Promise<void> {
  await redis.publish(`notifications:${userId}`, {
    event: 'new_notification',
    userId,
    timestamp: Date.now(),
  })
}
