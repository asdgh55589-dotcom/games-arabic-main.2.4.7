/**
 * Phase 2 Task 6 — image worker contract tests (pure functions; the worker
 * runtime itself is verified with `wrangler dev` at deploy time — no
 * wrangler/miniflare in this repo by design).
 * Covers: wrap/unwrap roundtrip, bad paths, SSRF allowlist incl. evil
 * lookalikes, cache-hit/miss header contract (static on worker source).
 */
import fs from 'fs'
import path from 'path'
import {
  decodeWrappedImagePath,
  isAllowedUpstreamHost,
  wrapImageUrl,
} from '@/lib/image-worker'

describe('wrap/unwrap roundtrip', () => {
  it('roundtrips an upstream URL through the worker path', () => {
    process.env.IMG_WORKER_DOMAIN = 'img.example.com'
    const upstream = 'https://iili.io/abc123.jpg'
    const wrapped = wrapImageUrl(upstream)
    expect(wrapped).toMatch(/^https:\/\/img\.example\.com\/img\//)
    const back = decodeWrappedImagePath(new URL(wrapped as string).pathname)
    expect(back).toBe(upstream)
    delete process.env.IMG_WORKER_DOMAIN
  })

  it('rejects malformed paths', () => {
    expect(decodeWrappedImagePath('/img/')).toBeNull()
    expect(decodeWrappedImagePath('/img/!!!not-base64!!!')).toBeNull()
    expect(decodeWrappedImagePath('/other/abc')).toBeNull()
    expect(decodeWrappedImagePath('')).toBeNull()
  })
})

describe('SSRF allowlist', () => {
  it('allows listed hosts, exact + subdomains, case-insensitive', () => {
    expect(isAllowedUpstreamHost('iili.io')).toBe(true)
    expect(isAllowedUpstreamHost('IILI.IO')).toBe(true)
    expect(isAllowedUpstreamHost('cdn.freeimage.host')).toBe(true)
  })

  it('rejects evil lookalikes and unlisted hosts', () => {
    expect(isAllowedUpstreamHost('evil-iili.io')).toBe(false)
    expect(isAllowedUpstreamHost('iili.io.evil.com')).toBe(false)
    expect(isAllowedUpstreamHost('evil.com')).toBe(false)
    expect(isAllowedUpstreamHost('')).toBe(false)
  })

  it('supports extra hosts override', () => {
    expect(isAllowedUpstreamHost('cdn.example.com', ['cdn.example.com'])).toBe(true)
    expect(isAllowedUpstreamHost('iili.io', ['cdn.example.com'])).toBe(false)
  })
})

describe('worker source contract (static)', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'workers/image-proxy/src/index.js'),
    'utf8',
  )

  it('serves edge cache with HIT/MISS observability + long cache headers', () => {
    expect(src).toMatch(/caches\.default/)
    expect(src).toMatch(/cache\.match\(/)
    expect(src).toMatch(/cache\.put\(/)
    expect(src).toMatch(/X-Cache/)
    expect(src).toMatch(/max-age=31536000/)
  })

  it('validates method, image content-type, size cap, and strips cookies', () => {
    expect(src).toMatch(/405/)
    expect(src).toMatch(/image\//)
    expect(src).toMatch(/MAX_UPSTREAM_BYTES/)
    expect(src).toMatch(/set-cookie/)
  })

  it('reuses the shared lib (single source of truth, no forked logic)', () => {
    expect(src).toMatch(/decodeWrappedImagePath/)
    expect(src).toMatch(/isAllowedUpstreamHost/)
    expect(src).toMatch(/src\/lib\/image-worker/)
  })
})
