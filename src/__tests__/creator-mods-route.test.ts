/**
 * Tests for src/app/api/creator/mods/route.ts — GET + POST handlers.
 * Covers auth guards, pagination, filtering, sorting, validation,
 * permission checks, slug dedup, gameId fallback, and admin notifications.
 */
import { GET, POST } from '@/app/api/creator/mods/route'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    mod: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    game: {
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/permissions', () => ({
  canCreateMod: jest.fn().mockReturnValue(true),
  canTranslateMod: jest.fn().mockReturnValue(true),
}))

jest.mock('@/lib/schemas', () => ({
  CreateModSchema: {
    safeParse: jest.fn().mockImplementation((data: unknown) => ({
      success: true,
      data,
    })),
  },
}))

jest.mock('@/lib/utils', () => ({
  slugify: jest.fn().mockReturnValue('test-mod'),
}))

jest.mock('@/lib/api-response', () => ({
  ok: jest.fn().mockImplementation((data: unknown, init?: { status?: number }) => ({
    status: init?.status ?? 200,
    json: async () => ({ data }),
  })),
  forbidden: jest.fn().mockImplementation((msg: string) => ({
    status: 403,
    json: async () => ({ error: { code: 'FORBIDDEN', message: msg } }),
  })),
  validationFail: jest.fn().mockImplementation((msg: string) => ({
    status: 422,
    json: async () => ({ error: { code: 'VALIDATION_ERROR', message: msg } }),
  })),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { canCreateMod, canTranslateMod } from '@/lib/permissions'
import { CreateModSchema } from '@/lib/schemas'
import { slugify } from '@/lib/utils'

const creatorUser = {
  id: 'u1',
  username: 'ali',
  email: 'ali@test.com',
  role: 'creator',
  avatarUrl: null,
  onboardingCompleted: true,
}

const publisherUser = {
  id: 'u2',
  username: 'sara',
  email: 'sara@test.com',
  role: 'publisher',
  avatarUrl: null,
  onboardingCompleted: true,
}

const adminUser = {
  id: 'u3',
  username: 'admin',
  email: 'admin@test.com',
  role: 'admin',
  avatarUrl: null,
  onboardingCompleted: true,
}

const mockMod = (overrides: Record<string, unknown> = {}) => ({
  id: 'mod1',
  name: 'Test Mod',
  slug: 'test-mod',
  workflowStatus: 'DRAFT',
  views: 0,
  downloads: 0,
  endorsements: 0,
  rating: 0,
  ratingCount: 0,
  comments: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  isOriginalWork: true,
  originalSource: null,
  thumbnailUrl: 'https://example.com/thumb.jpg',
  game: { id: 'g1', name: 'Test Game', slug: 'test-game' },
  ...overrides,
})

const makeReq = (url: string, method = 'GET', body?: unknown) => {
  const req = {
    url,
    method,
    headers: new Headers(),
    json: body ? async () => body : undefined,
  } as any
  return req
}

// ─── GET Tests ───────────────────────────────────────────────────

describe('GET /api/creator/mods', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: creatorUser, error: null })
    ;(db.mod.count as jest.Mock).mockResolvedValue(0)
    ;(db.mod.findMany as jest.Mock).mockResolvedValue([])
  })

  it('يُعيد 401 عند عدم تسجيل الدخول', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: null,
      error: { status: 401, json: async () => ({ error: { code: 'UNAUTHORIZED' } }) },
    })
    const res = await GET(makeReq('http://localhost/api/creator/mods'))
    expect(res.status).toBe(401)
  })

  it('يُعيد 403 عندما لا يكون المستخدم من المُعَرِّبين', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: null,
      error: { status: 403, json: async () => ({ error: { code: 'FORBIDDEN' } }) },
    })
    const res = await GET(makeReq('http://localhost/api/creator/mods'))
    expect(res.status).toBe(403)
  })

  it('يُعيد قائمة تعريبات المستخدم مع pagination افتراضي', async () => {
    const mods = [mockMod(), mockMod({ id: 'mod2', name: 'Second' })]
    ;(db.mod.count as jest.Mock).mockResolvedValue(2)
    ;(db.mod.findMany as jest.Mock).mockResolvedValue(mods)

    const res = await GET(makeReq('http://localhost/api/creator/mods'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.mods).toHaveLength(2)
    expect(body.data.pagination).toMatchObject({ page: 1, limit: 20, total: 2 })
    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    )
  })

  it('يُعيد قائمة فارغة عندما لا يوجد تعريبات', async () => {
    ;(db.mod.count as jest.Mock).mockResolvedValue(0)
    ;(db.mod.findMany as jest.Mock).mockResolvedValue([])

    const res = await GET(makeReq('http://localhost/api/creator/mods'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.mods).toHaveLength(0)
    expect(body.data.pagination.total).toBe(0)
  })

  it('يدعم pagination مع صفحة وحد أقصى مخصص', async () => {
    ;(db.mod.count as jest.Mock).mockResolvedValue(50)
    ;(db.mod.findMany as jest.Mock).mockResolvedValue([])

    await GET(makeReq('http://localhost/api/creator/mods?page=2&limit=10'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    )
  })

  it('يحدد صفحة بحد أدنى 1 وحد أقصى 50', async () => {
    await GET(makeReq('http://localhost/api/creator/mods?page=0&limit=0'))
    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    )

    await GET(makeReq('http://localhost/api/creator/mods?page=-5&limit=999'))
    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 }),
    )
  })

  it('يصفّر حسب الحالة', async () => {
    ;(db.mod.count as jest.Mock).mockResolvedValue(1)
    ;(db.mod.findMany as jest.Mock).mockResolvedValue([mockMod()])

    await GET(makeReq('http://localhost/api/creator/mods?status=IN_REVIEW'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workflowStatus: 'IN_REVIEW' }),
      }),
    )
  })

  it('لا يُصفّر حسب الحالة عندما تكون all', async () => {
    await GET(makeReq('http://localhost/api/creator/mods?status=all'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ workflowStatus: expect.anything() }),
      }),
    )
  })

  it('يبحث بالاسم', async () => {
    await GET(makeReq('http://localhost/api/creator/mods?q=my+mod'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'my mod', mode: 'insensitive' },
        }),
      }),
    )
  })

  it('يتجاهل مسافات في البحث', async () => {
    await GET(makeReq('http://localhost/api/creator/mods?q=%20%20%20%20'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ name: expect.anything() }),
      }),
    )
  })

  it('يصنف حسب createdAt تلقائياً', async () => {
    await GET(makeReq('http://localhost/api/creator/mods'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    )
  })

  it('يسمح بالتصنيف حسب/downloads و asc', async () => {
    await GET(makeReq('http://localhost/api/creator/mods?sort=downloads&order=asc'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { downloads: 'asc' } }),
    )
  })

  it('يرفض حقلاً غير مصرح به ويستخدم createdAt', async () => {
    await GET(makeReq('http://localhost/api/creator/mods?sort=DROP+TABLE'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    )
  })

  it('يستخدم authorId الخاص بالمستخدم في الاستعلام', async () => {
    await GET(makeReq('http://localhost/api/creator/mods'))

    expect(db.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ authorId: 'u1' }),
      }),
    )
  })
})

