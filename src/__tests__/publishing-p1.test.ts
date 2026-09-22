/**
 * P1 publishing system tests (mocked auth/db/S3 — no network, no real DB).
 * Covers: IA URL provenance helpers, ia/complete storageKey persistence,
 * file-list scoping (admin=all, creator=own), file delete authz,
 * translationType dropdown/normalization, video error classification.
 */
import { isIaUrl, parseIaUrl, iaStorageKey } from '@/lib/ia'
import { normalizeTranslationType, TRANSLATION_TYPE_LABELS, CreateModSchema } from '@/lib/schemas'
import { classifyYtDlpError } from '@/app/api/youtube/metadata/route'
import { extractVideoErrorMessage } from '@/lib/video-errors'

// ---------- module mocks ----------

const mockStudio = jest.fn()
const mockModerator = jest.fn()
const mockSession = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: (...a: unknown[]) => mockStudio(...a),
  requireModerator: (...a: unknown[]) => mockModerator(...a),
  getSession: (...a: unknown[]) => mockSession(...a),
}))

const mockCheck = jest.fn()
const mockRecord = jest.fn()
jest.mock('@/lib/quota', () => ({
  checkUploadQuota: (...a: unknown[]) => mockCheck(...a),
  recordUploadUsage: (...a: unknown[]) => mockRecord(...a),
}))

const mockS3Send = jest.fn()
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3')
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: (...a: unknown[]) => mockS3Send(...a) })),
  }
})

const mockDeleteAsset = jest.fn()
jest.mock('@/lib/file-delete', () => ({
  deleteUploadAsset: (...a: unknown[]) => mockDeleteAsset(...a),
}))

const mockAsset = {
  count: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
}
const mockUserDb = { findMany: jest.fn(), findUnique: jest.fn() }
const mockModDb = { findMany: jest.fn(), findUnique: jest.fn() }
jest.mock('@/lib/db', () => ({
  db: {
    uploadAsset: {
      count: (...a: unknown[]) => mockAsset.count(...a),
      findMany: (...a: unknown[]) => mockAsset.findMany(...a),
      findUnique: (...a: unknown[]) => mockAsset.findUnique(...a),
    },
    user: {
      findMany: (...a: unknown[]) => mockUserDb.findMany(...a),
      findUnique: (...a: unknown[]) => mockUserDb.findUnique(...a),
    },
    mod: {
      findMany: (...a: unknown[]) => mockModDb.findMany(...a),
      findUnique: (...a: unknown[]) => mockModDb.findUnique(...a),
    },
    modFileLink: { findMany: jest.fn(), deleteMany: jest.fn() },
  },
}))

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }))

import { POST as completePOST } from '@/app/api/storage/ia/complete/route'
import { GET as adminFilesGET } from '@/app/api/admin/files/route'
import { DELETE as adminFileDELETE } from '@/app/api/admin/files/[id]/route'
import { GET as creatorFilesGET } from '@/app/api/creator/files/route'
import { DELETE as creatorFileDELETE } from '@/app/api/creator/files/[id]/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function getReq(url: string) {
  return new NextRequest(url, { method: 'GET' })
}
function postReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function deleteReq(url: string) {
  return new NextRequest(url, { method: 'DELETE' })
}
const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) })

const USER = { id: 'u-1', username: 'creator1', email: 'c@x.test', role: 'creator' }

beforeEach(() => {
  jest.clearAllMocks()
  process.env.IA_ENABLED = 'true'
  process.env.IA_ACCESS_KEY = 'test-access'
  process.env.IA_SECRET_KEY = 'test-secret'
  process.env.IA_IDENTIFIER = 'games-arabic-mods'
})

// ---------- 1. IA URL helpers ----------

describe('IA provenance helpers', () => {
  it('detects IA download URLs', () => {
    expect(isIaUrl('https://archive.org/download/games-arabic-mods/u1/mod-1-file.zip')).toBe(true)
    expect(isIaUrl('https://drive.google.com/file/d/abc')).toBe(false)
    expect(isIaUrl('not a url')).toBe(false)
  })

  it('parses identifier + key from IA URLs', () => {
    expect(parseIaUrl('https://archive.org/download/games-arabic-mods/u1/mod-1-file.zip')).toEqual({
      identifier: 'games-arabic-mods',
      key: 'u1/mod-1-file.zip',
    })
    expect(parseIaUrl('https://drive.google.com/file/d/abc')).toBeNull()
  })

  it('builds storage keys as identifier/key', () => {
    expect(iaStorageKey('games-arabic-mods', 'u1/f.zip')).toBe('games-arabic-mods/u1/f.zip')
  })
})

// ---------- 2. ia/complete persists provenance ----------

