/**
 * PHASE 4 Task 4 — admin requests: search/paging/filters/bulk/notes.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { GET as adminGET } from '@/app/api/admin/creator-requests/route'
import { PATCH as idPATCH } from '@/app/api/admin/creator-requests/[id]/route'
import { POST as bulkPOST } from '@/app/api/admin/creator-requests/bulk/route'

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/db', () => ({
  db: {
    creatorRequest: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { update: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(async (fn: any) =>
      fn({ user: { update: jest.fn() }, creatorRequest: { update: jest.fn() } }),
    ),
  },
}))
jest.mock('@/lib/creator-requests', () => ({
  approveCreatorRequest: jest.fn(),
  rejectCreatorRequest: jest.fn(),
}))

import { requireAdmin } from '@/lib/auth'
import { approveCreatorRequest, rejectCreatorRequest } from '@/lib/creator-requests'
import { db } from '@/lib/db'

const root = process.cwd()
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

beforeEach(() => {
  jest.resetAllMocks()
  ;(requireAdmin as jest.Mock).mockResolvedValue({ id: 'admin1' })
})

describe('admin GET search + filters + pagination', () => {
  beforeEach(() => {
    ;(db.creatorRequest.count as jest.Mock).mockResolvedValue(45)
    ;(db.creatorRequest.findMany as jest.Mock).mockResolvedValue([])
  })

  const get = (qs: string) =>
    adminGET({ url: `http://x/api/admin/creator-requests?${qs}` } as any).then(
      async (res: any) => ({ status: res.status, body: await res.json() }),
    )

  it('passes q/track/page/limit into where + skip/take', async () => {
    const { status, body } = await get('q=ali&track=publisher&status=pending&page=2&limit=20')
    expect(status).toBe(200)
    const findMany = db.creatorRequest.findMany as jest.Mock
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    )
    const where = findMany.mock.calls[0][0].where
    expect(where.status).toBe('pending')
    expect(where.track).toBe('publisher')
    expect(JSON.stringify(where.user)).toContain('ali')
    expect(body.data.pagination).toMatchObject({ page: 2, total: 45, totalPages: 3 })
  })

  it('defaults page 1 / limit 20 and clamps limit', async () => {
    await get('limit=500')
    expect((db.creatorRequest.findMany as jest.Mock).mock.calls[0][0].take).toBe(50)
    await get('')
    const args = (db.creatorRequest.findMany as jest.Mock).mock.calls[1][0]
    expect(args.skip).toBe(0)
    expect(args.take).toBe(20)
  })

  it('requires admin', async () => {
    ;(requireAdmin as jest.Mock).mockRejectedValueOnce({ status: 401 })
    const { status } = await get('')
    expect(status).toBe(401)
  })
})

describe('bulk endpoint', () => {
  const post = (body: unknown) =>
    bulkPOST({ json: async () => body } as any).then(async (res: any) => ({
      status: res.status,
      body: await res.json(),
    }))

  beforeEach(() => {
    ;(db.creatorRequest.findUnique as jest.Mock).mockImplementation(({ where }: any) => ({
      id: where.id,
      userId: 'u1',
      status: 'pending',
    }))
  })

  it('approves a batch and reports per-item results', async () => {
    const { status, body } = await post({ action: 'approve', ids: ['a', 'b', 'a'] })
    expect(status).toBe(200)
    expect(approveCreatorRequest).toHaveBeenCalledTimes(2)
    expect(body.data.succeeded).toBe(2)
  })

  it('skips non-pending without failing the batch', async () => {
    ;(db.creatorRequest.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'a',
      userId: 'u1',
      status: 'approved',
    })
    const { body } = await post({ action: 'approve', ids: ['a', 'b'] })
    expect(body.data).toMatchObject({ succeeded: 1, failed: 1 })
    expect(body.data.results[0]).toMatchObject({ id: 'a', ok: false })
  })

  it('reject requires reason and validates input', async () => {
    expect((await post({ action: 'reject', ids: ['a'] })).status).toBe(422)
    const { status } = await post({ action: 'reject', ids: ['a'], rejectReason: 'ناقص' })
    expect(status).toBe(200)
    expect(rejectCreatorRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a' }),
      'admin1',
      'ناقص',
    )
    expect((await post({ action: 'approve', ids: [] })).status).toBe(422)
    expect((await post({ action: 'delete', ids: ['a'] })).status).toBe(422)
  })
})

describe('[id] note action (internal notes)', () => {
  it('saves adminNotes without touching status', async () => {
    ;(db.creatorRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      status: 'pending',
    })
    ;(db.creatorRequest.update as jest.Mock).mockResolvedValue({ adminNotes: 'تحقق من الرابط' })
    const res: any = await idPATCH(
      { json: async () => ({ action: 'note', adminNotes: 'تحقق من الرابط' }) } as any,
      { params: Promise.resolve({ id: 'r1' }) },
    )
    expect(res.status).toBe(200)
    expect(db.creatorRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { adminNotes: 'تحقق من الرابط' },
    })
  })
})

describe('admin UI (static)', () => {
  const page = src('src/app/admin/creators/requests/page.tsx')

  it('has search, track filter, pagination (20/page), bulk bar', () => {
    expect(page).toContain('بحث بالاسم أو البريد')
    expect(page).toContain('trackFilter')
    expect(page).toContain('PAGE_SIZE = 20')
    expect(page).toContain('صفحة {pagination.page}')
    expect(page).toContain('قبول المحدد')
    expect(page).toContain('رفض المحدد')
    expect(page).toContain('/api/admin/creator-requests/bulk')
  })

  it('shows track badge, years, samples, clickable portfolio, socials, notes', () => {
    expect(page).toContain('TRACK_LABEL')
    expect(page).toContain('سنوات الخبرة:')
    expect(page).toContain('عدد الأعمال:')
    expect(page).toContain('target="_blank"')
    expect(page).toContain('title={s.label}')
    expect(page).toContain('ملاحظة داخلية (لا تظهر لمقدم الطلب)')
    expect(page).toContain("action: 'note'")
  })
})
