/**
 * lib/redis-client.ts — غلاف Redis مع fallback سلس إلى الذاكرة
 *
 * يعمل مع Upstash Redis عند توفر بيانات الاعتماد، ويعود تلقائياً
 * إلى InMemory في حالة عدم التوفر أو الفشل — بدون كسر الوظائف.
 */

import { Redis } from '@upstash/redis'

export interface RedisClient {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options?: { ex?: number; nx?: boolean }) => Promise<unknown>
  incr: (key: string) => Promise<number>
  expire: (key: string, seconds: number) => Promise<unknown>
  del: (key: string) => Promise<unknown>
}

// In-memory fallback for when Redis is not configured
class InMemoryRedis implements RedisClient {
  private store = new Map<string, { value: string; expires: number }>()

  private cleanup() {
    const now = Date.now()
    for (const [key, data] of this.store.entries()) {
      if (data.expires && data.expires < now) {
        this.store.delete(key)
      }
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanup()
    const data = this.store.get(key)
    if (!data) return null
    if (data.expires && data.expires < Date.now()) {
      this.store.delete(key)
      return null
    }
    return data.value
  }

  async set(key: string, value: string, options?: { ex?: number; nx?: boolean }): Promise<unknown> {
    this.cleanup()
    if (options?.nx) {
      const existing = this.store.get(key)
      if (existing && (!existing.expires || existing.expires > Date.now())) {
        return null
      }
    }
    const expires = options?.ex ? Date.now() + options.ex * 1000 : 0
    this.store.set(key, { value, expires })
    return 'OK'
  }

  async incr(key: string): Promise<number> {
    this.cleanup()
    const current = await this.get(key)
    const newValue = current ? parseInt(current, 10) + 1 : 1
    // Preserve TTL if exists
    const existing = this.store.get(key)
    const expires = existing?.expires || 0
    this.store.set(key, { value: newValue.toString(), expires })
    if (!existing) {
      // No expiry yet — caller should set expire
    }
    return newValue
  }

  async expire(key: string, seconds: number): Promise<unknown> {
    const data = this.store.get(key)
    if (data) {
      data.expires = Date.now() + seconds * 1000
      return 1
    }
    return 0
  }

  async del(key: string): Promise<unknown> {
    return this.store.delete(key) ? 1 : 0
  }
}

// Singleton Redis client with graceful fallback
let redisClient: RedisClient | null = null
let usingUpstash = false

export function getRedisClient(): RedisClient {
  if (redisClient) return redisClient

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    try {
      redisClient = new Redis({ url, token }) as unknown as RedisClient
      usingUpstash = true
      console.log('[Redis] متصل بـ Upstash Redis')
    } catch (error) {
      console.warn('[Redis] فشل الاتصال بـ Upstash، استخدام الذاكرة المؤقتة:', error)
      redisClient = new InMemoryRedis()
    }
  } else {
    console.warn('[Redis] بيانات الاعتماد غير مُكوَّنة — استخدام الذاكرة المؤقتة')
    redisClient = new InMemoryRedis()
  }

  return redisClient
}

export function isUsingUpstash(): boolean {
  return usingUpstash
}

export function getRedisInfo() {
  return { connected: usingUpstash, type: usingUpstash ? 'upstash' : 'in-memory' }
}
