/**
 * P3 publishing system tests (mocked — no network, no real DB).
 * Covers: Vimeo oEmbed + URL detection, video cache read/write/admin,
 * bulk delete, storage stats, type filter, embed codes, mod relations,
 * dict cleanup.
 */
import {
  buildVimeoMetadata,
  extractVideoId,
  POST as youtubePOST,
} from '@/app/api/youtube/metadata/route'
import { POST as bulkDeletePOST } from '@/app/api/admin/files/bulk-delete/route'
import { GET as storageStatsGET } from '@/app/api/admin/files/storage-stats/route'
import { buildEmbedCode, POST as embedCodePOST } from '@/app/api/creator/files/embed-code/route'
import { GET as videoCacheGET, DELETE as videoCacheDELETE } from '@/app/api/admin/video-cache/route'
import {
  detectVideoProvider,
  extractVimeoId,
  fetchVimeoOEmbedData,
  isSupportedVideoUrl,
  isVimeoUrl,
} from '@/lib/oembed'
import { extractYouTubeId } from '@/app/api/youtube/metadata/route'
import { fileCategory, fileCategoryWhere } from '@/lib/file-types'
import { stripModRelations, syncModRelations } from '@/lib/mod-relations'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

// ---------- module mocks ----------

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }))

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return { ...actual, after: jest.fn((fn: () => unknown) => fn()) }
})
import { after as mockAfter } from 'next/server'

jest.mock('node:child_process', () => {
  const actual = jest.requireActual('node:child_process')
  return {
    ...actual,
    spawn: () => ({
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: (ev: string, cb: (code: number) => void) => {
        if (ev === 'close') cb(1)
      },
      kill: jest.fn(),
    }),
  }
})

const mockSession = jest.fn()
const mockModerator = jest.fn()
const mockStudio = jest.fn()
jest.mock('@/lib/auth', () => ({
  getSession: (...a: unknown[]) => mockSession(...a),
  requireModerator: (...a: unknown[]) => mockModerator(...a),
  requireCreatorStudio: (...a: unknown[]) => mockStudio(...a),
}))

const mockDeleteAsset = jest.fn()
jest.mock('@/lib/file-delete', () => ({
  deleteUploadAsset: (...a: unknown[]) => mockDeleteAsset(...a),
}))

