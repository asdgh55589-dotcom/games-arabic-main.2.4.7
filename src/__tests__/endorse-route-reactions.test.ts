/**
 * R3/R4 — قواعد التفاعلات في POST /api/mods/[slug]/endorse.
 *
 * القاعدة (invariant):
 *   Mod.endorsements === COUNT(Endorsement WHERE value IN ('fire','sparkle','thumbsup'))
 *
 * - thumbsdown ليس إعجاباً → لا يزيد endorsements.
 * - قيمة قديمة/غير معروفة ('up', 'down', …) لا تمسّ أي bucket (لا زيادة ولا نقصان).
 * - عدّادات التفاعل لا تنزل تحت الصفر (GREATEST(col - 1, 0)).
 */
const mockGetOptionalSession = jest.fn()
jest.mock('@/lib/auth', () => ({
  getOptionalSession: (...a: unknown[]) => mockGetOptionalSession(...a),
}))

const mockRateLimit = jest.fn()
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => mockRateLimit(...a),
}))

const mockClearHomeCache = jest.fn()
jest.mock('@/lib/home-cache', () => ({
  clearHomeCache: (...a: unknown[]) => mockClearHomeCache(...a),
}))

const mockGetUseCases = jest.fn()
jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: (...a: unknown[]) => mockGetUseCases(...a),
}))

// `Prisma.raw` يُستخدم داخل قالب SQL — نحتاج تمثيلاً قابلاً للطباعة
// حتى نلتقط اسم العمود داخل استعلام GREATEST.
jest.mock('@prisma/client', () => ({
  Prisma: {
    raw: (s: string) => ({ __prismaRaw: s, toString: () => s }),
  },
}))

// mock للوحة `db` — تُقرأ قيمة `mockDbRef.current` وقت الاستدعاء (getter).
const mockDbRef: { current: unknown } = { current: null }
jest.mock('@/lib/db', () => ({
  get db() {
    return mockDbRef.current
  },
}))

import { POST as endorsePOST } from '@/app/api/mods/[slug]/endorse/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

type Counts = {
  endorsements: number
  reactionFire: number
  reactionSparkle: number
  reactionThumbsUp: number
  reactionThumbsDown: number
}

const COUNT_KEYS: (keyof Counts)[] = [
  'endorsements',
  'reactionFire',
  'reactionSparkle',
  'reactionThumbsUp',
  'reactionThumbsDown',
]

interface Harness {
  counts: Counts
  created: Array<{ value: string }>
  updated: Array<{ value: string }>
  deleted: number
  modUpdates: Array<Record<string, { increment: number } | { decrement: number }>>
  rawSql: string[]
  cascadeGame: number
  cascadeSeries: number
}

function makeHarness(overrides: Partial<Counts> = {}): Harness {
  return {
    counts: {
      endorsements: 0,
      reactionFire: 0,
      reactionSparkle: 0,
      reactionThumbsUp: 0,
      reactionThumbsDown: 0,
      ...overrides,
    },
    created: [],
    updated: [],
    deleted: 0,
    modUpdates: [],
    rawSql: [],
    cascadeGame: 0,
    cascadeSeries: 0,
  }
}

/** يبني mock للوحة DB يحاكي العدّادات في الذاكرة (لتثبيت النتائج). */
function installDb(h: Harness, existing: { id: string; value: string } | null) {
  const applyDelta = (col: string, delta: number) => {
    if (!COUNT_KEYS.includes(col as keyof Counts)) return
    h.counts[col as keyof Counts] += delta
  }

  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role: 'member' }),
    },
    mod: {
      findUnique: jest.fn().mockImplementation(async () => ({
        id: 'mod-1',
        slug: 'my-mod',
        gameId: 'game-1',
        seriesId: 'series-1',
        ...h.counts,
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, any> }) => {
        h.modUpdates.push(data)
        for (const [col, op] of Object.entries(data)) {
          if (op && typeof op === 'object' && 'increment' in op) applyDelta(col, op.increment)
          else if (op && typeof op === 'object' && 'decrement' in op) applyDelta(col, -op.decrement)
        }
        return {}
      }),
    },
    endorsement: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockImplementation(async ({ data }: { data: { value: string } }) => {
        h.created.push(data)
        return { id: 'endo-new', ...data }
      }),
      update: jest.fn().mockImplementation(async ({ data }: { data: { value: string } }) => {
        h.updated.push(data)
        return { id: 'endo-1', ...data }
      }),
      delete: jest.fn().mockImplementation(async () => {
        h.deleted += 1
        return {}
      }),
    },
    game: {
      update: jest.fn().mockImplementation(async () => {
        h.cascadeGame += 1
        return {}
      }),
    },
    series: {
      update: jest.fn().mockImplementation(async () => {
        h.cascadeSeries += 1
        return {}
      }),
    },
    $executeRaw: jest
      .fn()
      .mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.reduce(
          (acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ''),
          '',
        )
        h.rawSql.push(sql)
        // محاكاة GREATEST(col - 1, 0)
        const match = sql.match(/SET "(\w+)" = GREATEST/)
        if (match && COUNT_KEYS.includes(match[1] as keyof Counts)) {
          const col = match[1] as keyof Counts
          h.counts[col] = Math.max(h.counts[col] - 1, 0)
        }
        return 1
      }),
  }

  const db = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    mod: {
      findUnique: jest.fn().mockImplementation(async () => ({
        id: 'mod-1',
        slug: 'my-mod',
        name: 'مود تجريبي',
        authorId: 'author-1',
        ...h.counts,
      })),
    },
    endorsement: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  }

  mockDbRef.current = db
  return db
}

