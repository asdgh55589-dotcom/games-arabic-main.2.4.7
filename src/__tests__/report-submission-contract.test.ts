/**
 * @jest-environment jsdom
 *
 * P0-1 regression: ReportDialog must send the CreateReportSchema contract
 * ({targetModId|targetCommentId|targetUserId, details}) — not the legacy
 * {targetId, description} shape that Zod silently strips.
 */
import { createElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { buildReportPayload } from '@/lib/reports/payload'
import { CreateReportSchema } from '@/lib/schemas'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }))

import { ReportDialog } from '@/components/report-dialog'

const REASON = 'dead_links' as const

describe('report submission contract', () => {
  it.each([
    ['mod', 'mod-123', 'targetModId'],
    ['comment', 'comment-456', 'targetCommentId'],
    ['user', 'user-789', 'targetUserId'],
  ] as const)('maps %s targetId to %s', (targetType, targetId, expectedKey) => {
    const payload = buildReportPayload({
      targetType,
      targetId,
      reason: REASON,
      description: 'broken link',
    })
    const record = payload as unknown as Record<string, unknown>

    expect(record[expectedKey]).toBe(targetId)
    expect(payload.targetType).toBe(targetType)

    for (const otherKey of ['targetModId', 'targetCommentId', 'targetUserId']) {
      if (otherKey !== expectedKey) expect(record[otherKey]).toBeUndefined()
    }
  })

  it('maps description to details verbatim', () => {
    const description = '  الرابط لا يعمل — يظهر خطأ 404  '
    const payload = buildReportPayload({
      targetType: 'mod',
      targetId: 'mod-123',
      reason: REASON,
      description,
    })

    expect(payload.details).toBe(description)
  })

  it('omits details when description is empty', () => {
    const payload = buildReportPayload({
      targetType: 'mod',
      targetId: 'mod-123',
      reason: REASON,
      description: '',
    })

    expect(payload.details).toBeUndefined()
  })

  it.each(['mod', 'comment', 'user'] as const)(
    'passes CreateReportSchema for a %s payload and preserves the target id',
    (targetType) => {
      const targetId = `${targetType}-1`
      const payload = buildReportPayload({
        targetType,
        targetId,
        reason: REASON,
        description: 'تفاصيل البلاغ',
      })

      const parsed = CreateReportSchema.safeParse(payload)
      expect(parsed.success).toBe(true)
      if (!parsed.success) return

      expect(parsed.data.targetType).toBe(targetType)
      expect(
        parsed.data.targetModId ?? parsed.data.targetCommentId ?? parsed.data.targetUserId,
      ).toBe(targetId)
      expect(parsed.data.details).toBe('تفاصيل البلاغ')
      expect(parsed.data.reason).toBe(REASON)
    },
  )

  it('regression: the legacy {targetId, description} shape loses the target id', () => {
    const legacy = CreateReportSchema.safeParse({
      targetType: 'mod',
      targetId: 'mod-123',
      reason: REASON,
      description: 'broken link',
    })

    expect(legacy.success).toBe(true)
    if (!legacy.success) return

    expect(legacy.data.targetModId).toBeUndefined()
    expect(legacy.data.targetCommentId).toBeUndefined()
    expect(legacy.data.targetUserId).toBeUndefined()
    expect(legacy.data.details).toBeUndefined()
  })
})

describe('ReportDialog request body (real component)', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  async function submitReport(targetType: 'mod' | 'comment' | 'user', targetId: string) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ data: { report: { id: 'r1' } } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    render(
      createElement(
        ReportDialog,
        { targetType, targetId },
        createElement('button', { type: 'button' }, 'فتح البلاغ'),
      ),
    )

    fireEvent.click(screen.getByText('فتح البلاغ'))
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: targetType === 'mod' ? REASON : 'spam' },
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'تفاصيل البلاغ' } })
    fireEvent.click(screen.getByText('إرسال البلاغ'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]
    return JSON.parse(init.body as string) as Record<string, unknown>
  }

  it.each([
    ['mod', 'mod-123', 'targetModId'],
    ['comment', 'comment-456', 'targetCommentId'],
    ['user', 'user-789', 'targetUserId'],
  ] as const)('posts the typed %s field and passes validation', async (targetType, targetId, key) => {
    const body = await submitReport(targetType, targetId)

    expect(body.targetType).toBe(targetType)
    expect(body[key]).toBe(targetId)
    expect(body.details).toBe('تفاصيل البلاغ')
    expect(body.reason).toBe(targetType === 'mod' ? REASON : 'spam')
    expect(body.targetId).toBeUndefined()
    expect(body.description).toBeUndefined()
    expect(CreateReportSchema.safeParse(body).success).toBe(true)
  })
})
