/**
 * PHASE 4 Task 7 — applicant status page: state display, 48h SLA, resubmit.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { isReviewSlaBreached, REVIEW_SLA_HOURS } from '@/lib/creator-status'

const root = process.cwd()
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

describe('SLA helper', () => {
  it('breaches after 48h, not before', () => {
    expect(REVIEW_SLA_HOURS).toBe(48)
    const now = new Date('2026-09-07T12:00:00Z')
    expect(isReviewSlaBreached('2026-09-05T11:59:00Z', now)).toBe(true)
    expect(isReviewSlaBreached('2026-09-05T12:00:01Z', now)).toBe(false)
    expect(isReviewSlaBreached('2026-09-07T11:00:00Z', now)).toBe(false)
  })

  it('invalid dates never breach', () => {
    expect(isReviewSlaBreached('not-a-date')).toBe(false)
  })
})

describe('status page (static)', () => {
  const page = src('src/app/become-creator/status/page.tsx')

  it('renders pending / approved / rejected states with track + dates', () => {
    expect(page).toContain('pendingTitle')
    expect(page).toContain('approvedTitle')
    expect(page).toContain('rejectedTitle')
    expect(page).toContain('trackPublisher')
    expect(page).toContain('submittedOn')
  })

  it('pending shows the 48h promise; breach shows escalation to support', () => {
    expect(page).toContain('isReviewSlaBreached')
    expect(page).toContain('slaBreachTitle')
    expect(page).toContain('slaBreachDesc')
    expect(page).toContain('href="/support"')
  })

  it('approved shows reviewer note + dashboard link', () => {
    expect(page).toContain('approveNote')
    expect(page).toContain('reviewerNote')
    expect(page).toContain('href="/creator"')
  })

  it('rejected shows reason + resubmit to apply', () => {
    expect(page).toContain('rejectReason')
    expect(page).toContain('href="/become-creator/apply"')
    expect(page).toContain('resubmit')
  })

  it('login + empty states route to login / apply', () => {
    expect(page).toContain('href="/login"')
    expect(page).toContain('noRequest')
    expect(page).toContain('applyNow')
  })

  it('reads the existing status endpoint (no new API surface)', () => {
    expect(page).toContain("fetch('/api/creator-requests'")
  })
})

describe('status copy localized AR+EN', () => {
  it('Arabic has the 48h pending promise + escalation', () => {
    const ar = src('src/lib/studio-i18n/ar.ts')
    expect(ar).toContain('تحت المراجعة — سنرد خلال 48 ساعة')
    expect(ar).toContain('تجاوزنا مدة المراجعة')
    expect(ar).toContain('مبروك! تم قبولك في البرنامج')
  })

  it('English mirrors it', () => {
    const en = src('src/lib/studio-i18n/en.ts')
    expect(en).toContain('Under review — we reply within 48 hours')
    expect(en).toContain('Review is overdue')
  })
})

describe('apply page links pending applicants to status', () => {
  it('pending branch has a status CTA', () => {
    const apply = src('src/app/become-creator/apply/page.tsx')
    expect(apply).toContain('href="/become-creator/status"')
    expect(apply).toContain('viewStatus')
  })
})
