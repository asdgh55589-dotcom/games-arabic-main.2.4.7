/**
 * Phase 2 Task 5 — Internet Archive adapter tests (mocked SDK/auth/quota,
 * no network). Covers: key helpers, sign validation + quota gate, complete
 * verify/record paths, relay streaming contract. Keys never appear here.
 */
import { buildIaKey, iaDownloadUrl, sanitizeIaSegment } from '@/lib/ia'

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

const mockSend = jest.fn()
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3')
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: (...a: unknown[]) => mockSend(...a) })),
  }
})

const mockPresign = jest.fn()
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...a: unknown[]) => mockPresign(...a),
}))

jest.mock('@/lib/db', () => ({
  db: {
    uploadAsset: { findFirst: jest.fn().mockResolvedValue(null) },
    mod: { findFirst: jest.fn().mockResolvedValue(null) },
  },
}))

import { db } from '@/lib/db'
import { POST as signPOST } from '@/app/api/storage/ia/sign/route'
import { POST as completePOST } from '@/app/api/storage/ia/complete/route'
import { POST as relayPOST } from '@/app/api/storage/ia/relay/route'
import { POST as uploadFilePOST } from '@/app/api/storage/upload-file/route'

const USER = { id: 'u-9', username: 'creator1', email: 'c@x', role: 'creator', avatarUrl: null }
const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.IA_ENABLED = 'true'
  process.env.IA_ACCESS_KEY = 'AK'
  process.env.IA_SECRET_KEY = 'SK'
  process.env.IA_IDENTIFIER = 'games-arabic-mods-test'
  mockStudio.mockResolvedValue({ user: USER, error: null })
  mockCheck.mockResolvedValue({
    allowed: true,
    quota: { uploadsPerDay: 10, maxFileBytes: 2 * 1024 ** 3, totalBytes: 20 * 1024 ** 3, source: 'builtin' },
    usedToday: 0, usedBytesToday: 0, usedTotalBytes: 0,
  })
  mockRecord.mockResolvedValue([{}, {}, {}])
  mockPresign.mockResolvedValue('https://s3.us.archive.org/signed-put-url')
  ;(db.uploadAsset.findFirst as jest.Mock).mockResolvedValue(null)
  mockSend.mockImplementation(async (command: any) => {
    const body = command?.input?.Body
    if (body && typeof body[Symbol.asyncIterator] === 'function') {
      for await (const _chunk of body) {
        void _chunk
      }
    }
    return { ContentLength: 1234 }
  })
})

afterEach(() => {
  delete process.env.IA_ENABLED
  delete process.env.IA_ACCESS_KEY
  delete process.env.IA_SECRET_KEY
  delete process.env.IA_IDENTIFIER
})

describe('IA key helpers (pure)', () => {
  it('sanitizes segments to IA-safe ASCII', () => {
    expect(sanitizeIaSegment('مود رائع v2.zip')).toMatch(/^[a-zA-Z0-9._-]+$/)
    expect(sanitizeIaSegment('')).toBe('file')
  })

  it('builds creator-scoped keys', () => {
    const key = buildIaKey('u-9', 'skyrim-patch', 'patch.zip', 123)
    expect(key).toBe('u-9/skyrim-patch-123-patch.zip')
  })

  it('builds archive.org download URLs', () => {
    expect(iaDownloadUrl('my-item', 'u/f.zip')).toBe('https://archive.org/download/my-item/u/f.zip')
  })
})

describe('POST /api/storage/ia/sign', () => {
  const good = { filename: 'patch.zip', mime: 'application/zip', bytes: 1024, modSlug: 'skyrim', title: 'Skyrim patch' }

  it('returns 503 while IA is disabled', async () => {
    delete process.env.IA_ENABLED
    const res = await signPOST(jsonReq('http://x/api/storage/ia/sign', good))
    expect(res.status).toBe(503)
    expect(mockPresign).not.toHaveBeenCalled()
  })

  it('returns 501 DEPRECATED when enabled (dead presign path — use relay)', async () => {
    const res = await signPOST(jsonReq('http://x/api/storage/ia/sign', good))
    const body = await res.json()
    expect(res.status).toBe(501)
    expect(JSON.stringify(body)).toMatch(/relay/)
    expect(mockPresign).not.toHaveBeenCalled()
    expect(mockCheck).not.toHaveBeenCalled()
  })
})

