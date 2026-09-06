/**
 * WAVE A Task 1 — creator comment actions: pin/unpin, bulk, edit-own-reply.
 * Route-level tests (mocked db/auth): permissions, IDOR, validation,
 * all-or-nothing bulk. UI wiring asserted statically.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { PATCH as commentPATCH } from '@/app/api/creator/comments/[id]/route'
import { POST as bulkPOST } from '@/app/api/creator/comments/bulk/route'

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))
jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: () => ({
    sendCommentReply: { execute: jest.fn().mockResolvedValue(undefined) },
    sendTopLevelComment: { execute: jest.fn().mockResolvedValue(undefined) },
  }),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true, remaining: 4, resetAt: 0, limit: 5 })),
}))
jest.mock('sanitize-html', () => ({ __esModule: true, default: jest.fn((h: string) => h) }))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

const CREATOR = { id: 'u1', username: 'creator1', email: 'c@x', role: 'creator', avatarUrl: null }
const idParams = { params: Promise.resolve({ id: 'c1' }) } as any
const req = (url: string, body?: unknown) => ({ url, json: async () => body ?? {} }) as any

const txMock = {
  modComment: { deleteMany: jest.fn(), count: jest.fn() },
  mod: { update: jest.fn() },
}

beforeEach(() => {
  jest.resetAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
  // Own-mod comment by default; owned reply by default.
  ;(db.modComment.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
    if (where?.id === 'missing') return null
    return { id: 'c1', modId: 'm1', userId: 'u1', mod: { authorId: 'u1' } }
  })
  ;(db.modComment.update as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(db.modComment.updateMany as jest.Mock).mockResolvedValue({ count: 2 })
  ;(db.modComment.findMany as jest.Mock).mockResolvedValue([
    { id: 'c1', modId: 'm1', mod: { authorId: 'u1' } },
    { id: 'c2', modId: 'm1', mod: { authorId: 'u1' } },
  ])
  ;(db.modComment.count as jest.Mock).mockResolvedValue(5)
  ;(db.$transaction as jest.Mock).mockImplementation(async (arg: any) =>
    typeof arg === 'function' ? arg(txMock) : Promise.all(arg),
  )
  txMock.modComment.deleteMany.mockReset().mockResolvedValue({ count: 2 })
  txMock.modComment.count.mockReset().mockResolvedValue(5)
  txMock.mod.update.mockReset().mockResolvedValue({})
})

describe('pin/unpin (own mods)', () => {
  it('pins a comment on own mod', async () => {
    const res = await commentPATCH(req('http://x/', { action: 'pin' }), idParams)
    expect(res.status).toBe(200)
    expect(db.modComment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPinned: true } }),
    )
  })

  it('unpins', async () => {
    const res = await commentPATCH(req('http://x/', { action: 'unpin' }), idParams)
    expect(res.status).toBe(200)
    expect(db.modComment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPinned: false } }),
    )
  })

  it('IDOR: pin on another creator\'s mod → 403, no write', async () => {
    ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'c9', modId: 'm9', userId: 'u9', mod: { authorId: 'other' },
    })
    const res = await commentPATCH(req('http://x/', { action: 'pin' }), idParams)
    expect(res.status).toBe(403)
    expect(db.modComment.update).not.toHaveBeenCalled()
  })
})

describe('edit own replies', () => {
  it('edits own reply (marks isEdited)', async () => {
    const res = await commentPATCH(req('http://x/', { action: 'edit', text: 'رد محدّث' }), idParams)
    expect(res.status).toBe(200)
    expect(db.modComment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { text: 'رد محدّث', isEdited: true } }),
    )
  })

  it("cannot edit someone else's reply on the same mod → 403", async () => {
    ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', modId: 'm1', userId: 'stranger', mod: { authorId: 'u1' },
    })
    const res = await commentPATCH(req('http://x/', { action: 'edit', text: 'hijack' }), idParams)
    expect(res.status).toBe(403)
    expect(db.modComment.update).not.toHaveBeenCalled()
  })

  it('empty and over-limit text → 422', async () => {
    expect((await commentPATCH(req('http://x/', { action: 'edit', text: '  ' }), idParams)).status).toBe(422)
    expect((await commentPATCH(req('http://x/', { action: 'edit', text: 'x'.repeat(2001) }), idParams)).status).toBe(422)
    expect(db.modComment.update).not.toHaveBeenCalled()
  })
})

describe('bulk (all-or-nothing)', () => {
  it('hides all own comments', async () => {
    const res = await bulkPOST(req('http://x/', { ids: ['c1', 'c2'], action: 'hide' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.count).toBe(2)
    expect(db.modComment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isHidden: true } }),
    )
  })

  it('IDOR: one foreign id blocks the whole batch (no partial writes)', async () => {
    ;(db.modComment.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', modId: 'm1', mod: { authorId: 'u1' } },
      { id: 'evil', modId: 'mx', mod: { authorId: 'attacker' } },
    ])
    const res = await bulkPOST(req('http://x/', { ids: ['c1', 'evil'], action: 'delete' }))
    expect(res.status).toBe(403)
    expect(db.modComment.updateMany).not.toHaveBeenCalled()
    expect(db.modComment.deleteMany).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('bulk delete recounts affected mods', async () => {
    const res = await bulkPOST(req('http://x/', { ids: ['c1', 'c2'], action: 'delete' }))
    expect(res.status).toBe(200)
    expect(txMock.modComment.deleteMany).toHaveBeenCalled()
    expect(txMock.mod.update).toHaveBeenCalled()
  })

  it('rejects empty / oversize / unknown actions', async () => {
    expect((await bulkPOST(req('http://x/', { ids: [], action: 'hide' }))).status).toBe(422)
    expect((await bulkPOST(req('http://x/', { ids: Array.from({ length: 51 }, (_, i) => `c${i}`), action: 'hide' }))).status).toBe(422)
    expect((await bulkPOST(req('http://x/', { ids: ['c1'], action: 'nuke' }))).status).toBe(422)
  })
})

describe('UI wiring (static)', () => {
  const root = process.cwd()
  const mgr = fs.readFileSync(path.join(root, 'src/components/creator/comments-manager.tsx'), 'utf8')
  const ar = fs.readFileSync(path.join(root, 'src/lib/studio-i18n/ar.ts'), 'utf8')

  it('manager calls pin/unpin/edit/bulk endpoints with a11y labels', () => {
    expect(mgr).toMatch(/\/api\/creator\/comments\/bulk/)
    expect(mgr).toMatch(/handleAction\(c\.id, 'pin'\)/)
    expect(mgr).toMatch(/handleAction\(c\.id, 'unpin'\)/)
    expect(mgr).toMatch(/action: 'edit'/)
    expect(mgr).toMatch(/aria-label=\{t\.pin\}/)
    expect(mgr).toMatch(/aria-label=\{t\.editReply\}/)
    expect(mgr).toMatch(/t\.bulkDeleteTitle/)
  })

  it('Arabic copy for new actions exists', () => {
    for (const s of ['تثبيت', 'إلغاء التثبيت', 'مثبت', 'تعديل الرد', 'إخفاء المحدد', 'حذف المحدد', 'حذف التعليقات المحددة؟']) {
      expect(ar).toContain(s)
    }
  })
})
