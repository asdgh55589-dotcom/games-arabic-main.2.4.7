/**
 * lib/cache.ts — طبقة cache تدعم Redis (Upstash) مع fallback لـ in-memory.
 */

import { redisGet, redisSet, redisDel } from './redis'

interface CacheEntry<T> {
  value: T
  expires: number
  tags: string[]
}

const memoryStore = new Map<string, CacheEntry<unknown>>()
const tagIndex = new Map<string, Set<string>>()

const MAX_ENTRIES = 500
const DEFAULT_TTL = 60

let hits = 0
let misses = 0

export async function getCache<T>(key: string): Promise<T | null> {
  const redisResult = await redisGet<T>(key)
  if (redisResult !== null) {
    hits++
    return redisResult
  }

  const entry = memoryStore.get(key)
  if (!entry) {
    misses++
    return null
  }

  if (entry.expires < Date.now()) {
    memoryStore.delete(key)
    misses++
    return null
  }

  hits++
  return entry.value as T
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL,
  tags: string[] = [],
): Promise<void> {
  await redisSet(key, value, ttlSeconds)

  if (memoryStore.size >= MAX_ENTRIES) {
    const oldestKey = memoryStore.keys().next().value
    if (oldestKey) memoryStore.delete(oldestKey)
  }

  const entry: CacheEntry<T> = {
    value,
    expires: Date.now() + ttlSeconds * 1000,
    tags,
  }

  memoryStore.set(key, entry)

  for (const tag of tags) {
    if (!tagIndex.has(tag)) {
      tagIndex.set(tag, new Set())
    }
    tagIndex.get(tag)!.add(key)
  }
}

export async function deleteCache(key: string): Promise<void> {
  await redisDel(key)
  memoryStore.delete(key)
}

export async function revalidateTag(tag: string): Promise<void> {
  const keys = tagIndex.get(tag)
  if (keys) {
    for (const key of keys) {
      memoryStore.delete(key)
      await redisDel(key)
    }
    tagIndex.delete(tag)
  }
}

export async function clearCache(): Promise<void> {
  memoryStore.clear()
  tagIndex.clear()
}

export function getCacheStats() {
  return {
    size: memoryStore.size,
    maxSize: MAX_ENTRIES,
    hits,
    misses,
    hitRate: hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) + '%' : '0%',
  }
}

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL,
  tags: string[] = [],
): Promise<T> {
  const cachedValue = await getCache<T>(key)
  if (cachedValue !== null) {
    return cachedValue
  }

  const result = await fn()
  await setCache(key, result, ttlSeconds, tags)
  return result
}
