/**
 * Phase 2 Task 4 — FreeImage adapter tests (mocked fetch/auth, no network).
 * Covers: response-shape parser, worker URL wrap, route success/quota-deny/
 * validation paths. The FreeImage API key never appears here (env only).
 */
import { wrapImageUrl } from '@/lib/image-worker'
import { parseFreeImageResponse } from '@/lib/freeimage'

const mockStudio = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: (...a: unknown[]) => mockStudio(...a),
}))

const mockCheck = jest.fn()
const mockRecord = jest.fn()
jest.mock('@/lib/quota', () => ({
  checkUploadQuota: (...a: unknown[]) => mockCheck(...a),
  recordUploadUsage: (...a: unknown[]) => mockRecord(...a),
}))

import { POST } from '@/app/api/storage/upload-image/route'

const USER = { id: 'u1', username: 'x', email: 'x@y', role: 'creator', avatarUrl: null }

function reqWithFile(size: number, type = 'image/jpeg', extra?: Record<string, string>) {
  const bytes = new Uint8Array(size)
  const file = new File([bytes], 'shot.jpg', { type })
  const fd = new FormData()
  fd.append('file', file)
  for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v)
  const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')
  return new NextRequest('http://x/api/storage/upload-image', { method: 'POST', body: fd })
}

const FREEIMAGE_OK = {
  status_code: 200,
  image: { url: 'https://iili.io/abc.jpg', display_url: 'https://freeimage.host/i/abc', thumb: { url: 'https://iili.io/abc.th.jpg' }, delete_url: 'https://freeimage.host/delete/xyz' },
}

beforeEach(() => {
  jest.restoreAllMocks()
  process.env.FREEIMAGE_API_KEY = 'test-key'
  delete process.env.IMG_WORKER_DOMAIN
  mockStudio.mockReset().mockResolvedValue({ user: USER, error: null })
  mockCheck.mockReset().mockResolvedValue({
    allowed: true,
    quota: { uploadsPerDay: 10, maxFileBytes: 2 * 1024 ** 3, totalBytes: 20 * 1024 ** 3, source: 'builtin' },
    usedToday: 0, usedBytesToday: 0, usedTotalBytes: 0,
  })
  mockRecord.mockReset().mockResolvedValue([{}, {}, {}])
})

afterEach(() => {
  delete process.env.FREEIMAGE_API_KEY
})

describe('parseFreeImageResponse', () => {
  it('prefers image.url, falls back through known shapes', () => {
    expect(parseFreeImageResponse(FREEIMAGE_OK).url).toBe('https://iili.io/abc.jpg')
    expect(parseFreeImageResponse({ image: { display_url: 'https://freeimage.host/i/a' } }).url).toBe('https://freeimage.host/i/a')
    expect(parseFreeImageResponse({ image: { medium: { url: 'https://iili.io/m.jpg' } } }).url).toBe('https://iili.io/m.jpg')
    expect(parseFreeImageResponse({ url: 'https://iili.io/d.jpg' }).url).toBe('https://iili.io/d.jpg')
  })

  it('throws when no URL present (never store garbage)', () => {
    expect(() => parseFreeImageResponse({ status_code: 400 })).toThrow(/no image URL/)
    expect(() => parseFreeImageResponse(null)).toThrow()
  })
})

describe('wrapImageUrl', () => {
  it('returns null when worker not configured (caller falls back to original)', () => {
    expect(wrapImageUrl('https://iili.io/abc.jpg')).toBeNull()
  })

  it('wraps https upstream under worker domain; rejects non-http', () => {
    process.env.IMG_WORKER_DOMAIN = 'img.example.com'
    const wrapped = wrapImageUrl('https://iili.io/abc.jpg')
    expect(wrapped).toMatch(/^https:\/\/img\.example\.com\/img\//)
    expect(wrapImageUrl('data:image/png;base64,xx')).toBeNull()
    expect(wrapImageUrl('/relative/path.jpg')).toBeNull()
  })
})

describe('POST /api/storage/upload-image', () => {
  it('relays to FreeImage with server key, records usage, returns wrapped-or-original', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(FREEIMAGE_OK), { status: 200 }),
    )
    const res = await POST(reqWithFile(1024))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.data.originalUrl).toBe('https://iili.io/abc.jpg')
    expect(body.data.url).toBe('https://iili.io/abc.jpg') // no worker → original
    expect(body.data.wrappedUrl).toBeNull()

    // Server key sent, never in response:
    const [, init] = fetchMock.mock.calls[0]
    const sent = (init?.body as FormData).get('key')
    expect(sent).toBe('test-key')
    expect(JSON.stringify(body)).not.toMatch(/test-key/)

    expect(mockCheck).toHaveBeenCalledWith('u1', 'creator', 1024)
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', kind: 'image', provider: 'freeimage',
      originalUrl: 'https://iili.io/abc.jpg', bytes: 1024,
    }))
  })

  it('denies with Arabic quota reason without touching FreeImage', async () => {
    mockCheck.mockResolvedValue({
      allowed: false, reason: 'تجاوزت حد الرفع اليومي (10 يومياً) — حاول غداً',
      quota: {}, usedToday: 10, usedBytesToday: 0, usedTotalBytes: 0,
    })
    const fetchMock = jest.spyOn(globalThis, 'fetch')
    const res = await POST(reqWithFile(1024))
    const body = await res.json()
    expect(res.status).not.toBe(201)
    expect(JSON.stringify(body)).toMatch(/حد الرفع اليومي/)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('rejects non-image types and oversize files before quota', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
    const badType = await POST(reqWithFile(100, 'application/zip'))
    expect((await badType.json()).error || badType.status).toBeTruthy()
    expect(badType.status).toBe(422)
    const big = await POST(reqWithFile(65 * 1024 * 1024))
    expect(big.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when key missing (no message leak)', async () => {
    delete process.env.FREEIMAGE_API_KEY
    const res = await POST(reqWithFile(1024))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(JSON.stringify(body)).not.toMatch(/FREEIMAGE_API_KEY/)
  })
})
