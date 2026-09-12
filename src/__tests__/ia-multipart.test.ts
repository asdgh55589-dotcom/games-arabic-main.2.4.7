/**
 * IA SAFE multipart (per-part server proxy) — mocked SDK/auth/quota/db,
 * no network. Covers: pure md5 vectors + part-plan math, initiate quota
 * gate + fail-closed, part md5-mismatch reject + journal update, resume
 * via status, complete metadata-poll + usage record, abort cleanup, and
 * the no-LOW-secret-in-client-bundle invariant.
 */
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { md5Hex } from '@/lib/md5'
import { planParts, IA_PART_SIZE } from '@/lib/ia-multipart-client'

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

const mockJournal = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
}
jest.mock('@/lib/db', () => ({
  db: { iaMultipartUpload: mockJournal },
}))

const mockSend = jest.fn()
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3')
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: (...a: unknown[]) => mockSend(...a) })),
  }
})

import { POST as initiatePOST } from '@/app/api/ia/initiate/route'
import { POST as partPOST } from '@/app/api/ia/part/route'
import { POST as completePOST } from '@/app/api/ia/complete/route'
import { POST as abortPOST } from '@/app/api/ia/abort/route'
import { GET as statusGET } from '@/app/api/ia/status/route'

const USER = { id: 'u-9', username: 'creator1', email: 'c@x', role: 'creator', avatarUrl: null }
const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function jsonReq(url: string, body: unknown, headers?: Record<string, string>) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  })
}

function bytesReq(url: string, bytes: Uint8Array, headers: Record<string, string>) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...headers },
    // @ts-expect-error undici accepts Uint8Array bodies
    body: bytes,
  })
}

const SESSION = {
  id: 'sess-1',
  userId: 'u-9',
  modId: null,
  key: 'u-9/mod-1-file.zip',
  uploadId: 'ia-upload-id-1',
  totalBytes: '12000000',
  partSize: 5 * 1024 * 1024,
  totalParts: 3,
  parts: {},
  status: 'initiated',
  downloadUrl: null,
}