const mockCache = { findUnique: jest.fn(), delete: jest.fn(), upsert: jest.fn(), count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() }
const mockAsset = { findUnique: jest.fn(), count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() }
const mockLink = { deleteMany: jest.fn() }
const mockDaily = { findMany: jest.fn() }
const mockUserDb = { findMany: jest.fn() }
const mockAudit = { create: jest.fn() }
jest.mock('@/lib/db', () => ({
  db: {
    videoMetadataCache: {
      findUnique: (...a: unknown[]) => mockCache.findUnique(...a),
      delete: (...a: unknown[]) => mockCache.delete(...a),
      upsert: (...a: unknown[]) => mockCache.upsert(...a),
      count: (...a: unknown[]) => mockCache.count(...a),
      findMany: (...a: unknown[]) => mockCache.findMany(...a),
      deleteMany: (...a: unknown[]) => mockCache.deleteMany(...a),
    },
    uploadAsset: {
      findUnique: (...a: unknown[]) => mockAsset.findUnique(...a),
      count: (...a: unknown[]) => mockAsset.count(...a),
      aggregate: (...a: unknown[]) => mockAsset.aggregate(...a),
      groupBy: (...a: unknown[]) => mockAsset.groupBy(...a),
      findMany: (...a: unknown[]) => mockAsset.findMany(...a),
    },
    modFileLink: { deleteMany: (...a: unknown[]) => mockLink.deleteMany(...a) },
    uploadUsageDaily: { findMany: (...a: unknown[]) => mockDaily.findMany(...a) },
    user: { findMany: (...a: unknown[]) => mockUserDb.findMany(...a) },
    auditLog: { create: (...a: unknown[]) => mockAudit.create(...a) },
  },
}))

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function postReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function getReq(url: string) {
  return new NextRequest(url, { method: 'GET' })
}
function deleteReq(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------- 1. Vimeo detection ----------

describe('Vimeo URL detection', () => {
  const cases: Array<[string, string | null]> = [
    ['https://vimeo.com/123456789', '123456789'],
    ['https://vimeo.com/channels/staffpicks/123456789', '123456789'],
    ['https://vimeo.com/groups/shorts/videos/123456789', '123456789'],
    ['https://player.vimeo.com/video/123456789', '123456789'],
    ['https://vimeo.com/abc', null],
    ['https://example.com/123456789', null],
  ]
  it.each(cases)('extractVimeoId(%p) → %p', (url, id) => {
    expect(extractVimeoId(url)).toBe(id)
  })

  it('detectVideoProvider routes youtube vs vimeo', () => {
    expect(detectVideoProvider('https://www.youtube.com/watch?v=aqz-KE-bpKQ', extractYouTubeId)).toEqual({
      provider: 'youtube',
      id: 'aqz-KE-bpKQ',
    })
    expect(detectVideoProvider('https://vimeo.com/123456789', extractYouTubeId)).toEqual({
      provider: 'vimeo',
      id: '123456789',
    })
    expect(detectVideoProvider('https://example.com/x', extractYouTubeId)).toBeNull()
  })

  it('extractVideoId (route) supports both providers', () => {
    expect(extractVideoId('https://vimeo.com/123456789')).toEqual({ provider: 'vimeo', id: '123456789' })
    expect(extractVideoId('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toEqual({ provider: 'youtube', id: 'aqz-KE-bpKQ' })
    expect(extractVideoId('https://example.com/nope')).toBeNull()
  })

  it('client pre-check accepts vimeo, rejects junk', () => {
    expect(isSupportedVideoUrl('https://vimeo.com/123456789')).toBe(true)
    expect(isSupportedVideoUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe(true)
    expect(isSupportedVideoUrl('https://example.com/x')).toBe(false)
    expect(isVimeoUrl('https://vimeo.com/123456789')).toBe(true)
    expect(isVimeoUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe(false)
  })
})

// ---------- 2. Vimeo oEmbed ----------

describe('fetchVimeoOEmbedData', () => {
  it('returns title/author/thumbnail/duration', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'V', author_name: 'A', thumbnail_url: 'https://i.vimeocdn.com/t.jpg', duration: 65 }),
    }) as unknown as typeof fetch
    const data = await fetchVimeoOEmbedData('https://vimeo.com/123456789', 10_000, fetchFn)
    expect(data).toMatchObject({ title: 'V', author_name: 'A', duration: 65, provider: 'vimeo' })
  })

  it('returns null on failure', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    await expect(fetchVimeoOEmbedData('https://vimeo.com/123456789', 10_000, fetchFn)).resolves.toBeNull()
  })
})

describe('buildVimeoMetadata', () => {
  it('formats duration + flags provider/source', () => {
    const meta = buildVimeoMetadata(
      { title: 'V', author_name: 'A', thumbnail_url: 'https://i.vimeocdn.com/t.jpg', duration: 65 },
      '123456789',
      'https://vimeo.com/123456789',
    )
    expect(meta).toMatchObject({
      title: 'V',
      channel: 'A',
      duration: '1:05',
      views: 0,
      source: 'oembed',
      provider: 'vimeo',
    })
  })
})

describe('POST vimeo path', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  it('serves vimeo via oEmbed without yt-dlp', async () => {
    mockCache.findUnique.mockResolvedValue(null)
    mockCache.upsert.mockResolvedValue({})
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'V', author_name: 'A', thumbnail_url: 'https://i.vimeocdn.com/t.jpg', duration: 65 }),
    }) as unknown as typeof fetch

    const res = await youtubePOST(
      postReq('http://x/api/youtube/metadata', { url: 'https://vimeo.com/123456789' }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.provider).toBe('vimeo')
    expect(json.data.duration).toBe('1:05')
  })

  it('rejects unsupported URLs with Arabic 422', async () => {
    const res = await youtubePOST(postReq('http://x/api/youtube/metadata', { url: 'https://example.com/x' }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(JSON.stringify(json)).toMatch(/يوتيوب وفيميو/)
  })
})

// ---------- 3. video cache ----------

