/**
 * Tests for Template Admin API Routes
 * Tests GET/POST /api/admin/templates, PUT/DELETE /api/admin/templates/[id], POST preview
 */

// Mock dependencies before imports
jest.mock('@/lib/db', () => ({
  db: {
    notificationTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireManager: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'manager' }),
}))

import { NextRequest } from 'next/server'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST as previewPOST } from '../[id]/preview/route'
import { DELETE, PUT } from '../[id]/route'
import { GET, POST } from '../route'

const mockRequireManager = requireManager as jest.Mock

const mockDb = db as unknown as {
  notificationTemplate: {
    findMany: jest.Mock
    findUnique: jest.Mock
    count: jest.Mock
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
}

function makeReq(url: string, method = 'GET', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

describe('GET /api/admin/templates', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should return templates list', async () => {
    mockDb.notificationTemplate.findMany.mockResolvedValue([
      {
        id: '1',
        type: 'comment_reply',
        channel: 'in_app',
        titleTemplate: 'test',
        bodyTemplate: 'body',
        variables: [],
        isActive: true,
        version: 1,
      },
    ])
    mockDb.notificationTemplate.count.mockResolvedValue(1)

    const req = makeReq('http://localhost/api/admin/templates')
    const res = await GET(req)
    const data = await res.json()

    expect(data.data).toHaveLength(1)
    expect(data.pagination.total).toBe(1)
  })

  it('should filter by type', async () => {
    mockDb.notificationTemplate.findMany.mockResolvedValue([])
    mockDb.notificationTemplate.count.mockResolvedValue(0)

    const req = makeReq('http://localhost/api/admin/templates?type=like')
    await GET(req)

    expect(mockDb.notificationTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'like' }),
      }),
    )
  })

  it('should filter by channel', async () => {
    mockDb.notificationTemplate.findMany.mockResolvedValue([])
    mockDb.notificationTemplate.count.mockResolvedValue(0)

    const req = makeReq('http://localhost/api/admin/templates?channel=email')
    await GET(req)

    expect(mockDb.notificationTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ channel: 'email' }),
      }),
    )
  })

  it('should return 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )

    const res = await GET(makeReq('http://localhost/api/admin/templates'))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
    expect(mockDb.notificationTemplate.findMany).not.toHaveBeenCalled()
  })

  it('should return 403 when the caller is not a manager', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden — manager access required'), { status: 403 }),
    )

    const res = await GET(makeReq('http://localhost/api/admin/templates'))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('should fall back to page 1 / limit 50 for unparseable pagination', async () => {
    mockDb.notificationTemplate.findMany.mockResolvedValue([])
    mockDb.notificationTemplate.count.mockResolvedValue(0)

    const res = await GET(makeReq('http://localhost/api/admin/templates?page=abc&limit=xyz'))
    const data = await res.json()

    expect(data.pagination.page).toBe(1)
    expect(data.pagination.limit).toBe(50)
    expect(mockDb.notificationTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 }),
    )
  })

  it('reports totalPages: 0 for an empty table — differs from the notifications list', async () => {
    // `GET /api/admin/notifications` يفرض `|| 1` فيعيد 1، وهنا `Math.ceil(0/50)`
    // = 0. الفرق موثّق هنا كسلوك قائم لا كموافقة عليه.
    mockDb.notificationTemplate.findMany.mockResolvedValue([])
    mockDb.notificationTemplate.count.mockResolvedValue(0)

    const res = await GET(makeReq('http://localhost/api/admin/templates'))
    const data = await res.json()

    expect(data.pagination.totalPages).toBe(0)
  })
})