function allowQuota() {
  mockCheck.mockResolvedValue({
    allowed: true,
    quota: { uploadsPerDay: 10, maxFileBytes: 2 * 1024 ** 3, totalBytes: 20 * 1024 ** 3, source: 'builtin' },
    usedToday: 0, usedBytesToday: 0, usedTotalBytes: 0,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.IA_ENABLED = 'true'
  process.env.IA_ACCESS_KEY = 'AK'
  process.env.IA_SECRET_KEY = 'SK'
  process.env.IA_IDENTIFIER = 'games-arabic-mods-test'
  mockStudio.mockResolvedValue({ user: USER, error: null })
  allowQuota()
  mockRecord.mockResolvedValue([{}, {}, {}])
  mockSend.mockResolvedValue({})
  mockJournal.create.mockImplementation((args: unknown) => Promise.resolve({ ...SESSION, ...((args as { data: object }).data || {}) }))
  mockJournal.findUnique.mockResolvedValue({ ...SESSION })
  mockJournal.update.mockImplementation((args: unknown) => {
    const a = args as { data: object }
    return Promise.resolve({ ...SESSION, ...a.data })
  })
})

afterEach(() => {
  delete process.env.IA_ENABLED
  delete process.env.IA_ACCESS_KEY
  delete process.env.IA_SECRET_KEY
  delete process.env.IA_IDENTIFIER
})

describe('pure helpers (md5 + part plan)', () => {
  it('md5 matches RFC 1321 vectors', () => {
    expect(md5Hex(new TextEncoder().encode(''))).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5Hex(new TextEncoder().encode('a'))).toBe('0cc175b9c0f1b6a831c399e269772661')
    expect(md5Hex(new TextEncoder().encode('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5Hex(new TextEncoder().encode('message digest'))).toBe('f96b697d7cb7938d525a2f31aaf161d0')
    expect(md5Hex(new TextEncoder().encode('abcdefghijklmnopqrstuvwxyz'))).toBe(
      'c3fcd3d76192e4007dfb496cca67e13b',
    )
  })

  it('part plan splits bytes into 5MB parts (last smaller)', () => {
    expect(IA_PART_SIZE).toBe(5 * 1024 * 1024)
    const plan = planParts(12_000_000, IA_PART_SIZE)
    expect(plan.totalParts).toBe(3)
    expect(plan.parts[0]).toEqual({ partNumber: 1, offset: 0, length: IA_PART_SIZE })
    expect(plan.parts[2]).toEqual({ partNumber: 3, offset: 2 * IA_PART_SIZE, length: 12_000_000 - 2 * IA_PART_SIZE })
  })
})

describe('POST /api/ia/initiate', () => {
  const good = { filename: 'patch.zip', mime: 'application/zip', bytes: 12_000_000, modSlug: 'skyrim' }

  it('fail-closed when IA_ENABLED is off', async () => {
    delete process.env.IA_ENABLED
    const res = await initiatePOST(jsonReq('http://x/api/ia/initiate', good))
    expect(res.status).toBe(503)
    expect(mockJournal.create).not.toHaveBeenCalled()
  })

  it('quota deny → 422 and no journal row', async () => {
    mockCheck.mockResolvedValue({
      allowed: false, reason: 'مرفوض', quota: {}, usedToday: 10, usedBytesToday: 0, usedTotalBytes: 0,
    })
    const res = await initiatePOST(jsonReq('http://x/api/ia/initiate', good))
    expect(res.status).toBe(422)
    expect(mockJournal.create).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('creates journal (initiated) and returns resume plan', async () => {
    mockSend.mockResolvedValue({ UploadId: 'ia-upload-id-1' })
    const res = await initiatePOST(jsonReq('http://x/api/ia/initiate', good))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.uploadId).toBe('ia-upload-id-1')
    expect(body.data.partSize).toBe(IA_PART_SIZE)
    expect(body.data.totalParts).toBe(3)
    expect(mockJournal.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'initiated', totalParts: 3 }) }),
    )
  })
})

describe('POST /api/ia/part', () => {
  it('rejects md5 mismatch without touching the journal', async () => {
    const bytes = new TextEncoder().encode('hello-part')
    const res = await partPOST(
      bytesReq('http://x/api/ia/part', bytes, {
        'x-ia-session': 'sess-1',
        'x-ia-part': '1',
        'x-ia-md5': 'deadbeefdeadbeefdeadbeefdeadbeef',
      }),
    )
    expect(res.status).toBe(422)
    expect(mockJournal.update).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('streams a verified part and records its md5 in the journal', async () => {
    const bytes = new TextEncoder().encode('hello-part')
    const md5 = createHash('md5').update(bytes).digest('hex')
    const res = await partPOST(
      bytesReq('http://x/api/ia/part', bytes, {
        'x-ia-session': 'sess-1',
        'x-ia-part': '2',
        'x-ia-md5': md5,
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ partNumber: 2, md5 })
    expect(mockSend).toHaveBeenCalled()
    expect(mockJournal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'sess-1' }) }),
    )
  })

  it('rejects foreign sessions (IDOR)', async () => {
    mockJournal.findUnique.mockResolvedValue({ ...SESSION, userId: 'other-user' })
    const bytes = new TextEncoder().encode('x')
    const md5 = createHash('md5').update(bytes).digest('hex')
    const res = await partPOST(
      bytesReq('http://x/api/ia/part', bytes, { 'x-ia-session': 'sess-1', 'x-ia-part': '1', 'x-ia-md5': md5 }),
    )
    expect(res.status).toBe(403)
  })
})

