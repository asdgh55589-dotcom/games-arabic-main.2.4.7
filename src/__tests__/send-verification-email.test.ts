/**
 * Tests for POST /api/auth/send-verification-email (D.6-c dead-ref fix).
 * views/login.tsx handleResend falls back to this route when the client-side
 * Supabase resend fails — it 404'd before this fix.
 */

const mockResend = jest.fn()

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true })),
  rateLimitHeaders: () => ({}),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { resend: mockResend } })),
  createAdminClient: jest.fn(),
}))

import { POST } from '@/app/api/auth/send-verification-email/route'

describe('POST /api/auth/send-verification-email', () => {
  beforeEach(() => jest.clearAllMocks())

  it('resends the signup email and returns ok', async () => {
    mockResend.mockResolvedValue({ error: null })
    const res = await POST({ json: async () => ({ email: 'user@mail.com' }) } as never)
    expect(res.status).toBe(200)
    expect(mockResend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'user@mail.com' }),
    )
  })

  it('returns non-ok when resend fails (caller throws the original error)', async () => {
    mockResend.mockResolvedValue({ error: { message: 'rate limited' } })
    const res = await POST({ json: async () => ({ email: 'user@mail.com' }) } as never)
    expect(res.status).not.toBe(200)
  })

  it('validates the email', async () => {
    const res = await POST({ json: async () => ({ email: 'nope' }) } as never)
    expect(res.status).toBe(422)
    expect(mockResend).not.toHaveBeenCalled()
  })
})