describe('POST /api/admin/templates', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should create a new template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue(null)
    mockDb.notificationTemplate.create.mockResolvedValue({
      id: 'new-1',
      type: 'like',
      channel: 'email',
      titleTemplate: 'إعجاب',
      bodyTemplate: 'حصل على إعجاب',
      variables: ['modTitle'],
      isActive: true,
      version: 1,
    })

    const req = makeReq('http://localhost/api/admin/templates', 'POST', {
      type: 'like',
      channel: 'email',
      titleTemplate: 'إعجاب',
      bodyTemplate: 'حصل على إعجاب',
      variables: ['modTitle'],
      isActive: true,
    })

    const res = await POST(req)
    const data = await res.json()

    expect(data.data.type).toBe('like')
    expect(data.data.channel).toBe('email')
    expect(mockDb.notificationTemplate.create).toHaveBeenCalled()
  })

  it('should return 409 Conflict and NOT overwrite when type+channel already exists', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'existing-1',
      type: 'like',
      channel: 'email',
      version: 1,
    })

    const req = makeReq('http://localhost/api/admin/templates', 'POST', {
      type: 'like',
      channel: 'email',
      titleTemplate: 'إعجاب جديد',
      bodyTemplate: 'حصل على إعجاب',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error.code).toBe('CONFLICT')
    // لا كتابة فوق قالب الإنتاج
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
    expect(mockDb.notificationTemplate.create).not.toHaveBeenCalled()
  })

  it('should return 409 on unique-constraint race instead of 500', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue(null)
    mockDb.notificationTemplate.create.mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`type`,`channel`)'),
    )

    const req = makeReq('http://localhost/api/admin/templates', 'POST', {
      type: 'like',
      channel: 'email',
      titleTemplate: 'إعجاب',
      bodyTemplate: 'حصل على إعجاب',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error.code).toBe('CONFLICT')
  })

  it('should return 403 when the caller is not a manager', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden — manager access required'), { status: 403 }),
    )

    const req = makeReq('http://localhost/api/admin/templates', 'POST', {
      type: 'like',
      channel: 'email',
      titleTemplate: 'إعجاب',
      bodyTemplate: 'حصل على إعجاب',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('should reject invalid Handlebars in titleTemplate (non-string)', async () => {
    const req = makeReq('http://localhost/api/admin/templates', 'POST', {
      type: 'like',
      channel: 'email',
      titleTemplate: 123,
      bodyTemplate: 'valid body',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject invalid Handlebars in bodyTemplate (non-string)', async () => {
    const req = makeReq('http://localhost/api/admin/templates', 'POST', {
      type: 'like',
      channel: 'email',
      titleTemplate: 'valid title',
      bodyTemplate: 123,
    })

    const res = await POST(req)
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject invalid notification type', async () => {
    const req = makeReq('http://localhost/api/admin/templates', 'POST', {
      type: 'invalid_type',
      channel: 'email',
      titleTemplate: 'test',
      bodyTemplate: 'test',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('PUT /api/admin/templates/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should update a template and increment version', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      version: 3,
    })
    mockDb.notificationTemplate.update.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      version: 4,
    })

    const req = makeReq('http://localhost/api/admin/templates/tpl-1', 'PUT', {
      titleTemplate: 'إعجاب محدث',
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'tpl-1' }) })
    const data = await res.json()

    expect(data.data.version).toBe(4)
  })

  it('should return 404 for non-existent template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue(null)

    const req = makeReq('http://localhost/api/admin/templates/not-found', 'PUT', {
      titleTemplate: 'test',
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'not-found' }) })
    const data = await res.json()

    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('should reject invalid Handlebars on update (non-string)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      version: 3,
    })

    const req = makeReq('http://localhost/api/admin/templates/tpl-1', 'PUT', {
      titleTemplate: 123,
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'tpl-1' }) })
    const data = await res.json()

    expect(data.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('DELETE /api/admin/templates/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should delete a template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      isActive: true,
    })
    mockDb.notificationTemplate.count.mockResolvedValue(1) // other active templates exist
    mockDb.notificationTemplate.delete.mockResolvedValue({})

    const req = makeReq('http://localhost/api/admin/templates/tpl-1', 'DELETE')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'tpl-1' }) })
    const data = await res.json()

    expect(data.data.success).toBe(true)
    expect(mockDb.notificationTemplate.delete).toHaveBeenCalled()
  })

  it('should prevent deleting last active template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      isActive: true,
    })
    mockDb.notificationTemplate.count.mockResolvedValue(0) // no other active

    const req = makeReq('http://localhost/api/admin/templates/tpl-1', 'DELETE')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'tpl-1' }) })
    const data = await res.json()

    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 404 for non-existent template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue(null)

    const req = makeReq('http://localhost/api/admin/templates/not-found', 'DELETE')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'not-found' }) })
    const data = await res.json()

    expect(data.error.code).toBe('NOT_FOUND')
  })
})

