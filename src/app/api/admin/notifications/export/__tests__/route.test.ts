/**
 * Tests for GET /api/admin/notifications/export
 * يغطي تعقيم حقن الصيغ في CSV (CSV / formula injection).
 */

jest.mock('@/lib/db', () => ({
  db: {
    notificationLog: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireModerator: jest.fn().mockResolvedValue({ id: 'mod-1', role: 'moderator' }),
}))

import { NextRequest } from 'next/server'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from '../route'

const mockRequireModerator = requireModerator as jest.Mock
const mockFindMany = db.notificationLog.findMany as jest.Mock

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    channel: 'in_app',
    status: 'sent',
    notification: {
      type: 'like',
      title: 'إعجاب',
      user: { username: 'ali' },
    },
    ...overrides,
  }
}

async function csvText(logs: unknown[]): Promise<string> {
  mockFindMany.mockResolvedValue(logs)
  const res = await GET(new NextRequest('http://localhost/api/admin/notifications/export'))
  const body = await res.text()
  return body.replace(/^\uFEFF/, '')
}

/** الخلية بعد التعقيم: علامة اقتباس Apostrophe + تهريب `"` becoming `""` */
function expectedCell(value: string): string {
  return `"'${value.replace(/"/g, '""')}"`
}

describe('GET /api/admin/notifications/export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue({ id: 'mod-1', role: 'moderator' })
  })

  it('neutralizes a formula injected through username', async () => {
    const csv = await csvText([
      makeLog({ notification: { type: 'like', title: 'إعجاب', user: { username: '=cmd|calc' } } }),
    ])

    expect(csv).toContain(expectedCell('=cmd|calc'))
    expect(csv).not.toContain('"=cmd|calc"')
  })

  it.each([
    ['=HYPERLINK("http://x")', "'=HYPERLINK"],
    ['+1+1', "'+1+1"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['  =SUM(A1)', "'  =SUM(A1)"],
    ['\t=1+1', "'\t=1+1"],
    ['\r=1+1', "'\r=1+1"],
  ])('neutralizes %p', async (injected) => {
    const csv = await csvText([
      makeLog({
        notification: { type: 'like', title: injected, user: { username: 'ali' } },
      }),
    ])

    expect(csv).toContain(expectedCell(injected))
  })

  it('leaves ordinary values untouched', async () => {
    const csv = await csvText([makeLog()])

    expect(csv).toContain('"ali"')
    expect(csv).toContain('"إعجاب"')
    expect(csv).not.toContain(`"'`)
  })

  it('still escapes embedded double quotes', async () => {
    const csv = await csvText([
      makeLog({
        notification: { type: 'like', title: 'قال "مرحبا"', user: { username: 'ali' } },
      }),
    ])

    expect(csv).toContain('"قال ""مرحبا"""')
  })

  it('returns 403 instead of 500 for a non-moderator', async () => {
    mockRequireModerator.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden — moderator access required'), { status: 403 }),
    )

    const res = await GET(new NextRequest('http://localhost/api/admin/notifications/export'))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })
})