describe('POST /api/storage/ia/complete', () => {
  const done = {
    key: 'u-9/skyrim-1-patch.zip',
    downloadUrl: 'https://archive.org/download/games-arabic-mods-test/u-9/skyrim-1-patch.zip',
    bytes: 1234, mime: 'application/zip', mode: 'direct',
  }

  it('verifies via HEAD then records usage (provider ia, kind file)', async () => {
    const res = await completePOST(jsonReq('http://x/', done))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.data.downloadUrl).toBe(done.downloadUrl)
    expect(mockSend).toHaveBeenCalled() // HeadObject
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u-9', kind: 'file', provider: 'ia',
      originalUrl: done.downloadUrl, bytes: 1234,
    }))
  })

  it('422 when HEAD ContentLength differs from the client-declared bytes', async () => {
    mockSend.mockResolvedValue({ ContentLength: 99 })
    const res = await completePOST(jsonReq('http://x/', done))
    expect(res.status).toBe(422)
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('422 when HEAD never finds the object (no phantom records)', async () => {
    mockSend.mockRejectedValue(new Error('NotFound'))
    const res = await completePOST(jsonReq('http://x/', done))
    expect(res.status).toBe(422)
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('relay mode still verifies via HEAD before recording', async () => {
    const res = await completePOST(jsonReq('http://x/', { ...done, mode: 'relay' }))
    expect(res.status).toBe(201)
    expect(mockSend).toHaveBeenCalled()
    expect(mockRecord).toHaveBeenCalled()
  })

  it('rejects non-https download URLs', async () => {
    const res = await completePOST(jsonReq('http://x/', { ...done, downloadUrl: 'data:x' }))
    expect(res.status).toBe(422)
  })

  it('rejects cross-tenant keys before HEAD', async () => {
    const res = await completePOST(
      jsonReq('http://x/', { ...done, key: 'u-other/skyrim-1-patch.zip' }),
    )
    expect(res.status).toBe(422)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('does not double-record a repeated complete (idempotent by storageKey)', async () => {
    ;(db.uploadAsset.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'asset-1',
      originalUrl: done.downloadUrl,
      bytes: BigInt(1234),
    })
    const res = await completePOST(jsonReq('http://x/', done))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.data.alreadyRecorded).toBe(true)
    expect(body.data.assetId).toBe('asset-1')
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })
})

describe('POST /api/storage/ia/relay', () => {
  function relayReq(bytes: number) {
    const stream = new ReadableStream({
      start(c) { c.enqueue(new Uint8Array([0x50, 0x4b, 0x03, 0x04])); c.close() },
    })
    return new NextRequest('http://x/api/storage/ia/relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-ia-filename': 'patch.zip',
        'x-ia-mime': 'application/zip',
        'x-ia-modslug': 'skyrim',
        'x-ia-title': 'Skyrim patch',
        'x-ia-bytes': String(bytes),
      },
      body: stream as never,
      duplex: 'half',
    } as never)
  }

  it('streams to IA and returns the download URL', async () => {
    const res = await relayPOST(relayReq(4))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.data.downloadUrl).toMatch(/^https:\/\/archive\.org\/download\//)
    expect(mockSend).toHaveBeenCalled()
    expect(mockCheck).toHaveBeenCalledWith('u-9', 'creator', 4)
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-9', kind: 'file', bytes: 4 }),
    )
    expect(body.data.usageRecorded).toBe(true)
  })

  it('binds an idempotency token to the byte count (same key + bigger body = new object)', async () => {
    function reqWithKey(bytes: number) {
      const body = new Uint8Array(bytes)
      body.set([0x50, 0x4b, 0x03, 0x04])
      const stream = new ReadableStream({
        start(c) { c.enqueue(body); c.close() },
      })
      return new NextRequest('http://x/api/storage/ia/relay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-ia-filename': 'patch.zip',
          'x-ia-mime': 'application/zip',
          'x-ia-modslug': 'skyrim',
          'x-ia-title': 'Skyrim patch',
          'x-ia-bytes': String(bytes),
          'x-ia-key': 'same-token',
        },
        body: stream as never,
        duplex: 'half',
      } as never)
    }

    const first = await relayPOST(reqWithKey(4))
    const firstBody = await first.json()
    const second = await relayPOST(reqWithKey(8))
    const secondBody = await second.json()

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(firstBody.data.key).not.toBe(secondBody.data.key)
    expect(mockRecord).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid magic bytes before IA and records nothing', async () => {
    const html = new TextEncoder().encode('<html>not an archive</html>')
    const stream = new ReadableStream({
      start(c) { c.enqueue(html); c.close() },
    })
    const req = new NextRequest('http://x/api/storage/ia/relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-ia-filename': 'patch.zip',
        'x-ia-mime': 'application/zip',
        'x-ia-bytes': String(html.byteLength),
      },
      body: stream as never,
      duplex: 'half',
    } as never)

    const res = await relayPOST(req)
    expect(res.status).toBe(422)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('rejects a declared size larger than the streamed body', async () => {
    const res = await relayPOST(relayReq(10))
    expect(res.status).toBe(422)
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('quota deny short-circuits before IA (Arabic reason)', async () => {
    mockCheck.mockResolvedValue({
      allowed: false, reason: 'تجاوزت حد الرفع اليومي', quota: {},
      usedToday: 10, usedBytesToday: 0, usedTotalBytes: 0,
    })
    const res = await relayPOST(relayReq(4))
    expect(res.status).toBe(422)
    expect(JSON.stringify(await res.json())).toMatch(/حد الرفع اليومي/)
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('Phase 2.1 — IA disabled by default (COMING_SOON, fail closed)', () => {
  const good = { filename: 'patch.zip', mime: 'application/zip', bytes: 1024 }
  const done = {
    key: 'u-9/x.zip',
    downloadUrl: 'https://archive.org/download/i/u-9/x.zip',
    bytes: 1234, mime: 'application/zip', mode: 'direct',
  }

  beforeEach(() => {
    delete process.env.IA_ENABLED
  })

  it('sign/relay/complete/upload-file all return 503 without touching IA', async () => {
    const signRes = await signPOST(jsonReq('http://x/', good))
    expect(signRes.status).toBe(503)
    expect(JSON.stringify(await signRes.json())).toMatch(/قريبًا/)

    const relayStream = new ReadableStream({
      start(c) { c.enqueue(new Uint8Array([1])); c.close() },
    })
    const relayRes = await relayPOST(new NextRequest('http://x/api/storage/ia/relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-ia-filename': 'patch.zip',
        'x-ia-bytes': '1',
      },
      body: relayStream as never,
      duplex: 'half',
    } as never))
    expect(relayRes.status).toBe(503)

    const doneRes = await completePOST(jsonReq('http://x/', done))
    expect(doneRes.status).toBe(503)

    const upRes = await uploadFilePOST(jsonReq('http://x/', {}))
    expect(upRes.status).toBe(503)
    const upBody = await upRes.json()
    expect(upBody.error.code).toBe('COMING_SOON')
    expect(upBody.error.message).toMatch(/قريبًا/)

    expect(mockPresign).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('auth still runs before the flag (no anonymous probing)', async () => {
    mockStudio.mockResolvedValueOnce({ user: null, error: null })
    const res = await signPOST(jsonReq('http://x/', good))
    // requireCreatorStudio mocked to no-user without error → validation path, not 503
    expect(res.status).not.toBe(503)
  })
})
