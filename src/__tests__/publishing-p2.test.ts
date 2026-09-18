/**
 * P2 publishing system tests (mocked — no network, no real DB).
 * Covers: 60MB unified cap, oEmbed service + route fallback,
 * new YouTube URL patterns, GameCard slug links, platform display
 * names, dimension validation.
 */
import { MAX_IMAGE_BYTES } from '@/app/api/storage/upload-image/route'
import {
  buildOEmbedMetadata,
  extractYouTubeId,
  POST as youtubePOST,
} from '@/app/api/youtube/metadata/route'
import { getGameHref } from '@/components/game-card'
import {
  checkImageDimensions,
  getImageDimensions,
} from '@/lib/image-dims'
import { fetchOEmbedData } from '@/lib/oembed'
import { platformDisplayName } from '@/lib/platform-names'

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }))

// upload-image route pulls the real auth chain (module-level JWT check)
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
  requireModerator: jest.fn(),
  getSession: jest.fn(),
}))

const mockVideoCache = {
  findUnique: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
}
jest.mock('@/lib/db', () => ({
  db: { videoMetadataCache: {
    findUnique: (...a: unknown[]) => mockVideoCache.findUnique(...a),
    delete: (...a: unknown[]) => mockVideoCache.delete(...a),
    upsert: (...a: unknown[]) => mockVideoCache.upsert(...a),
  } },
}))

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

// ---------- 1. unified 60MB cap ----------

describe('unified image cap', () => {
  it('upload-image route enforces 60MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(60 * 1024 * 1024)
  })
})

// ---------- 2. oEmbed service ----------

describe('fetchOEmbedData', () => {
  const okFetch = (body: unknown) =>
    jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })

  it('returns title/author/thumbnail on success', async () => {
    const data = await fetchOEmbedData(
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      10_000,
      okFetch({ title: 'Big Buck Bunny', author_name: 'Blender', thumbnail_url: 'https://i.ytimg.com/vi/x/hq.jpg' }) as unknown as typeof fetch,
    )
    expect(data).toEqual({
      title: 'Big Buck Bunny',
      author_name: 'Blender',
      thumbnail_url: 'https://i.ytimg.com/vi/x/hq.jpg',
      provider: 'youtube',
    })
  })

  it('returns null on non-200', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    await expect(fetchOEmbedData('https://www.youtube.com/watch?v=aqz-KE-bpKQ', 10_000, fetchFn)).resolves.toBeNull()
  })

  it('returns null on missing title', async () => {
    const data = await fetchOEmbedData(
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      10_000,
      okFetch({ author_name: 'x' }) as unknown as typeof fetch,
    )
    expect(data).toBeNull()
  })

  it('returns null when fetch throws (timeout/network)', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch
    await expect(fetchOEmbedData('https://www.youtube.com/watch?v=aqz-KE-bpKQ', 10_000, fetchFn)).resolves.toBeNull()
  })
})

describe('buildOEmbedMetadata', () => {
  it('fills basic fields, zeroes stats, flags source', () => {
    const meta = buildOEmbedMetadata(
      { title: 'T', author_name: 'C', thumbnail_url: 'https://img/t.jpg' },
      'aqz-KE-bpKQ',
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    )
    expect(meta).toMatchObject({
      title: 'T',
      channel: 'C',
      thumbnail: 'https://img/t.jpg',
      duration: '',
      views: 0,
      likes: 0,
      commentsCount: 0,
      description: '',
      publishedAt: null,
      source: 'oembed',
    })
  })

  it('falls back to img.youtube.com thumbnail when missing', () => {
    const meta = buildOEmbedMetadata(
      { title: 'T', author_name: '', thumbnail_url: '' },
      'aqz-KE-bpKQ',
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    )
    expect(meta.thumbnail).toBe('https://img.youtube.com/vi/aqz-KE-bpKQ/hqdefault.jpg')
  })
})

// ---------- 3. route fallback (yt-dlp fails → oEmbed) ----------

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

describe('POST /api/youtube/metadata fallback', () => {
  const realFetch = global.fetch

  beforeEach(() => {
    mockVideoCache.findUnique.mockResolvedValue(null)
    mockVideoCache.upsert.mockResolvedValue({})
  })

  afterEach(() => {
    global.fetch = realFetch
  })

  it('returns oembed partial data when yt-dlp fails but oEmbed succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ title: 'Fallback Title', author_name: 'Fallback Ch', thumbnail_url: 'https://i.ytimg.com/f.jpg' }),
    }) as unknown as typeof fetch

    const req = new NextRequest('http://x/api/youtube/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }),
    })
    const res = await youtubePOST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.source).toBe('oembed')
    expect(json.data.title).toBe('Fallback Title')
    expect(json.data.channel).toBe('Fallback Ch')
  })

  it('returns the classified yt-dlp error when both fail', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch

    const req = new NextRequest('http://x/api/youtube/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }),
    })
    const res = await youtubePOST(req)
    expect(res.status).not.toBe(200)
    const json = await res.json()
    expect(typeof json.error?.message).toBe('string')
  })
})

// ---------- 4. URL patterns ----------

describe('extractYouTubeId patterns', () => {
  const cases: Array<[string, string | null]> = [
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtu.be/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/embed/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/shorts/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://music.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/live/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/v/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://example.com/not-a-video', null],
    ['https://www.youtube.com/channel/UCxxxx', null],
  ]
  it.each(cases)('%p → %p', (url, id) => {
    expect(extractYouTubeId(url)).toBe(id)
  })
})

// ---------- 5. GameCard slug links ----------

describe('getGameHref', () => {
  it('links to /games/<slug> (no platform collision)', () => {
    expect(getGameHref({ slug: 'elden-ring' })).toBe('/games/elden-ring')
    expect(getGameHref({ slug: 'god-of-war' })).not.toContain('/platform/')
  })
})

// ---------- 6. platform display names ----------

describe('platformDisplayName', () => {
  it('shows English + Arabic without changing the code', () => {
    expect(platformDisplayName('PS5')).toBe('PlayStation 5 (بلايستيشن 5)')
    expect(platformDisplayName('NS')).toBe('Nintendo Switch (ننتندو سويتش)')
    expect(platformDisplayName('PC')).toBe('PC (حاسوب)')
  })

  it('falls back to the raw code for unknown platforms', () => {
    expect(platformDisplayName('PS9')).toBe('PS9')
  })
})

// ---------- 7. dimension validation ----------

describe('checkImageDimensions', () => {
  it('rejects images below 200×200 with an Arabic error', () => {
    const out = checkImageDimensions({ width: 100, height: 100 })
    expect(out.ok).toBe(false)
    expect(out.error).toMatch(/200×200/)
  })

  it('accepts normal images without warnings', () => {
    expect(checkImageDimensions({ width: 800, height: 600 })).toEqual({ ok: true })
  })

  it('warns (not errors) for banners below 1200×630', () => {
    const out = checkImageDimensions({ width: 800, height: 600 }, 'banner')
    expect(out.ok).toBe(true)
    expect(out.warning).toMatch(/1200/)
  })

  it('never blocks when dimensions are unreadable', () => {
    expect(checkImageDimensions(null)).toEqual({ ok: true })
  })
})

describe('getImageDimensions', () => {
  it('returns null without DOM bitmap support', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    await expect(getImageDimensions(blob)).resolves.toBeNull()
  })
})
