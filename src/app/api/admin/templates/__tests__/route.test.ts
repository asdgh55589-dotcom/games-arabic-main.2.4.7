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
import { db } from '@/lib/db'
import { POST as previewPOST } from '../[id]/preview/route'
import { DELETE, PUT } from '../[id]/route'
import { GET, POST } from '../route'

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

  it('should update existing template and increment version', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'existing-1',
      type: 'like',
      channel: 'email',
      version: 1,
    })
    mockDb.notificationTemplate.update.mockResolvedValue({
      id: 'existing-1',
      type: 'like',
      channel: 'email',
      version: 2,
    })

    const req = makeReq('http://localhost/api/admin/templates', 'POST', {
      type: 'like',
      channel: 'email',
      titleTemplate: 'إعجاب جديد',
      bodyTemplate: 'حصل على إعجاب',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(data.data.version).toBe(2)
    expect(mockDb.notificationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 2 }),
      }),
    )
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

    const req = makeReq('http://localhost/api/admin/templates/not-found/preview', 'POST', {})
    const res = await previewPOST(req, { params: Promise.resolve({ id: 'not-found' }) })
    const data = await res.json()

    expect(data.error.code).toBe('NOT_FOUND')
  })
})