describe('POST /api/admin/templates/[id]/preview', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should render preview with sample data', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'comment_reply',
      channel: 'in_app',
      titleTemplate: '{{actorName}} رد على تعليقك',
      bodyTemplate: 'قام {{actorName}} بالرد في تعريب "{{modTitle}}"',
      variables: ['actorName', 'modTitle'],
    })

    const req = makeReq('http://localhost/api/admin/templates/tpl-1/preview', 'POST', {})
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'tpl-1' }) })
    const data = await res.json()

    expect(data.data.title).toContain('رد على تعليقك')
    expect(data.data.body).toContain('بالرد في تعريب')
    expect(data.data.html).toBeUndefined() // in_app, no html
  })

  it('should wrap email templates in HTML', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-2',
      type: 'tier_upgrade',
      channel: 'email',
      titleTemplate: '🎊 ترقية!',
      bodyTemplate: 'تم ترقيتك من {{fromTier}} إلى {{toTier}}',
      variables: ['fromTier', 'toTier'],
    })

    const req = makeReq('http://localhost/api/admin/templates/tpl-2/preview', 'POST', {})
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'tpl-2' }) })
    const data = await res.json()

    expect(data.data.html).toBeDefined()
    expect(data.data.html).toContain('<!DOCTYPE html>')
    expect(data.data.html).toContain('🎊 ترقية!')
  })

  it('should use custom variables when provided', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-3',
      type: 'comment_reply',
      channel: 'in_app',
      titleTemplate: '{{actorName}} رد',
      bodyTemplate: '{{actorName}} رد في {{modTitle}}',
      variables: ['actorName', 'modTitle'],
    })

    const req = makeReq('http://localhost/api/admin/templates/tpl-3/preview', 'POST', {
      variables: { actorName: 'علي', modTitle: 'لعبة مميزة' },
    })
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'tpl-3' }) })
    const data = await res.json()

    expect(data.data.title).toBe('علي رد')
    expect(data.data.body).toContain('لعبة مميزة')
  })

  it('should return 404 for non-existent template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue(null)

    const req = makeReq('http://localhost/api/admin/templates/not-found', 'POST', {})
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'not-found' }) })
    const data = await res.json()

    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('should return 403 (not 500) when the caller is not a manager', async () => {
    // P3: catch في preview يفحص `status` — forbidden لا ينقلب إلى 500.
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden — manager access required'), { status: 403 }),
    )

    const req = makeReq('http://localhost/api/admin/templates/tpl-1/preview', 'POST', {})
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'tpl-1' }) })

    expect(res.status).toBe(403)
    // لا يُقرأ القالب ولا يُصرَّف قبل التحقق من الصلاحية
    expect(mockDb.notificationTemplate.findUnique).not.toHaveBeenCalled()
  })

  it('should return 401 (not 500) when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )

    const req = makeReq('http://localhost/api/admin/templates/tpl-1/preview', 'POST', {})
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'tpl-1' }) })

    expect(res.status).toBe(401)
    expect(mockDb.notificationTemplate.findUnique).not.toHaveBeenCalled()
  })

  it('should return 500 when the stored template has broken Handlebars', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'in_app',
      titleTemplate: '{{#if unclosed}}',
      bodyTemplate: 'body',
      variables: [],
    })

    const req = makeReq('http://localhost/api/admin/templates/tpl-1/preview', 'POST', {})
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'tpl-1' }) })

    expect(res.status).toBe(500)
  })

  it('should fall back to an empty sample when no variables are supplied or matched', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'unknown_future_type',
      channel: 'in_app',
      titleTemplate: 'عنوان',
      bodyTemplate: 'متن',
      variables: [],
    })

    const req = makeReq('http://localhost/api/admin/templates/tpl-1/preview', 'POST', {})
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'tpl-1' }) })
    const data = await res.json()

    expect(data.data.sampleVariables).toEqual({})
    expect(data.data.title).toBe('عنوان')
  })
})
