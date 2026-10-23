import { hashRedisIdentifier, normalizeTtl, redisKey } from '@/lib/redis'

describe('redis primitives', () => {
  it('normalizes fractional TTLs to at least one second', () => {
    expect(normalizeTtl(0.5)).toBe(1)
    expect(normalizeTtl(1.2)).toBe(2)
  })

  it('rejects non-positive/non-finite TTLs with the safe default', () => {
    expect(normalizeTtl(0)).toBe(60)
    expect(normalizeTtl(-1)).toBe(60)
    expect(normalizeTtl(Number.NaN)).toBe(60)
  })

  it('namespaces keys exactly once', () => {
    expect(redisKey('ipban:abc')).toBe('ga:ipban:abc')
    expect(redisKey('ga:ratelimit:abc')).toBe('ga:ratelimit:abc')
  })

  it('hashes sensitive identifiers deterministically without exposing them', async () => {
    const hash = await hashRedisIdentifier('203.0.113.7')
    expect(hash).toHaveLength(32)
    expect(hash).not.toContain('203.0.113.7')
    expect(await hashRedisIdentifier('203.0.113.7')).toBe(hash)
  })
})