describe('GET /api/ia/status (resume)', () => {
  it('returns the journal part map so the client skips uploaded parts', async () => {
    mockJournal.findUnique.mockResolvedValue({ ...SESSION, status: 'parts', parts: { 1: 'aaa', 2: 'bbb' } })
    const res = await statusGET(
      new NextRequest('http://x/api/ia/status?session=sess-1', { method: 'GET' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.parts).toEqual({ 1: 'aaa', 2: 'bbb' })
    expect(body.data.totalParts).toBe(3)
  })
})

describe('POST /api/ia/complete', () => {
  it('refuses when parts are missing', async () => {
    const res = await completePOST(jsonReq('http://x/api/ia/complete', { sessionId: 'sess-1' }))
    expect(res.status).toBe(422)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('polls metadata until assembled, records usage, completes journal', async () => {    mockJournal.findUnique.mockResolvedValue({
      ...SESSION,
      status: 'parts',
      parts: { 1: 'aaa', 2: 'bbb', 3: 'ccc' },
    })
    const g = globalThis as unknown as { fetch: jest.Mock }
    const realFetch = globalThis.fetch
    g.fetch = jest.fn()
    ;(g.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ name: 'other' }] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ name: 'u-9/mod-1-file.zip', size: '12000000' }] }),
      })
    try {
      const res = await completePOST(jsonReq('http://x/api/ia/complete', { sessionId: 'sess-1' }))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.downloadUrl).toMatch(/^https:\/\/archive\.org\/download\//)
      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'ia', bytes: 12000000 }),
      )
      expect(mockJournal.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'complete' }) }),
      )
    } finally {
      globalThis.fetch = realFetch
    }
  }, 20000)
})

describe('POST /api/ia/abort', () => {
  it('aborts the IA multipart and marks the journal aborted', async () => {
    const res = await abortPOST(jsonReq('http://x/api/ia/abort', { sessionId: 'sess-1' }))
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalled()
    expect(mockJournal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'aborted' }) }),
    )
  })
})

describe('Dashboard wiring (static — Uppy is ESM-only under jest)', () => {
  const ROOT = path.resolve(__dirname, '..')
  const src = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

  it('multipart runs through Dashboard only (no XHR, no custom progress)', () => {
    const mgr = src('components/creator/ia-uploader.tsx')
    expect(mgr).toContain("mode?: 'direct' | 'relay' | 'multipart'")
    expect(mgr).toMatch(/if \(!isMultipart\)/)
    expect(mgr).toContain('setFileState')
    expect(mgr).toContain('bytesUploaded')
    expect(mgr).not.toMatch(/<progress/)
  })

  it('pause/resume/retry/cancel drive the journal-backed controller', () => {
    const mgr = src('components/creator/ia-uploader.tsx')
    expect(mgr).toContain("uppy.on('upload-pause'")
    expect(mgr).toContain("uppy.on('resume-all'")
    expect(mgr).toContain("uppy.on('file-removed'")
    expect(mgr).toContain('createMultipartController')
    expect(mgr).toContain('/api/ia/status?session=')
    expect(mgr).toContain("fetch('/api/ia/complete'")
  })

  it('mod form exposes the multipart mode via env only', () => {
    const files = src('components/creator/mod-form/files.tsx')
    expect(files).toContain('NEXT_PUBLIC_IA_UPLOAD_MODE')
    expect(files).toContain("=== 'multipart' ? 'multipart'")
    expect(files).not.toMatch(/IA_ACCESS_KEY|IA_SECRET_KEY/)
  })

  it('multipart copy exists in ar + en + types', () => {
    for (const f of ['lib/studio-i18n/ar.ts', 'lib/studio-i18n/en.ts', 'lib/studio-i18n/types.ts']) {
      const dict = src(f)
      expect(dict).toContain('multipartFailed')
      expect(dict).toContain('sessionExpired')
    }
  })
})

describe('client bundle secrecy', () => {  const ROOT = path.resolve(__dirname, '..')
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

  it('no LOW secret reaches client code', () => {
    for (const f of ['lib/ia-multipart-client.ts', 'components/creator/ia-uploader.tsx']) {
      const src = read(f)
      expect(src).not.toMatch(/IA_SECRET_KEY/)
      expect(src).not.toMatch(/secretAccessKey/i)
      expect(src).not.toMatch(/-low(?::|@)/)
    }
  })
})