describe('video metadata cache', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  const freshRow = {
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    provider: 'youtube',
    videoId: 'aqz-KE-bpKQ',
    title: 'Cached',
    description: null,
    channel: 'Ch',
    thumbnail: 'https://img/t.jpg',
    duration: '1:00',
    views: 10,
    likes: 2,
    comments: 1,
    publishedAt: null,
    source: 'yt-dlp',
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
  }

  it('serves fresh cache without fetching', async () => {
    mockCache.findUnique.mockResolvedValue(freshRow)
    const res = await youtubePOST(
      postReq('http://x/api/youtube/metadata', { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.title).toBe('Cached')
    expect(json.data.cached).toBe(true)
  })

  it('serves stale cache + schedules background refresh', async () => {
    mockCache.findUnique.mockResolvedValue({
      ...freshRow,
      fetchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    })
    const res = await youtubePOST(
      postReq('http://x/api/youtube/metadata', { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.stale).toBe(true)
    expect(mockAfter).toHaveBeenCalled()
  })

  it('stores fresh fetch on cache miss', async () => {
    mockCache.findUnique.mockResolvedValue(null)
    mockCache.upsert.mockResolvedValue({})
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'O', author_name: 'C', thumbnail_url: 'https://i.ytimg.com/o.jpg' }),
    }) as unknown as typeof fetch

    const res = await youtubePOST(
      postReq('http://x/api/youtube/metadata', { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }),
    )
    expect(res.status).toBe(200)
    expect(mockCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' } }),
    )
  })
})

describe('admin video-cache endpoints', () => {
  it('GET lists with stale flags', async () => {
    mockModerator.mockResolvedValue({ id: 'm', username: 'mod', role: 'moderator' })
    mockCache.count.mockResolvedValue(1)
    mockCache.findMany.mockResolvedValue([
      { url: 'u', provider: 'youtube', videoId: 'v', fetchedAt: new Date(), expiresAt: new Date(Date.now() + 1000) },
    ])
    const res = await videoCacheGET(getReq('http://x/api/admin/video-cache'))
    expect(res.status).toBe(200)
  })

  it('DELETE clears all (admin) + audits', async () => {
    mockModerator.mockResolvedValue({ id: 'a', username: 'admin', role: 'admin' })
    mockCache.deleteMany.mockResolvedValue({ count: 3 })
    mockAudit.create.mockResolvedValue({})
    const res = await videoCacheDELETE(deleteReq('http://x/api/admin/video-cache'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.cleared).toBe(3)
  })

  it('DELETE scoped urls for non-admin moderator is forbidden', async () => {
    mockModerator.mockResolvedValue({ id: 'm', username: 'mod', role: 'moderator' })
    const res = await videoCacheDELETE(deleteReq('http://x/api/admin/video-cache', { urls: ['u'] }))
    expect(res.status).toBe(403)
  })
})

// ---------- 4. bulk delete + stats ----------

describe('POST /api/admin/files/bulk-delete', () => {
  it('deletes own+any per role, caps at 50, audits', async () => {
    mockSession.mockResolvedValue({ id: 'a', username: 'admin', role: 'admin' })
    mockAsset.findUnique
      .mockResolvedValueOnce({ id: 'f1', userId: 'u-9', provider: 'ia', originalUrl: 'u1', storageKey: 'k1', bytes: BigInt(1) })
      .mockResolvedValueOnce(null)
    mockDeleteAsset.mockResolvedValue({ remoteDeleted: true, unlinkedLinks: 0 })
    mockAudit.create.mockResolvedValue({})

    const res = await bulkDeletePOST(postReq('http://x/api/admin/files/bulk-delete', { fileIds: ['f1', 'missing'] }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.deleted).toBe(1)
    expect(json.data.failed).toBe(1)
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entity: 'file' }) }),
    )
  })

  it('rejects empty + oversized batches', async () => {
    mockSession.mockResolvedValue({ id: 'a', username: 'admin', role: 'admin' })
    const empty = await bulkDeletePOST(postReq('http://x/api/admin/files/bulk-delete', { fileIds: [] }))
    expect(empty.status).toBe(422)
    const big = await bulkDeletePOST(
      postReq('http://x/api/admin/files/bulk-delete', { fileIds: Array.from({ length: 51 }, (_, i) => `f${i}`) }),
    )
    expect(big.status).toBe(422)
  })

  it('moderator cannot bulk-delete others files', async () => {
    mockSession.mockResolvedValue({ id: 'u-1', username: 'mod1', role: 'moderator' })
    mockAsset.findUnique.mockResolvedValue({ id: 'f9', userId: 'u-2', provider: 'ia', originalUrl: 'u', storageKey: 'k', bytes: BigInt(1) })
    const res = await bulkDeletePOST(postReq('http://x/api/admin/files/bulk-delete', { fileIds: ['f9'] }))
    const json = await res.json()
    expect(json.data.deleted).toBe(0)
    expect(json.data.failed).toBe(1)
    expect(mockDeleteAsset).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/files/storage-stats', () => {
  it('returns totals, provider + category splits, largest, trend', async () => {
    mockModerator.mockResolvedValue({ id: 'm', username: 'mod', role: 'moderator' })
    mockAsset.count.mockResolvedValue(10)
    mockAsset.aggregate.mockResolvedValue({ _count: 4, _sum: { bytes: BigInt(400) } })
    mockAsset.groupBy.mockResolvedValue([{ provider: 'ia', _count: 10, _sum: { bytes: BigInt(1000) } }])
    mockAsset.findMany.mockResolvedValue([
      { id: 'l1', userId: 'u-1', originalUrl: 'https://x/f.zip', provider: 'ia', bytes: BigInt(900), mime: 'application/zip', createdAt: new Date() },
    ])
    mockDaily.findMany.mockResolvedValue([{ date: '2026-09-17', count: 2, bytes: BigInt(50) }])
    mockUserDb.findMany.mockResolvedValue([{ id: 'u-1', username: 'c1' }])

    const res = await storageStatsGET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.totalFiles).toBe(10)
    expect(json.data.byProvider[0].provider).toBe('ia')
    expect(json.data.byCategory.archive.count).toBe(4)
    expect(json.data.largest[0].username).toBe('c1')
    expect(json.data.trend).toHaveLength(1)
  })
})

