/**
 * PHASE 4 Task 3 — professional apply form: API validation + wizard structure.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { POST } from '@/app/api/creator-requests/route'

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getBanStatus: jest.fn(() => ({ banned: false })),
  setRoleCookie: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  db: {
    creatorRequest: { findFirst: jest.fn(), create: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  },
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

const root = process.cwd()
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

const member = { id: 'u1', username: 'ali', email: 'a@x', role: 'member', avatarUrl: null }
const validBody = () => ({
  experience: 'خبرة خمس سنوات في ترجمة الألعاب باستخدام مختلف الأدوات',
  reason: 'ر'.repeat(150),
  track: 'translator',
  portfolioUrls: 'https://a.example/1\nhttps://b.example/2\nhttps://c.example/3',
  experienceYears: 5,
  samplesCount: 12,
  agreeToTerms: true,
})
const post = (body: unknown) =>
  POST({ json: async () => body } as any).then(async (res: any) => ({
    status: res.status,
    body: await res.json(),
  }))

describe('POST /api/creator-requests validation', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(requireAuth as jest.Mock).mockResolvedValue(member)
    ;(db.creatorRequest.findFirst as jest.Mock).mockResolvedValue(null)
    ;(db.creatorRequest.create as jest.Mock).mockImplementation((args: any) => ({
      id: 'req1',
      ...args.data,
    }))
    ;(db.user.findMany as jest.Mock).mockResolvedValue([])
  })

  it('accepts a full valid application and persists new fields', async () => {
    const { status } = await post(validBody())
    expect(status).toBe(201)
    expect(db.creatorRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        track: 'translator',
        portfolioUrls: expect.stringContaining('https://a.example/1'),
        experienceYears: 5,
        samplesCount: 12,
        agreeToTerms: true,
      }),
    })
  })

  it('accepts publisher track', async () => {
    const { status } = await post({ ...validBody(), track: 'publisher' })
    expect(status).toBe(201)
    expect(db.creatorRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ track: 'publisher' }),
    })
  })

  it('rejects invalid track', async () => {
    const { status, body } = await post({ ...validBody(), track: 'admin' })
    expect(status).toBe(422)
    expect(JSON.stringify(body)).toContain('المسار')
  })

  it('rejects fewer than 3 portfolio URLs', async () => {
    const { status } = await post({
      ...validBody(),
      portfolioUrls: 'https://a.example/1\nhttps://b.example/2',
    })
    expect(status).toBe(422)
  })

  it('rejects more than 5 portfolio URLs', async () => {
    const { status } = await post({
      ...validBody(),
      portfolioUrls: Array.from({ length: 6 }, (_, i) => `https://a.example/${i}`).join('\n'),
    })
    expect(status).toBe(422)
  })

  it('rejects non-http portfolio URL', async () => {
    const { status } = await post({
      ...validBody(),
      portfolioUrls: 'https://a.example/1\nftp://evil.example/x\nhttps://c.example/3',
    })
    expect(status).toBe(422)
  })

  it('rejects out-of-range years and samples', async () => {
    expect((await post({ ...validBody(), experienceYears: 51 })).status).toBe(422)
    expect((await post({ ...validBody(), experienceYears: -1 })).status).toBe(422)
    expect((await post({ ...validBody(), samplesCount: 101 })).status).toBe(422)
    expect((await post({ ...validBody(), samplesCount: 1.5 })).status).toBe(422)
  })

  it('rejects short/long motivation and missing terms', async () => {
    expect((await post({ ...validBody(), reason: 'قصير' })).status).toBe(422)
    expect((await post({ ...validBody(), reason: 'ر'.repeat(1001) })).status).toBe(422)
    expect((await post({ ...validBody(), agreeToTerms: false })).status).toBe(422)
    expect((await post({ ...validBody(), agreeToTerms: undefined })).status).toBe(422)
  })

  it('still rejects non-members and duplicate pending', async () => {
    ;(requireAuth as jest.Mock).mockResolvedValueOnce({ ...member, role: 'creator' })
    expect((await post(validBody())).status).toBe(403)
    ;(db.creatorRequest.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'old' })
    expect((await post(validBody())).status).toBe(422)
  })
})

describe('wizard structure (static)', () => {
  const page = src('src/app/become-creator/apply/page.tsx')

  it('has 7 steps: track, portfolio, experience, samples, socials, motivation, terms', () => {
    for (const key of [
      'trackTitle',
      'portfolioUrlsLabel',
      'yearsLabel',
      'samplesLabel',
      't.socials',
      'reasonLabel',
      'termsText',
    ]) {
      expect(page).toContain(key)
    }
    expect(page).toContain('step} {step} / 7')
  })

  it('submits all new fields to the API', () => {
    for (const field of [
      'track,',
      'portfolioUrls:',
      'experienceYears:',
      'samplesCount:',
      'agreeToTerms: true',
    ]) {
      expect(page).toContain(field)
    }
  })

  it('per-step validation gates Next with Arabic errors', () => {
    expect(page).toContain('validateStep')
    expect(page).toContain('trackRequired')
    expect(page).toContain('portfolioCountError')
    expect(page).toContain('reasonRange')
    expect(page).toContain('termsRequired')
    expect(page).toContain('role="alert"')
  })
})
