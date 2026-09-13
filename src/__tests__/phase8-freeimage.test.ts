/**
 * phase8-freeimage.test.ts — Tests for MIME validation, circuit breaker, retry, Arabic errors, and delete route.
 */
import { isAllowedImageMime, validateImageMagicBytes } from '@/lib/mime'

// ── MIME validation ─────────────────────────────────────────

describe('isAllowedImageMime', () => {
  it('returns true for jpeg/png/webp/gif', () => {
    expect(isAllowedImageMime('image/jpeg')).toBe(true)
    expect(isAllowedImageMime('image/png')).toBe(true)
    expect(isAllowedImageMime('image/webp')).toBe(true)
    expect(isAllowedImageMime('image/gif')).toBe(true)
  })

  it('returns false for svg/video', () => {
    expect(isAllowedImageMime('image/svg+xml')).toBe(false)
    expect(isAllowedImageMime('video/mp4')).toBe(false)
  })
})

describe('validateImageMagicBytes', () => {
  it('detects jpeg header (FF D8 FF)', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    expect(validateImageMagicBytes(buf, 'image/jpeg')).toBe(true)
  })

  it('detects png header (89 50 4E 47)', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
    expect(validateImageMagicBytes(buf, 'image/png')).toBe(true)
  })

  it('detects gif header (47 49 46)', () => {
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(validateImageMagicBytes(buf, 'image/gif')).toBe(true)
  })

  it('detects webp header (RIFF....WEBP)', () => {
    const riff = Buffer.from('RIFF')
    const webp = Buffer.from('WEBP')
    const middle = Buffer.from([0x00, 0x00, 0x00, 0x00])
    const buf = Buffer.concat([riff, middle, webp, Buffer.alloc(4)])
    expect(validateImageMagicBytes(buf, 'image/webp')).toBe(true)
  })

  it('returns false for short buffer', () => {
    expect(validateImageMagicBytes(Buffer.from([0xff, 0xd8]), 'image/jpeg')).toBe(false)
  })
})

// ── Circuit breaker + retry + Arabic errors ──────────────────

// We test uploadToFreeImage by mocking fetch at global level

let uploadToFreeImage: typeof import('@/lib/freeimage').uploadToFreeImage
let isCircuitOpen: typeof import('@/lib/freeimage').isCircuitOpen
let __resetCircuitForTests: typeof import('@/lib/freeimage').__resetCircuitForTests

beforeAll(async () => {
  const mod = await import('@/lib/freeimage')
  uploadToFreeImage = mod.uploadToFreeImage
  isCircuitOpen = mod.isCircuitOpen
  __resetCircuitForTests = mod.__resetCircuitForTests
})

beforeEach(() => {
  jest.restoreAllMocks()
  __resetCircuitForTests()
  process.env.FREEIMAGE_API_KEY = 'test-key-very-long-for-masking'
})

afterEach(() => {
  delete process.env.FREEIMAGE_API_KEY
})

function makeFreeImageResponse(status: number, body?: object) {
  const defaultBody = {
    status_code: 200,
    image: { url: 'https://iili.io/ok.jpg', delete_url: 'https://freeimage.host/del/1' },
  }
  return new Response(JSON.stringify(body ?? defaultBody), { status })
}

describe('uploadToFreeImage — circuit breaker', () => {
  it('opens after 5 failures in 60s', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(makeFreeImageResponse(500))

    for (let i = 0; i < 5; i++) {
      try { await uploadToFreeImage(Buffer.alloc(10), 'image/jpeg') } catch {}
    }
    expect(isCircuitOpen()).toBe(true)

    await expect(uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')).rejects.toThrow('تم تعطيل الخدمة مؤقتاً')
  })
})

