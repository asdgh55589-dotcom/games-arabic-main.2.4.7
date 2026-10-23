/**
 * P0-4 — creator file uploads (POST /api/creator/files).
 *
 * Covers auth, multipart presence, MIME/magic validation, quota ordering
 * (quota BEFORE any IA provider call), success recording, and the Uppy
 * relay envelope hand-off. All providers/auth/db are mocked — no network.
 */
import { POST } from '@/app/api/creator/files/route'
import { POST as relayPOST } from '@/app/api/storage/ia/relay/route'
import { parseUppySuccessEnvelope } from '@/lib/uppy-envelope'

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
jest.mock('@/lib/ia', () => {
  const actual = jest.requireActual('@/lib/ia')
  return {
    ...actual,
    isIaEnabled: () => true,
    isIaConfigured: () => true,
    getIaConfig: () => ({
      accessKey: 'AK',
      secretKey: 'SK',
      identifier: 'test-item',
      collection: 'opensource',
      endpoint: 'https://s3.us.archive.org',
      region: 'us-east-1',
    }),
    getIaClient: () => ({ send: (...a: unknown[]) => mockSend(...a) }),
  }
})

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findFirst: jest.fn() },
    uploadAsset: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

const USER = {
  id: 'u-9',
  username: 'creator1',
  email: 'c@x',
  role: 'creator',
  avatarUrl: null,
}

const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])
const ZIP_BYTES = new Uint8Array([...ZIP_MAGIC, ...new Array(32).fill(0x41)])
const HTML_BYTES = new TextEncoder().encode('<html><body>not an archive</body></html>')

const OK_QUOTA = {
  allowed: true,
  quota: {
    uploadsPerDay: 10,
    maxFileBytes: 2 * 1024 ** 3,
    totalBytes: 20 * 1024 ** 3,
    source: 'builtin',
  },
  usedToday: 0,
  usedBytesToday: 0,
  usedTotalBytes: 0,
}

function makeFile(name: string, type: string, bytes: Uint8Array = ZIP_BYTES): File {
  return new File([bytes as unknown as BlobPart], name, { type })
}

function uploadReq(file: File | null, fields: Record<string, string> = {}) {
  const fd = new FormData()
  if (file) fd.set('file', file)
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return new NextRequest('http://localhost/api/creator/files', {
    method: 'POST',
    body: fd,
  })
}

async function drainCommand(command: any) {
  const body = command?.input?.Body
  if (body && typeof body[Symbol.asyncIterator] === 'function') {
    for await (const _chunk of body) {
      void _chunk
    }
  }
}

