/**
 * المواقع المتوافقة (CompatibleSite) — اختبارات الباك-إند.
 * تثبت: السكيما + الـ migration + تصدير الـ routes + التحقق من النطاقات + مطابقة الـ subdomain.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const mockRequireAdmin = jest.fn()
jest.mock('@/lib/auth', () => {
  class MockAuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  }
  return { AuthError: MockAuthError, requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }
})

const mockCompatibleSite = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}
jest.mock('@/lib/db', () => ({
  db: { compatibleSite: {
    findMany: (...a: unknown[]) => mockCompatibleSite.findMany(...a),
    findUnique: (...a: unknown[]) => mockCompatibleSite.findUnique(...a),
    create: (...a: unknown[]) => mockCompatibleSite.create(...a),
    update: (...a: unknown[]) => mockCompatibleSite.update(...a),
    delete: (...a: unknown[]) => mockCompatibleSite.delete(...a),
  } },
}))

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }))

import { GET, POST, sanitizeDomains } from '@/app/api/compatible-sites/route'
import { DELETE as deleteSite, PUT as putSite } from '@/app/api/compatible-sites/[id]/route'
import { isCompatibleSiteUrl } from '@/lib/download-trust'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

const root = process.cwd()
function read(p: string): string {
  return fs.readFileSync(path.join(root, p), 'utf8')
}
function postReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function putReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'a1', role: 'admin' })
})

describe('سكيما CompatibleSite', () => {
  it('الموديل وحقوله موجودة في السكيما', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toMatch(/model CompatibleSite/)
    expect(schema).toMatch(/domains/)
    expect(schema).toMatch(/logoUrl/)
    expect(schema).toMatch(/notes/)
    expect(schema).toMatch(/enabled/)
    expect(schema).toMatch(/order/)
  })

  it('ملف الـ migration موجود ويحتوي الجدول', () => {
    const dir = path.join(root, 'prisma/migrations')
    const entries = fs.readdirSync(dir).filter((d) => d.endsWith('_download_extras'))
    expect(entries.length).toBeGreaterThan(0)
    const sql = read(path.join('prisma/migrations', entries[0], 'migration.sql'))
    expect(sql).toMatch(/CREATE TABLE "CompatibleSite"/)
    expect(sql).toMatch(/CREATE TABLE "ModSiteLink"/)
    expect(sql).toMatch(/ALTER TABLE "ModFile"/)
    expect(sql).toMatch(/ALTER TABLE "Mod"/)
  })

  it('الـ routes تصدّر الدوال المطلوبة', () => {
    const listRoute = read('src/app/api/compatible-sites/route.ts')
    expect(listRoute).toMatch(/export async function GET/)
    expect(listRoute).toMatch(/export async function POST/)
    expect(listRoute).toMatch(/requireAdmin/)
    const idRoute = read('src/app/api/compatible-sites/[id]/route.ts')
    expect(idRoute).toMatch(/export async function PUT/)
    expect(idRoute).toMatch(/export async function DELETE/)
  })
})

describe('تنظيف النطاقات', () => {
  it('يرفض النطاقات الغلط', () => {
    expect(sanitizeDomains(['not a domain!!'])).toBeNull()
    expect(sanitizeDomains([])).toBeNull()
  })

  it('يقبل المفصول بفواصل وينظّف البروتوكول', () => {
    expect(sanitizeDomains('Example.COM, https://sub.example.com/path')).toEqual([
      'example.com',
      'sub.example.com',
    ])
  })
})

describe('isCompatibleSiteUrl', () => {
  it('يطابق الـ subdomain', () => {
    const sites = [{ domains: ['example.com'] }]
    expect(isCompatibleSiteUrl('https://dl.example.com/file.zip', sites)).toBe(true)
    expect(isCompatibleSiteUrl('https://example.com/x', sites)).toBe(true)
    expect(isCompatibleSiteUrl('https://evil.com/x', sites)).toBe(false)
    expect(isCompatibleSiteUrl('ftp://example.com/x', sites)).toBe(false)
  })
})

describe('GET /api/compatible-sites', () => {
  it('يرجع المفعّلة فقط مرتبة', async () => {
    mockCompatibleSite.findMany.mockResolvedValue([
      { id: '1', name: 'A', domains: ['a.com'], logoUrl: null, notes: null },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(mockCompatibleSite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enabled: true } }),
    )
    const body = await res.json()
    expect(body.data[0].name).toBe('A')
  })

  it('fail-open: يرجع data فارغة عند خطأ DB', async () => {
    mockCompatibleSite.findMany.mockRejectedValue(new Error('db down'))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

describe('POST /api/compatible-sites', () => {
  it('يرفض النطاقات الغلط (422)', async () => {
    const res = await POST(postReq('http://x/api/compatible-sites', { name: 'S', domains: ['bad!!'] }))
    expect(res.status).toBe(422)
    expect(mockCompatibleSite.create).not.toHaveBeenCalled()
  })

  it('يملأ اللوجو تلقائياً عند غيابه', async () => {
    mockCompatibleSite.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'n1', ...data }),
    )
    const res = await POST(
      postReq('http://x/api/compatible-sites', { name: 'S', domains: ['example.com'] }),
    )
    expect(res.status).toBe(200)
    expect(mockCompatibleSite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ domains: ['example.com'] }),
      }),
    )
    const created = mockCompatibleSite.create.mock.calls[0][0].data as Record<string, unknown>
    expect(String(created.logoUrl)).toMatch(/favicons/)
  })
})

describe('PUT/DELETE /api/compatible-sites/[id]', () => {
  const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) })

  it('PUT يرفض الملاحظات الطويلة', async () => {
    mockCompatibleSite.findUnique.mockResolvedValue({
      id: '1',
      name: 'S',
      domains: ['a.com'],
      logoUrl: null,
      notes: null,
      enabled: true,
      order: 0,
    })
    const res = await putSite(
      putReq('http://x/api/compatible-sites/1', { notes: 'x'.repeat(2001) }),
      paramsOf('1'),
    )
    expect(res.status).toBe(422)
  })

  it('DELETE يحذف الموجود', async () => {
    mockCompatibleSite.findUnique.mockResolvedValue({ id: '1' })
    mockCompatibleSite.delete.mockResolvedValue({})
    const req = new NextRequest('http://x/api/compatible-sites/1', { method: 'DELETE' })
    const res = await deleteSite(req, paramsOf('1'))
    expect(res.status).toBe(200)
    expect(mockCompatibleSite.delete).toHaveBeenCalledWith({ where: { id: '1' } })
  })
})