describe('uploadToFreeImage — retry', () => {
  it('retries once on 5xx then succeeds', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(makeFreeImageResponse(500))
    fetchMock.mockResolvedValueOnce(makeFreeImageResponse(200))

    const result = await uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')
    expect(result.url).toBe('https://iili.io/ok.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on 401', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(makeFreeImageResponse(401))

    await expect(uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')).rejects.toThrow('مفتاح API غير صالح')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 403', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(makeFreeImageResponse(403))

    await expect(uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')).rejects.toThrow('مفتاح API غير صالح')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('uploadToFreeImage — Arabic error messages', () => {
  it('401 → مفتاح API غير صالح', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(makeFreeImageResponse(401))
    await expect(uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')).rejects.toThrow('FREEIMAGE: مفتاح API غير صالح')
  })

  it('413 → الملف يتجاوز الحد الأقصى', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(makeFreeImageResponse(413))
    await expect(uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')).rejects.toThrow('FREEIMAGE: الملف يتجاوز الحد الأقصى')
  })

  it('429 → تم تجاوز حد الطلبات', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(makeFreeImageResponse(429))
    await expect(uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')).rejects.toThrow('FREEIMAGE: تم تجاوز حد الطلبات')
  })

  it('timeout → انتهت المهلة', async () => {
    const err = new Error('The operation was aborted')
    ;(err as any).name = 'TimeoutError'
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(err)
    await expect(uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')).rejects.toThrow('FREEIMAGE: انتهت المهلة')
  })

  it('network error → خطأ في الشبكة', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))
    await expect(uploadToFreeImage(Buffer.alloc(10), 'image/jpeg')).rejects.toThrow('FREEIMAGE: خطأ في الشبكة')
  })
})

// ── Delete route ────────────────────────────────────────────

const mockGetSession = jest.fn()
jest.mock('@/lib/auth', () => ({
  getSession: (...a: unknown[]) => mockGetSession(...a),
}))

const mockUploadAsset = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
}
jest.mock('@/lib/db', () => ({
  db: { uploadAsset: mockUploadAsset },
}))

let POST: typeof import('@/app/api/storage/delete-image/route').POST

beforeAll(async () => {
  const route = await import('@/app/api/storage/delete-image/route')
  POST = route.POST
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ id: 'u1', username: 'test', email: 't@t', role: 'creator', avatarUrl: null, onboardingCompleted: true })
  mockUploadAsset.findUnique.mockReset()
  mockUploadAsset.findFirst.mockReset()
  mockUploadAsset.update.mockReset()
  mockUploadAsset.update.mockResolvedValue({})
})

function reqWith(body: object) {
  const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')
  return new NextRequest('http://x/api/storage/delete-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/storage/delete-image', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await POST(reqWith({ id: 'asset-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not owner', async () => {
    mockUploadAsset.findUnique.mockResolvedValue({ id: 'asset-1', userId: 'other-user', storageKey: null, wrappedUrl: 'wrapped' })
    const res = await POST(reqWith({ id: 'asset-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 200 on success (owner)', async () => {
    mockUploadAsset.findUnique.mockResolvedValue({ id: 'asset-1', userId: 'u1', storageKey: null, wrappedUrl: 'wrapped' })
    const fetchMock = jest.spyOn(globalThis, 'fetch')
    const res = await POST(reqWith({ id: 'asset-1' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.ok).toBe(true)
    expect(body.data.deleted).toBe(true)
    expect(mockUploadAsset.update).toHaveBeenCalledWith({ where: { id: 'asset-1' }, data: { wrappedUrl: null, storageKey: null } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deletes same asset twice returns ok (idempotent)', async () => {
    mockUploadAsset.findUnique
      .mockResolvedValueOnce({ id: 'asset-1', userId: 'u1', storageKey: null, wrappedUrl: 'wrapped' })
      .mockResolvedValueOnce(null)

    const res1 = await POST(reqWith({ id: 'asset-1' }))
    const body1 = await res1.json()
    expect(body1.data.deleted).toBe(true)

    const res2 = await POST(reqWith({ id: 'asset-1' }))
    const body2 = await res2.json()
    expect(body2.data.ok).toBe(true)
    expect(body2.data.deleted).toBe(false)
  })
})