function mockAssetFromUsage() {
  mockRecord.mockImplementation(async (input: Record<string, unknown>) => [
    {},
    {},
    {
      id: 'asset-1',
      userId: input.userId,
      modId: input.modId ?? null,
      kind: input.kind,
      provider: input.provider,
      originalUrl: input.originalUrl,
      wrappedUrl: null,
      storageKey: input.storageKey,
      bytes: BigInt(Number(input.bytes)),
      mime: input.mime,
      checksum: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ])
}

beforeEach(() => {
  jest.clearAllMocks()
  mockStudio.mockResolvedValue({ user: USER, error: null })
  mockCheck.mockResolvedValue(OK_QUOTA)
  mockSend.mockImplementation(async (command: any) => {
    await drainCommand(command)
    return {}
  })
  mockAssetFromUsage()
  ;(db.mod.findFirst as jest.Mock).mockResolvedValue({ id: 'mod-1', slug: 'skyrim' })
  ;(db.uploadAsset.findFirst as jest.Mock).mockResolvedValue(null)
  ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(null)
})

describe('POST /api/creator/files', () => {
  it('returns 401 when unauthenticated', async () => {
    mockStudio.mockResolvedValue({
      user: null,
      error: {
        status: 401,
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' } }),
      },
    })

    const res = await POST(uploadReq(makeFile('patch.zip', 'application/zip')))
    expect(res.status).toBe(401)
    expect(mockCheck).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns 400 when the multipart body has no file', async () => {
    const res = await POST(uploadReq(null, { modId: 'mod-1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/لم يتم اختيار ملف/)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns 400 for a MIME type outside the allowlist', async () => {
    const res = await POST(uploadReq(makeFile('patch.zip', 'text/html')))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/نوع الملف غير مدعوم/)
    expect(mockCheck).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns 400 when magic bytes do not match the declared archive type', async () => {
    const res = await POST(uploadReq(makeFile('patch.zip', 'application/zip', HTML_BYTES)))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/محتوى الملف لا يطابق/)
    expect(mockCheck).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns 403 and never calls the provider when quota is exceeded', async () => {
    mockCheck.mockResolvedValue({
      ...OK_QUOTA,
      allowed: false,
      reason: 'تجاوزت حد الرفع اليومي (10 يومياً) — حاول غداً',
    })

    const res = await POST(uploadReq(makeFile('patch.zip', 'application/zip')))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.message).toMatch(/حد الرفع اليومي/)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('checks quota BEFORE any provider call', async () => {
    const order: string[] = []
    mockCheck.mockImplementation(async () => {
      order.push('quota')
      return OK_QUOTA
    })
    mockSend.mockImplementation(async (command: any) => {
      await drainCommand(command)
      order.push('provider')
      return {}
    })

    const res = await POST(uploadReq(makeFile('patch.zip', 'application/zip')))
    expect(res.status).toBe(201)
    expect(order).toEqual(['quota', 'provider'])
  })

  it('uploads through IA and returns 201 with a numeric-bytes asset', async () => {
    const file = makeFile('patch.zip', 'application/zip')
    const res = await POST(uploadReq(file, { modId: 'mod-1' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.asset).toMatchObject({
      id: 'asset-1',
      provider: 'ia',
      kind: 'file',
      bytes: file.size,
    })
    expect(typeof body.data.asset.bytes).toBe('number')

    expect(mockCheck).toHaveBeenCalledWith(USER.id, USER.role, file.size)
    expect(mockSend).toHaveBeenCalledTimes(1)
    const command = mockSend.mock.calls[0][0]
    expect(command.input).toMatchObject({
      Bucket: 'test-item',
      ContentLength: file.size,
      ContentType: 'application/zip',
    })
    expect(command.input.Key).toMatch(/^u-9\/skyrim-\d+-patch\.zip$/)

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER.id,
        modId: 'mod-1',
        kind: 'file',
        provider: 'ia',
        originalUrl: expect.stringMatching(/^https:\/\/archive\.org\/download\/test-item\//),
        storageKey: expect.stringMatching(/^test-item\/u-9\//),
        bytes: file.size,
        mime: 'application/zip',
      }),
    )
  })

  it('rejects a modId owned by another creator', async () => {
    ;(db.mod.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await POST(uploadReq(makeFile('patch.zip', 'application/zip'), { modId: 'mod-x' }))
    expect(res.status).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })
})

describe('Uppy relay envelope', () => {
  it('exposes the relay key/downloadUrl/bytes to upload-success', () => {
    const payload = {
      data: {
        key: 'u-9/skyrim-1-patch.zip',
        downloadUrl: 'https://archive.org/download/test-item/u-9/skyrim-1-patch.zip',
        bytes: 1234,
      },
    }

    const parsed = parseUppySuccessEnvelope(JSON.stringify(payload))
    expect(parsed.key).toBe(payload.data.key)
    expect(parsed.downloadUrl).toBe(payload.data.downloadUrl)
    expect(parsed.bytes).toBe(1234)
  })

  it('returns an empty object for a malformed relay response', () => {
    expect(parseUppySuccessEnvelope('<html>502 Bad Gateway</html>')).toEqual({})
  })

  it('relay route response parses into key/downloadUrl for Uppy upload-success', async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))
        c.close()
      },
    })
    const req = new NextRequest('http://localhost/api/storage/ia/relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-ia-filename': 'patch.zip',
        'x-ia-mime': 'application/zip',
        'x-ia-modslug': 'skyrim',
        'x-ia-title': 'Skyrim patch',
        'x-ia-bytes': '4',
      },
      body: stream as never,
      duplex: 'half',
    } as never)

    const res = await relayPOST(req)
    expect(res.status).toBe(201)

    const parsed = parseUppySuccessEnvelope(await res.text())
    expect(parsed.key).toMatch(/^u-9\/skyrim-\d+-patch\.zip$/)
    expect(parsed.downloadUrl).toMatch(/^https:\/\/archive\.org\/download\/test-item\//)
    expect(parsed.bytes).toBe(4)
  })
})
