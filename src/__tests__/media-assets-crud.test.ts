/**
 * Media Assets CRUD API tests (mocked auth/db — no network, no real DB).
 */

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

const mockRequireManager = jest.fn()
const mockRequireAdmin = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireManager: (...a: unknown[]) => mockRequireManager(...a),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}))

const mockMediaAsset = {
  count: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}
jest.mock('@/lib/db', () => ({
  db: { mediaAsset: mockMediaAsset },
}))

import { GET as listGET, POST } from '@/app/api/admin/media/route'
import { GET as itemGET, PATCH, DELETE } from '@/app/api/admin/media/[id]/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function authError(message: string, status: number) {
  const e = new Error(message) as Error & { status: number }
  e.name = 'AuthError'
  e.status = status
  return e
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const MANAGER = { id: 'mgr-1', role: 'manager' }

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireManager.mockResolvedValue(MANAGER)
  mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' })
  mockMediaAsset.count.mockResolvedValue(0)
  mockMediaAsset.findMany.mockResolvedValue([])
  mockMediaAsset.findUnique.mockResolvedValue(null)
  mockMediaAsset.create.mockResolvedValue({ id: 'new-1' })
  mockMediaAsset.update.mockResolvedValue({ id: 'a1' })
  mockMediaAsset.delete.mockResolvedValue({ id: 'a1' })
})

describe('media assets CRUD', () => {
  it('GET list returns paginated and excludes soft-deleted', async () => {
    mockMediaAsset.count.mockResolvedValue(1)
    mockMediaAsset.findMany.mockResolvedValue([{ id: 'a1', deletedAt: null }])
    const req = new NextRequest('http://x/api/admin/media?page=1&limit=10')
    const res = await listGET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.pagination.total).toBe(1)
    expect(mockMediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    )
  })

  it('GET list filters by type and tag', async () => {
    const req = new NextRequest('http://x/api/admin/media?type=image&tag=foo')
    await listGET(req)
    expect(mockMediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, type: 'image', tags: { has: 'foo' } } }),
    )
  })

  it('POST creates asset with valid data', async () => {
    const req = new NextRequest('http://x/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://x/img.png', type: 'image', size: 100, tags: ['a'] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockMediaAsset.create).toHaveBeenCalled()
  })

  it('POST rejects invalid type with 400', async () => {
    const req = new NextRequest('http://x/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://x/img.png', type: 'exe', size: 100 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST rejects size over 50MB with 400', async () => {
    const req = new NextRequest('http://x/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://x/img.png', type: 'image', size: 60 * 1024 * 1024 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST requires manager (403 when forbidden)', async () => {
    mockRequireManager.mockRejectedValueOnce(authError('Forbidden', 403))
    const req = new NextRequest('http://x/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://x/img.png', type: 'image', size: 100 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('GET by id returns asset', async () => {
    mockMediaAsset.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null })
    const req = new NextRequest('http://x/api/admin/media/a1')
    const res = await itemGET(req, params('a1'))
    expect(res.status).toBe(200)
  })

  it('PATCH updates asset', async () => {
    mockMediaAsset.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null })
    const req = new NextRequest('http://x/api/admin/media/a1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://x/new.png' }),
    })
    const res = await PATCH(req, params('a1'))
    expect(res.status).toBe(200)
    expect(mockMediaAsset.update).toHaveBeenCalled()
  })

  it('DELETE soft-deletes by default', async () => {
    mockMediaAsset.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null })
    const req = new NextRequest('http://x/api/admin/media/a1', { method: 'DELETE' })
    const res = await DELETE(req, params('a1'))
    expect(res.status).toBe(200)
    expect(mockMediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    )
  })

  it('DELETE hard-deletes when ?hard=1 and admin', async () => {
    mockMediaAsset.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null })
    const req = new NextRequest('http://x/api/admin/media/a1?hard=1', { method: 'DELETE' })
    const res = await DELETE(req, params('a1'))
    expect(res.status).toBe(200)
    expect(mockMediaAsset.delete).toHaveBeenCalled()
  })

  it('DELETE hard returns 403 for non-admin', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'mod-1', role: 'moderator' })
    mockRequireManager.mockResolvedValue({ id: 'mod-1', role: 'moderator' })
    mockMediaAsset.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null })
    const req = new NextRequest('http://x/api/admin/media/a1?hard=1', { method: 'DELETE' })
    const res = await DELETE(req, params('a1'))
    expect(res.status).toBe(403)
  })
})