// ─── POST Tests ──────────────────────────────────────────────────

describe('POST /api/creator/mods', () => {
  const validModData = {
    name: 'Test Mod',
    description: 'This is a test mod description with enough chars',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    imageUrl: 'https://example.com/image.jpg',
    gameId: 'g1',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: creatorUser, error: null })
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(null)
    ;(canCreateMod as jest.Mock).mockReturnValue(true)
    ;(canTranslateMod as jest.Mock).mockReturnValue(true)
    ;(CreateModSchema.safeParse as jest.Mock).mockImplementation((data: unknown) => ({
      success: true,
      data,
    }))
    ;(slugify as jest.Mock).mockReturnValue('test-mod')
    ;(db.mod.findUnique as jest.Mock).mockResolvedValue(null)
    ;(db.mod.create as jest.Mock).mockResolvedValue(mockMod())
    ;(db.game.findFirst as jest.Mock).mockResolvedValue({ id: 'g1' })
  })

  it('يُعيد 401 عند عدم تسجيل الدخول', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: null,
      error: { status: 401, json: async () => ({ error: { code: 'UNAUTHORIZED' } }) },
    })
    const res = await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))
    expect(res.status).toBe(401)
  })

  it('يُ退回 403 عندما لا يكون المستخدم من المُعَرِّبين', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: null,
      error: { status: 403, json: async () => ({ error: { code: 'FORBIDDEN' } }) },
    })
    const res = await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))
    expect(res.status).toBe(403)
  })

  it('يُ退回 429 عند تجاوز حد الإنشاء', async () => {
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValue({
      status: 429,
      json: async () => ({ error: { code: 'RATE_LIMITED' } }),
    })
    const res = await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))
    expect(res.status).toBe(429)
  })

  it('يُ退回 422 عند بيانات غير صالحة', async () => {
    ;(CreateModSchema.safeParse as jest.Mock).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'اسم التعريب مطلوب' }] },
    })
    const res = await POST(makeReq('http://localhost/api/creator/mods', 'POST', {}))
    expect(res.status).toBe(422)
  })

  it('يُ退回 403 عندما لا يملك المُعَرِّب صلاحية إنشاء تعريبات أصلية', async () => {
    ;(canCreateMod as jest.Mock).mockReturnValue(false)
    const res = await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        isOriginalWork: true,
      }),
    )
    expect(res.status).toBe(403)
  })

  it('يُ退回 403 عندما لا يملك الناشر صلاحية نشر خارجي', async () => {
    ;(canCreateMod as jest.Mock).mockReturnValue(false)
    const res = await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        isOriginalWork: false,
      }),
    )
    expect(res.status).toBe(403)
  })

  it('يُ退回 403 عندما لا يملك المُعَرِّب صلاحية الترجمة', async () => {
    ;(canTranslateMod as jest.Mock).mockReturnValue(false)
    const res = await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        isOriginalWork: true,
      }),
    )
    expect(res.status).toBe(403)
  })

  it('يُ退回 422 عندما لا يذكر الناشر المصدر الأصلي', async () => {
    ;(CreateModSchema.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { ...validModData, isOriginalWork: false, originalSource: '' },
    })
    const res = await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        isOriginalWork: false,
        originalSource: '',
      }),
    )
    expect(res.status).toBe(422)
  })

  it('يُ退回 422 عندما لا توجد لعبة في قاعدة البيانات', async () => {
    ;(db.game.findFirst as jest.Mock).mockResolvedValue(null)
    ;(CreateModSchema.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { ...validModData, gameId: undefined },
    })
    const res = await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        gameId: undefined,
      }),
    )
    expect(res.status).toBe(422)
  })

  it('يُ退回 slug فريد عندما يوجد تعارض', async () => {
    ;(db.mod.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing' })
    ;(db.mod.findUnique as jest.Mock).mockResolvedValueOnce(null)

    await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))

    expect(db.mod.findUnique).toHaveBeenCalledWith({ where: { slug: 'test-mod' } })
    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: expect.stringContaining('test-mod-'),
        }),
      }),
    )
  })

  it('يُحفظ التعريب كمسودة بدون إجراء submit', async () => {
    const res = await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workflowStatus: 'DRAFT' }),
      }),
    )
    expect(body.data.message).toContain('مسودة')
  })

  it('يُرسل التعريب للمراجعة عند استخدام action=submit', async () => {
    ;(db.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'admin1' },
      { id: 'admin2' },
    ])
    ;(db.notification.create as jest.Mock).mockResolvedValue({})

    const res = await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        action: 'submit',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workflowStatus: 'IN_REVIEW' }),
      }),
    )
    expect(body.data.message).toContain('للمراجعة')
  })

  it('يُرسل إشعاراً لكل الأدوار الإدارية عند التسليم', async () => {
    ;(db.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'admin1' },
      { id: 'manager1' },
      { id: 'owner1' },
    ])
    ;(db.notification.create as jest.Mock).mockResolvedValue({})

    await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        action: 'submit',
      }),
    )

    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { role: { in: ['admin', 'manager', 'owner'] } },
      select: { id: true },
    })
    expect(db.notification.create).toHaveBeenCalledTimes(3)
  })

  it('لا يُ crashes عند فشل إشعار الإدارة', async () => {
    ;(db.user.findMany as jest.Mock).mockRejectedValue(new Error('DB error'))

    const res = await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        action: 'submit',
      }),
    )
    expect(res.status).toBe(201)
  })

  it('يحوّل مصفوفة galleryUrls إلى سلسلة مفصولة بفواصل', async () => {
    await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        galleryUrls: ['url1', 'url2'],
      }),
    )

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ galleryUrls: 'url1,url2' }),
      }),
    )
  })

  it('يحوّل مصفوفة tags إلى سلسلة مفصولة بفواصل', async () => {
    await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        tags: ['tag1', 'tag2'],
      }),
    )

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tags: 'tag1,tag2' }),
      }),
    )
  })

  it('يتعامل مع galleryUrls كسلسلة نصية', async () => {
    await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        galleryUrls: 'single-url',
      }),
    )

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ galleryUrls: 'single-url' }),
      }),
    )
  })

  it('يستخدم gameId المقدم في الطلب', async () => {
    await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        gameId: 'custom-game',
      }),
    )

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gameId: 'custom-game' }),
      }),
    )
  })

  it('يستخدم gameId المُستخرج من قاعدة البيانات عند عدم وجود gameId', async () => {
    ;(db.game.findFirst as jest.Mock).mockResolvedValue({ id: 'fallback-game' })
    ;(CreateModSchema.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { ...validModData, gameId: undefined },
    })

    await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        gameId: undefined,
      }),
    )

    expect(db.game.findFirst).toHaveBeenCalled()
    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gameId: 'fallback-game' }),
      }),
    )
  })

  it('يُ福田 authorId للمستخدم المُصادق عليه', async () => {
    await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: 'u1' }),
      }),
    )
  })

  it('يتعامل مع tags غير مصفوفة (سلسلة نصية أو فارغة)', async () => {
    await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        tags: 'single-tag',
      }),
    )

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tags: 'single-tag' }),
      }),
    )
  })

  it('يتعامل مع galleryUrls فارغة', async () => {
    await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ galleryUrls: '' }),
      }),
    )
  })

  it('يتعامل مع tags فارغة', async () => {
    await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tags: '' }),
      }),
    )
  })

  it('يُ福田 slug من دالة slugify', async () => {
    ;(slugify as jest.Mock).mockReturnValue('my-custom-slug')

    await POST(makeReq('http://localhost/api/creator/mods', 'POST', validModData))

    expect(slugify).toHaveBeenCalledWith('Test Mod')
    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'my-custom-slug' }),
      }),
    )
  })

  it('يتعامل مع ناشر بمصدر أصلي صالح', async () => {
    ;(CreateModSchema.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: {
        ...validModData,
        isOriginalWork: false,
        originalSource: 'https://example.com/source',
      },
    })

    const res = await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        isOriginalWork: false,
        originalSource: 'https://example.com/source',
      }),
    )

    expect(res.status).toBe(201)
  })

  it('يتعامل مع بيانات null في galleryUrls و tags', async () => {
    await POST(
      makeReq('http://localhost/api/creator/mods', 'POST', {
        ...validModData,
        galleryUrls: null,
        tags: null,
      }),
    )

    expect(db.mod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ galleryUrls: '', tags: '' }),
      }),
    )
  })
})