// ---------- 5. type filter + embed ----------

describe('fileCategory', () => {
  const cases: Array<[string | null, string, string]> = [
    ['image/png', 'https://x/a.bin', 'image'],
    ['video/mp4', 'https://x/b.bin', 'video'],
    ['audio/mpeg', 'https://x/c.bin', 'audio'],
    ['application/zip', 'https://x/d.bin', 'archive'],
    ['application/octet-stream', 'https://archive.org/download/i/u/f.rar', 'archive'],
    [null, 'https://x/photo.webp', 'image'],
    [null, 'https://x/notes.txt', 'other'],
  ]
  it.each(cases)('(%p, %p) → %p', (mime, url, cat) => {
    expect(fileCategory(mime, url)).toBe(cat)
  })

  it('fileCategoryWhere builds prisma fragments', () => {
    expect(fileCategoryWhere('image')).toEqual({ mime: { startsWith: 'image/' } })
    const archive = fileCategoryWhere('archive') as { OR: unknown[] }
    expect(Array.isArray(archive.OR)).toBe(true)
    expect(archive.OR.length).toBeGreaterThan(5)
  })
})

describe('buildEmbedCode', () => {
  const img = 'https://example.com/a.png'
  it('html image → img tag', () => {
    expect(buildEmbedCode(img, 'image/png', 'html')).toMatch(/^<img src="[^"]+" alt="[^"]+" loading="lazy">$/)
  })
  it('markdown file → link', () => {
    expect(buildEmbedCode('https://archive.org/download/i/u/f.zip', 'application/zip', 'markdown')).toBe(
      '[f.zip](https://archive.org/download/i/u/f.zip)',
    )
  })
  it('bbcode image → img tag', () => {
    expect(buildEmbedCode(img, 'image/png', 'bbcode')).toBe(`[img]${img}[/img]`)
  })
  it('html video → video tag', () => {
    expect(buildEmbedCode('https://x/v.mp4', 'video/mp4', 'html')).toMatch(/^<video /)
  })
})

