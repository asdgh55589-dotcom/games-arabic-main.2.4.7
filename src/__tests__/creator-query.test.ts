/**
 * GAM-6/E E4 — central creator query-param whitelists (Zod enums).
 */
import {
  CommentFilterSchema,
  InviteStatusFilterSchema,
  ModStatusFilterSchema,
  parseFilterParam,
  ReportStatusFilterSchema,
  RequestStatusFilterSchema,
} from '@/lib/creator-query'

describe('creator query whitelists', () => {
  it('request status admits the documented filters only', () => {
    for (const v of ['all', 'mine', 'open', 'accepted', 'completed', 'cancelled']) {
      expect(RequestStatusFilterSchema.safeParse(v).success).toBe(true)
    }
    expect(RequestStatusFilterSchema.safeParse('archived').success).toBe(false)
    expect(RequestStatusFilterSchema.safeParse('').success).toBe(false)
    expect(RequestStatusFilterSchema.safeParse('ALL').success).toBe(false)
  })

  it('comment filter admits all|visible|hidden only', () => {
    for (const v of ['all', 'visible', 'hidden']) {
      expect(CommentFilterSchema.safeParse(v).success).toBe(true)
    }
    expect(CommentFilterSchema.safeParse('deleted').success).toBe(false)
  })

  it('report status admits known outcomes + all', () => {
    for (const v of [
      'all',
      'new',
      'under_review',
      'confirmed',
      'rejected',
      'pending',
      'resolved',
      'reopened',
    ]) {
      expect(ReportStatusFilterSchema.safeParse(v).success).toBe(true)
    }
    expect(ReportStatusFilterSchema.safeParse('open').success).toBe(false)
  })

  it('mod status admits workflow statuses + all', () => {
    for (const v of ['all', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'REJECTED']) {
      expect(ModStatusFilterSchema.safeParse(v).success).toBe(true)
    }
    // free strings must never reach where.workflowStatus
    expect(ModStatusFilterSchema.safeParse('published').success).toBe(false)
    expect(ModStatusFilterSchema.safeParse('1=1').success).toBe(false)
  })

  it('invite status admits lifecycle states + all', () => {
    for (const v of ['all', 'pending', 'accepted', 'declined', 'revoked', 'expired']) {
      expect(InviteStatusFilterSchema.safeParse(v).success).toBe(true)
    }
    expect(InviteStatusFilterSchema.safeParse('owner').success).toBe(false)
  })
})

describe('parseFilterParam', () => {
  const params = (q: string) => new URL(`http://x.test/?${q}`).searchParams

  it('returns the fallback when the param is missing', () => {
    expect(parseFilterParam(params(''), 'status', RequestStatusFilterSchema, 'all')).toEqual({
      ok: true,
      value: 'all',
    })
  })

  it('accepts a known value and rejects an unknown one', () => {
    expect(parseFilterParam(params('status=mine'), 'status', RequestStatusFilterSchema, 'all')).toEqual({
      ok: true,
      value: 'mine',
    })
    expect(parseFilterParam(params('status=evil'), 'status', RequestStatusFilterSchema, 'all')).toEqual({
      ok: false,
    })
  })

  it('trims whitespace before validating', () => {
    expect(
      parseFilterParam(params('status=%20pending%20'), 'status', InviteStatusFilterSchema, 'all'),
    ).toEqual({ ok: true, value: 'pending' })
  })
})