describe('POST /api/storage/ia/complete', () => {
  it('persists storageKey + provider ia + identifier in response', async () => {
    mockStudio.mockResolvedValue({ user: USER, error: null })
    mockCheck.mockResolvedValue({ allowed: true })
    mockRecord.mockResolvedValue([])
    mockS3Send.mockResolvedValue({ ContentLength: 123 })

    const res = await completePOST(
      postReq('http://x/api/storage/ia/complete', {
        key: 'u-1/mod-1-file.zip',
        downloadUrl: 'https://archive.org/download/games-arabic-mods/u-1/mod-1-file.zip',
        bytes: 123,
        mime: 'application/zip',
        mode: 'direct',
      }),
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.storageKey).toBe('games-arabic-mods/u-1/mod-1-file.zip')
    expect(json.data.identifier).toBe('games-arabic-mods')
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ia',
        storageKey: 'games-arabic-mods/u-1/mod-1-file.zip',
        originalUrl: 'https://archive.org/download/games-arabic-mods/u-1/mod-1-file.zip',
      }),
    )
  })
})

// ---------- 3. file list scoping ----------

describe('file list scoping', () => {
  const rows = [
    { id: 'a1', userId: 'u-1', modId: null, kind: 'file', provider: 'ia', originalUrl: 'https://archive.org/download/x/u-1/f.zip', wrappedUrl: null, storageKey: 'x/u-1/f.zip', bytes: BigInt(10), mime: 'application/zip', checksum: null, createdAt: new Date() },
    { id: 'a2', userId: 'u-2', modId: null, kind: 'file', provider: 'ia', originalUrl: 'https://archive.org/download/x/u-2/g.zip', wrappedUrl: null, storageKey: 'x/u-2/g.zip', bytes: BigInt(20), mime: 'application/zip', checksum: null, createdAt: new Date() },
  ]

  it('admin sees ALL files', async () => {
    mockModerator.mockResolvedValue({ id: 'm-1', username: 'mod', role: 'moderator' })
    mockAsset.count.mockResolvedValue(2)
    mockAsset.findMany.mockResolvedValue(rows)
    mockUserDb.findMany.mockResolvedValue([])
    mockModDb.findMany.mockResolvedValue([])

    const res = await adminFilesGET(getReq('http://x/api/admin/files'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    // no userId filter applied for admin
    expect(mockAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })

  it('creator sees OWN files only', async () => {
    mockStudio.mockResolvedValue({ user: USER, error: null })
    mockAsset.count.mockResolvedValue(1)
    mockAsset.findMany.mockResolvedValue([rows[0]])
    mockModDb.findMany.mockResolvedValue([])

    const res = await creatorFilesGET(getReq('http://x/api/creator/files'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(mockAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u-1' }) }),
    )
  })
})

// ---------- 4. file delete authz ----------

describe('file delete authz', () => {
  const mine = { id: 'a1', userId: 'u-1', provider: 'ia', originalUrl: 'https://archive.org/download/x/u-1/f.zip', storageKey: 'x/u-1/f.zip', bytes: BigInt(10) }
  const others = { ...mine, id: 'a2', userId: 'u-2' }

  it('moderator can delete own file', async () => {
    mockSession.mockResolvedValue({ id: 'u-1', username: 'mod1', role: 'moderator' })
    mockAsset.findUnique.mockResolvedValue(mine)
    mockDeleteAsset.mockResolvedValue({ remoteDeleted: true, unlinkedLinks: 0 })

    const res = await adminFileDELETE(deleteReq('http://x/api/admin/files/a1'), paramsOf('a1'))
    expect(res.status).toBe(200)
    expect(mockDeleteAsset).toHaveBeenCalled()
  })

  it('moderator CANNOT delete another user file', async () => {
    mockSession.mockResolvedValue({ id: 'u-1', username: 'mod1', role: 'moderator' })
    mockAsset.findUnique.mockResolvedValue(others)

    const res = await adminFileDELETE(deleteReq('http://x/api/admin/files/a2'), paramsOf('a2'))
    expect(res.status).toBe(403)
    expect(mockDeleteAsset).not.toHaveBeenCalled()
  })

  it('admin CAN delete another user file', async () => {
    mockSession.mockResolvedValue({ id: 'a-9', username: 'admin', role: 'admin' })
    mockAsset.findUnique.mockResolvedValue(others)
    mockDeleteAsset.mockResolvedValue({ remoteDeleted: true, unlinkedLinks: 1 })

    const res = await adminFileDELETE(deleteReq('http://x/api/admin/files/a2'), paramsOf('a2'))
    expect(res.status).toBe(200)
    expect(mockDeleteAsset).toHaveBeenCalled()
  })

  it('creator can delete own file via creator route', async () => {
    mockStudio.mockResolvedValue({ user: USER, error: null })
    mockAsset.findUnique.mockResolvedValue(mine)
    mockDeleteAsset.mockResolvedValue({ remoteDeleted: true, unlinkedLinks: 0 })

    const res = await creatorFileDELETE(deleteReq('http://x/api/creator/files/a1'), paramsOf('a1'))
    expect(res.status).toBe(200)
  })

  it('creator CANNOT delete another user file (404, no enumeration)', async () => {
    mockStudio.mockResolvedValue({ user: USER, error: null })
    mockAsset.findUnique.mockResolvedValue(others)

    const res = await creatorFileDELETE(deleteReq('http://x/api/creator/files/a2'), paramsOf('a2'))
    expect(res.status).toBe(404)
    expect(mockDeleteAsset).not.toHaveBeenCalled()
  })
})

// ---------- 5. translation type ----------

describe('translationType dropdown', () => {
  it('has Arabic labels for both enum values', () => {
    expect(TRANSLATION_TYPE_LABELS.official).toBe('رسمية')
    expect(TRANSLATION_TYPE_LABELS.unofficial).toBe('غير رسمية')
  })

  it('normalizes enum + legacy Arabic values', () => {
    expect(normalizeTranslationType('official')).toBe('official')
    expect(normalizeTranslationType('unofficial')).toBe('unofficial')
    expect(normalizeTranslationType('تعريب رسمي')).toBe('official')
    expect(normalizeTranslationType('رسمية')).toBe('official')
    expect(normalizeTranslationType('تعريب غير رسمي')).toBe('unofficial')
    expect(normalizeTranslationType('')).toBe('unofficial')
    expect(normalizeTranslationType(undefined)).toBe('unofficial')
    expect(normalizeTranslationType('واجهة وأسلحة')).toBe('unofficial')
  })

  it('schema coerces legacy Arabic instead of rejecting', () => {
    const base = {
      name: 'مود تجريبي',
      headline: 'العنوان الرئيسي للاختبار',
      description: 'وصف طويل بما يكفي لاجتياز التحقق من الصحة هنا',
      thumbnailUrl: 'https://example.com/t.png',
      imageUrl: 'https://example.com/i.png',
    }
    expect(CreateModSchema.safeParse({ ...base, translationType: 'official' }).success).toBe(true)
    const legacy = CreateModSchema.safeParse({ ...base, translationType: 'تعريب رسمي' })
    expect(legacy.success).toBe(true)
    if (legacy.success) expect(legacy.data.translationType).toBe('official')
    const missing = CreateModSchema.safeParse(base)
    expect(missing.success).toBe(true)
    if (missing.success) expect(missing.data.translationType).toBe('unofficial')
  })
})

// ---------- 6. video errors ----------

describe('classifyYtDlpError', () => {
  const cases: Array<[string, string, string]> = [
    ['ERROR: Private video. Sign in if you have been granted access', 'VIDEO_PRIVATE', 'هذا الفيديو خاص ولا يمكن الوصول إليه'],
    ['ERROR: Video unavailable. This video has been removed', 'VIDEO_UNAVAILABLE', 'الفيديو غير متاح أو تم حذفه'],
    ['ERROR: Sign in to confirm your age', 'VIDEO_AGE_RESTRICTED', 'هذا الفيديو مقيّد بالعمر ولا يمكن جلب بياناته'],
    ['ERROR: HTTP Error 404: Not Found', 'VIDEO_NOT_FOUND', 'الفيديو غير موجود'],
    ['ERROR: HTTP Error 429: Too Many Requests', 'VIDEO_RATE_LIMITED', 'تم تجاوز حد الطلبات، حاول لاحقًا'],
    ['yt-dlp timeout', 'VIDEO_TIMEOUT', 'انتهت مهلة الاتصال، حاول مرة أخرى'],
    ['random extractor failure', 'VIDEO_FETCH_FAILED', 'تعذّر جلب بيانات الفيديو — تحقق من الرابط وحاول مجددًا'],
  ]
  it.each(cases)('maps %p → %p', (stderr, code, message) => {
    const out = classifyYtDlpError(new Error(stderr))
    expect(out.code).toBe(code)
    expect(out.message).toBe(message)
  })

  it('detects missing binary via ENOENT', () => {
    const err = Object.assign(new Error("spawn yt-dlp ENOENT"), { code: 'ENOENT' })
    const out = classifyYtDlpError(err)
    expect(out.code).toBe('BINARY_NOT_FOUND')
  })
})

describe('extractVideoErrorMessage', () => {
  it('prefers classified Arabic message', () => {
    expect(
      extractVideoErrorMessage({ error: { code: 'VIDEO_PRIVATE', message: 'هذا الفيديو خاص ولا يمكن الوصول إليه' } }),
    ).toBe('هذا الفيديو خاص ولا يمكن الوصول إليه')
  })

  it('digs Arabic text out of 422 validation details', () => {
    expect(
      extractVideoErrorMessage({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: { url: 'رابط يوتيوب غير صالح' } } }),
    ).toBe('رابط يوتيوب غير صالح')
  })

  it('returns null when no error present', () => {
    expect(extractVideoErrorMessage({ data: { title: 'x' } })).toBeNull()
  })
})
