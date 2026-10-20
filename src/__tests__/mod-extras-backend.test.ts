/**
 * إضافات التحميل (ملفات إضافية + روابط مواقع) — اختبارات الباك-إند.
 * تثبت: حقول السكيما + groupBy على linkId + تضمين children و siteLinks + حقول ModSiteLink.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const mockRequireAdmin = jest.fn()
const mockRequireAuth = jest.fn()
jest.mock('@/lib/auth', () => {
  class MockAuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  }
  return {
    AuthError: MockAuthError,
    requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
    requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  }
})

const mockMod = { findUnique: jest.fn() }
const mockModFile = { findUnique: jest.fn(), update: jest.fn() }
const mockModSiteLink = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }
const mockDownloadClick = { groupBy: jest.fn() }
jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: (...a: unknown[]) => mockMod.findUnique(...a) },
    modFile: {
      findUnique: (...a: unknown[]) => mockModFile.findUnique(...a),
      update: (...a: unknown[]) => mockModFile.update(...a),
    },
    modSiteLink: {
      findMany: (...a: unknown[]) => mockModSiteLink.findMany(...a),
      findUnique: (...a: unknown[]) => mockModSiteLink.findUnique(...a),
      create: (...a: unknown[]) => mockModSiteLink.create(...a),
      update: (...a: unknown[]) => mockModSiteLink.update(...a),
      delete: (...a: unknown[]) => mockModSiteLink.delete(...a),
    },
    downloadClick: { groupBy: (...a: unknown[]) => mockDownloadClick.groupBy(...a) },
  },
}))

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }))
jest.mock('@/lib/counters', () => ({ recordModView: jest.fn().mockResolvedValue(undefined) }))

import { GET as modGET } from '@/app/api/mods/[slug]/route'
import { POST as siteLinkPOST } from '@/app/api/admin/mod-site-links/route'
import { PUT as modFilePUT } from '@/app/api/admin/mod-files/[id]/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

const root = process.cwd()
function read(p: string): string {
  return fs.readFileSync(path.join(root, p), 'utf8')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'a1', role: 'admin' })
})

describe('سكيما الإضافات', () => {
  it('parentId و extrasLabel وعلاقة FileExtras موجودة', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toMatch(/model ModFile/)
    expect(schema).toMatch(/parentId/)
    expect(schema).toMatch(/extrasLabel/)
    expect(schema).toMatch(/FileExtras/)
    expect(schema).toMatch(/@@index\(\[parentId\]\)/)
  })

  it('موديلا CompatibleSite و ModSiteLink وحقول siteLinks موجودة', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toMatch(/model CompatibleSite/)
    expect(schema).toMatch(/model ModSiteLink/)
    expect(schema).toMatch(/siteLinks/)
    expect(schema).toMatch(/pageTitle/)
    expect(schema).toMatch(/@@index\(\[modId\]\)/)
    expect(schema).toMatch(/@@index\(\[fileId\]\)/)
  })

  it('أنواع types.ts موسّعة', () => {
    const types = read('src/lib/types.ts')
    expect(types).toMatch(/children\?: ModFile\[\]/)
    expect(types).toMatch(/extrasLabel\?:/)
    expect(types).toMatch(/downloadsCount\?: number/)
    expect(types).toMatch(/interface CompatibleSite/)
    expect(types).toMatch(/interface ModSiteLink/)
  })

  it('دالة isCompatibleSiteUrl ونوعها موجودان دون كسر القديم', () => {
    const lib = read('src/lib/download-trust.ts')
    expect(lib).toMatch(/isCompatibleSiteUrl/)
    expect(lib).toMatch(/CompatibleSiteInfo/)
    expect(lib).toMatch(/isTrustedDownloadUrl/)
  })
})

describe('route المود GET /api/mods/[slug]', () => {
  it('يستخدم groupBy على linkId ويضمّن children و siteLinks', () => {
    const route = read('src/app/api/mods/[slug]/route.ts')
    expect(route).toMatch(/downloadClick\.groupBy/)
    expect(route).toMatch(/by: \['linkId'\]/)
    expect(route).toMatch(/children/)
    expect(route).toMatch(/siteLinks/)
    expect(route).toMatch(/extrasLabel/)
    expect(route).toMatch(/downloadsCount/)
  })

  it('يلحق downloadsCount بكل رابط ويضمّن الأبناء و siteLinks', async () => {
    const modRow = {
      id: 'mod-1',
      slug: 'm',
      authorId: 'u1',
      workflowStatus: 'PUBLISHED',
      extrasLabel: null,
      files: [
        {
          id: 'f1',
          links: [{ id: 'l1', url: 'https://x/1' }],
          children: [{ id: 'c1', links: [{ id: 'l2', url: 'https://x/2' }] }],
        },
      ],
    }
    mockMod.findUnique.mockResolvedValue(modRow)
    // groupBy الأول للملفات، الثاني للروابط
    mockDownloadClick.groupBy
      .mockResolvedValueOnce([{ fileId: 'f1', _count: { _all: 5 } }])
      .mockResolvedValueOnce([
        { linkId: 'l1', _count: { _all: 3 } },
        { linkId: 'l2', _count: { _all: 7 } },
      ])
    mockModSiteLink.findMany.mockResolvedValue([
      { id: 's1', modId: 'mod-1', fileId: null, url: 'https://site/x' },
    ])
    const req = new NextRequest('http://x/api/mods/m')
    const res = await modGET(req, { params: Promise.resolve({ slug: 'm' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.files[0].downloadsCount).toBe(5)
    expect(body.data.files[0].links[0].downloadsCount).toBe(3)
    expect(body.data.files[0].children[0].links[0].downloadsCount).toBe(7)
    expect(body.data.siteLinks).toHaveLength(1)
  })

  it('fail-open: أصفار عند فشل التجميع', async () => {
    const modRow = {
      id: 'mod-1',
      slug: 'm',
      authorId: 'u1',
      workflowStatus: 'PUBLISHED',
      extrasLabel: 'إضافات',
      files: [{ id: 'f1', links: [{ id: 'l1', url: 'https://x/1' }], children: [] }],
    }
    mockMod.findUnique.mockResolvedValue(modRow)
    mockDownloadClick.groupBy.mockRejectedValue(new Error('db down'))
    mockModSiteLink.findMany.mockRejectedValue(new Error('db down'))
    const req = new NextRequest('http://x/api/mods/m')
    const res = await modGET(req, { params: Promise.resolve({ slug: 'm' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.files[0].downloadsCount).toBe(0)
    expect(body.data.files[0].links[0].downloadsCount).toBe(0)
    expect(body.data.siteLinks).toEqual([])
    expect(body.data.extrasLabel).toBe('إضافات')
  })
})

describe('POST /api/admin/mod-site-links', () => {
  function post(body: unknown) {
    return new NextRequest('http://x/api/admin/mod-site-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('يرفض الرابط غير http/https', async () => {
    mockMod.findUnique.mockResolvedValue({ id: 'mod-1' })
    const res = await siteLinkPOST(post({ modId: 'mod-1', url: 'ftp://x/y' }))
    expect(res.status).toBe(422)
    expect(mockModSiteLink.create).not.toHaveBeenCalled()
  })

  it('يستخرج النطاق تلقائياً عند غيابه', async () => {
    mockMod.findUnique.mockResolvedValue({ id: 'mod-1' })
    mockModSiteLink.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 's1', ...data }),
    )
    const res = await siteLinkPOST(post({ modId: 'mod-1', url: 'https://Sub.Example.com/page' }))
    expect(res.status).toBe(200)
    const data = mockModSiteLink.create.mock.calls[0][0].data as Record<string, unknown>
    expect(data.domain).toBe('sub.example.com')
  })
})

describe('PUT /api/admin/mod-files/[id]', () => {
  const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) })
  function put(body: unknown) {
    return new NextRequest('http://x/api/admin/mod-files/f1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('يرفض parentId يساوي نفسه', async () => {
    mockModFile.findUnique.mockResolvedValue({ id: 'f1', modId: 'mod-1' })
    const res = await modFilePUT(put({ parentId: 'f1' }), paramsOf('f1'))
    expect(res.status).toBe(422)
    expect(mockModFile.update).not.toHaveBeenCalled()
  })

  it('يرفض parentId من مود آخر', async () => {
    mockModFile.findUnique
      .mockResolvedValueOnce({ id: 'f1', modId: 'mod-1' })
      .mockResolvedValueOnce({ id: 'p1', modId: 'mod-2' })
    const res = await modFilePUT(put({ parentId: 'p1' }), paramsOf('f1'))
    expect(res.status).toBe(422)
  })

  it('يقبل extrasLabel ويفك الارتباط بـ null', async () => {
    mockModFile.findUnique.mockResolvedValue({ id: 'f1', modId: 'mod-1' })
    mockModFile.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'f1', ...data }),
    )
    const res = await modFilePUT(put({ parentId: null, extrasLabel: 'ملفات إضافية' }), paramsOf('f1'))
    expect(res.status).toBe(200)
    expect(mockModFile.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: expect.objectContaining({ parentId: null, extrasLabel: 'ملفات إضافية' }),
    })
  })
})