function post(body: unknown) {
  return new NextRequest('http://x/api/mods/my-mod/endorse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ slug: 'my-mod' }) }

beforeEach(() => {
  jest.clearAllMocks()
  mockDbRef.current = null
  mockGetOptionalSession.mockResolvedValue({ id: 'user-1', role: 'member', username: 'tester' })
  mockRateLimit.mockResolvedValue({
    success: true,
    remaining: 19,
    resetAt: Date.now() + 60_000,
    limit: 20,
  })
  mockClearHomeCache.mockResolvedValue(undefined)
  mockGetUseCases.mockReturnValue({ sendEndorseMilestone: { execute: jest.fn() } })
})

describe('endorse — thumbsdown ليس إعجاباً (R4)', () => {
  it('thumbsdown يزيد reactionThumbsDown ولا يزيد endorsements', async () => {
    const h = makeHarness()
    installDb(h, null)
    const res = await endorsePOST(post({ reaction: 'thumbsdown' }), params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.endorsements).toBe(0)
    expect(body.data.reactions.thumbsdown).toBe(1)
    expect(body.data.reactions.fire).toBe(0)
    expect(body.data.reactions.thumbsup).toBe(0)
    expect(body.data.reactions.sparkle).toBe(0)

    // mod.update استُدعي مرة واحدة ولا يحتوي endorsements
    expect(h.modUpdates).toHaveLength(1)
    expect(h.modUpdates[0]).toEqual({ reactionThumbsDown: { increment: 1 } })
    expect(h.modUpdates[0].endorsements).toBeUndefined()
    // لا cascade على game/series (thumbsdown ليس إعجاباً)
    expect(h.cascadeGame).toBe(0)
    expect(h.cascadeSeries).toBe(0)
  })

  it('إزالة thumbsdown لا تنقص endorsements (وتنقص reactionThumbsDown فقط)', async () => {
    const h = makeHarness({ reactionThumbsDown: 1 })
    installDb(h, { id: 'endo-1', value: 'thumbsdown' })
    const res = await endorsePOST(post({ reaction: 'thumbsdown' }), params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.endorsements).toBe(0)
    expect(body.data.reactions.thumbsdown).toBe(0)

    expect(h.deleted).toBe(1)
    // النقص يتم عبر GREATEST على العمود القديم فقط
    expect(h.rawSql).toHaveLength(1)
    expect(h.rawSql[0]).toContain('reactionThumbsDown')
    expect(h.rawSql[0]).not.toContain('endorsements')
    expect(h.rawSql[0]).toContain('GREATEST')
  })
})

describe('endorse — القيم القديمة/غير المعروفة (R3)', () => {
  it('قيمة قديمة غير معروفة ("up") → "fire" لا تنقص أي bucket (الخلل الأصلي)', async () => {
    const h = makeHarness({ reactionThumbsDown: 5 })
    installDb(h, { id: 'endo-1', value: 'up' })
    const res = await endorsePOST(post({ reaction: 'fire' }), params)

    expect(res.status).toBe(200)

    // لا يوجد أي نقص (raw) — القيمة القديمة 'up' لا تمسّ أي bucket
    expect(h.rawSql).toHaveLength(0)

    // الزيادة في reactionFire + endorsements (إعجاب إيجابي جديد)
    expect(h.modUpdates).toHaveLength(1)
    expect(h.modUpdates[0].reactionFire).toEqual({ increment: 1 })
    expect(h.modUpdates[0].reactionThumbsDown).toBeUndefined()
    expect(h.modUpdates[0].reactionThumbsUp).toBeUndefined()
    expect(h.modUpdates[0].reactionSparkle).toBeUndefined()

    expect(h.counts.reactionThumbsDown).toBe(5)
    expect(h.counts.reactionFire).toBe(1)
    expect(h.counts.endorsements).toBe(1)
    expect(h.updated[0].value).toBe('fire')
  })

  it('قيمة تفاعل غير معروفة تُتجاهل وتُستخدم القيمة الافتراضية thumbsup', async () => {
    const h = makeHarness()
    installDb(h, null)
    const res = await endorsePOST(post({ reaction: 'rocket' }), params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.reaction).toBe('thumbsup')
    expect(h.created[0].value).toBe('thumbsup')
    expect(h.modUpdates).toHaveLength(1)
    expect(h.modUpdates[0]).toEqual({
      reactionThumbsUp: { increment: 1 },
      endorsements: { increment: 1 },
    })
    // لا bucket باسم القيمة غير المعروفة
    expect(JSON.stringify(h.modUpdates[0])).not.toContain('rocket')
  })
})

describe('endorse — التبديل بين التفاعلات', () => {
  it('تبديل إيجابي → thumbsdown ينقص endorsements مرة واحدة', async () => {
    const h = makeHarness({ endorsements: 1, reactionFire: 1 })
    installDb(h, { id: 'endo-1', value: 'fire' })
    const res = await endorsePOST(post({ reaction: 'thumbsdown' }), params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.endorsements).toBe(0)
    expect(body.data.reactions.fire).toBe(0)
    expect(body.data.reactions.thumbsdown).toBe(1)

    // نقص reactionFire مرة واحدة + نقص endorsements مرة واحدة
    expect(h.rawSql.filter((s) => s.includes('reactionFire'))).toHaveLength(1)
    expect(h.rawSql.filter((s) => s.includes('"endorsements"'))).toHaveLength(1)
    // زيادة thumbsdown
    expect(h.modUpdates).toHaveLength(1)
    expect(h.modUpdates[0]).toEqual({ reactionThumbsDown: { increment: 1 } })
    expect(h.counts.endorsements).toBe(0)
  })

  it('تبديل thumbsdown → إيجابي يزيد endorsements مرة واحدة', async () => {
    const h = makeHarness({ endorsements: 0, reactionThumbsDown: 1 })
    installDb(h, { id: 'endo-1', value: 'thumbsdown' })
    const res = await endorsePOST(post({ reaction: 'thumbsup' }), params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.endorsements).toBe(1)
    expect(body.data.reactions.thumbsup).toBe(1)
    expect(body.data.reactions.thumbsdown).toBe(0)

    // نقص thumbsdown مرة واحدة
    expect(h.rawSql.filter((s) => s.includes('reactionThumbsDown'))).toHaveLength(1)
    // زيادة thumbsup + endorsements
    expect(h.modUpdates).toHaveLength(1)
    expect(h.modUpdates[0].reactionThumbsUp).toEqual({ increment: 1 })
    expect(h.modUpdates[0].endorsements).toEqual({ increment: 1 })
    expect(h.counts.endorsements).toBe(1)
  })

  it('تبديل بين تفاعلين إيجابيين لا يغيّر endorsements', async () => {
    const h = makeHarness({ endorsements: 1, reactionFire: 1 })
    installDb(h, { id: 'endo-1', value: 'fire' })
    const res = await endorsePOST(post({ reaction: 'sparkle' }), params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.endorsements).toBe(1)
    expect(body.data.reactions.fire).toBe(0)
    expect(body.data.reactions.sparkle).toBe(1)
    // لا نقص ولا زيادة لـ endorsements
    expect(h.rawSql.filter((s) => s.includes('"endorsements"'))).toHaveLength(0)
    expect(h.modUpdates[0].endorsements).toBeUndefined()
  })
})

describe('endorse — العدّادات لا تنزل تحت الصفر', () => {
  it('إزالة إعجاب عند العدّاد = 0 لا ينزل تحت الصفر (GREATEST clamp)', async () => {
    const h = makeHarness({ reactionThumbsUp: 0, endorsements: 0 })
    installDb(h, { id: 'endo-1', value: 'thumbsup' })
    const res = await endorsePOST(post({ reaction: 'thumbsup' }), params)

    expect(res.status).toBe(200)
    expect(h.rawSql.length).toBeGreaterThan(0)
    for (const sql of h.rawSql) expect(sql).toContain('GREATEST')
    expect(h.counts.reactionThumbsUp).toBeGreaterThanOrEqual(0)
    expect(h.counts.reactionThumbsUp).toBe(0)
    expect(h.counts.endorsements).toBeGreaterThanOrEqual(0)
    expect(h.counts.endorsements).toBe(0)
  })
})