describe('POST /api/creator/files/embed-code', () => {
  it('returns code for own file', async () => {
    mockStudio.mockResolvedValue({ user: { id: 'u-1', username: 'c1', role: 'creator' }, error: null })
    mockAsset.findUnique.mockResolvedValue({ id: 'f1', userId: 'u-1', originalUrl: 'https://example.com/a.png', mime: 'image/png' })
    const res = await embedCodePOST(postReq('http://x/api/creator/files/embed-code', { fileId: 'f1', format: 'markdown' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.code).toContain('https://example.com/a.png')
  })

  it('rejects bad format + foreign files', async () => {
    mockStudio.mockResolvedValue({ user: { id: 'u-1', username: 'c1', role: 'creator' }, error: null })
    const bad = await embedCodePOST(postReq('http://x/api/creator/files/embed-code', { fileId: 'f1', format: 'pdf' }))
    expect(bad.status).toBe(422)
    mockAsset.findUnique.mockResolvedValue({ id: 'f2', userId: 'u-2', originalUrl: 'https://example.com/b.png', mime: 'image/png' })
    const foreign = await embedCodePOST(postReq('http://x/api/creator/files/embed-code', { fileId: 'f2', format: 'html' }))
    expect(foreign.status).toBe(404)
  })
})

// ---------- 6. mod relations ----------

describe('stripModRelations', () => {
  it('removes relation arrays, keeps scalars', () => {
    const out = stripModRelations({ name: 'x', files: [{ title: 'f' }], videoGroups: [] })
    expect(out).toEqual({ name: 'x' })
    expect('files' in out).toBe(false)
  })
})

describe('syncModRelations', () => {
  function fakeTx() {
    const store: Record<string, unknown[]> = { modFile: [], modFileLink: [], modVideoGroup: [], modVideo: [], modTeamMember: [], modContactLink: [], modCustomTab: [] }
    let n = 0
    return {
      store,
      modFile: {
        deleteMany: jest.fn(async () => { store.modFile = [] }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `mf-${++n}`, ...data }
          ;(store.modFile as unknown[]).push(row)
          return { id: row.id as string }
        }),
      },
      modFileLink: { createMany: jest.fn(async ({ data }: { data: unknown[] }) => { store.modFileLink.push(...data) }) },
      modVideoGroup: {
        deleteMany: jest.fn(async () => { store.modVideoGroup = [] }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `mg-${++n}`, ...data }
          ;(store.modVideoGroup as unknown[]).push(row)
          return { id: row.id as string }
        }),
      },
      modVideo: { createMany: jest.fn(async ({ data }: { data: unknown[] }) => { store.modVideo.push(...data) }) },
      modTeamMember: {
        deleteMany: jest.fn(),
        createMany: jest.fn(async ({ data }: { data: unknown[] }) => { store.modTeamMember.push(...data) }),
      },
      modContactLink: {
        deleteMany: jest.fn(),
        createMany: jest.fn(async ({ data }: { data: unknown[] }) => { store.modContactLink.push(...data) }),
      },
      modCustomTab: {
        deleteMany: jest.fn(),
        createMany: jest.fn(async ({ data }: { data: unknown[] }) => { store.modCustomTab.push(...data) }),
      },
    }
  }

  it('persists files with IA provenance + skips undefined keys', async () => {
    const tx = fakeTx()
    await syncModRelations(tx as never, 'mod-1', {
      files: [{ title: 'F', links: [{ url: 'https://archive.org/download/item/u/f.zip', label: 'IA' }, { url: 'https://drive.google.com/x' }] }],
    }, { uploadedBy: 'u-1' })
    expect(tx.store.modFile).toHaveLength(1)
    expect(tx.store.modFileLink).toHaveLength(2)
    const ia = (tx.store.modFileLink as Array<Record<string, unknown>>).find((l) => l.provider === 'ia')
    expect(ia).toMatchObject({ storageKey: 'item/u/f.zip', uploadedBy: 'u-1' })
    expect(tx.modVideoGroup.deleteMany).not.toHaveBeenCalled()
  })

  it('persists videos/members/contacts/tabs', async () => {
    const tx = fakeTx()
    await syncModRelations(tx as never, 'mod-1', {
      videoGroups: [{ name: 'G', videos: [{ title: 'V', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }] }],
      teamMembers: [{ name: 'M' }],
      contactLinks: [{ url: 'https://example.com' }],
      customTabs: [{ name: 'T' }],
    })
    expect(tx.store.modVideo).toHaveLength(1)
    expect(tx.store.modTeamMember).toHaveLength(1)
    expect(tx.store.modContactLink).toHaveLength(1)
    expect(tx.store.modCustomTab).toHaveLength(1)
  })
})

// ---------- 7. dict cleanup ----------

describe('dead i18n keys removed', () => {
  it('unofficialDefault is gone from ar/en form dicts', () => {
    expect('unofficialDefault' in ar.form).toBe(false)
    expect('unofficialDefault' in en.form).toBe(false)
  })
})
