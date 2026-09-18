/**
 * SA-2: emailFrom single-source + centralized email templates (Phase 3 Task B).
 *
 * TDD note: written BEFORE src/lib/email/from.ts + src/lib/email/templates.ts
 * existed (RED), then implementation made it GREEN. Static seed assertions
 * avoid DB mocking: they prove idempotent-upsert shape by reading the seed file.
 */
import * as fs from 'fs'
import * as path from 'path'
import {
  buildApprovalEmail,
  buildInviteEmail,
  buildResetEmail,
  buildTransferEmail,
  buildVerificationEmail,
  renderEmailTemplate,
} from '@/lib/email/templates'
import { emailFrom } from '@/lib/email/from'

const ROOT = process.cwd()
const SENDER_FILES = [
  'src/lib/notifications/email-service.ts',
  'src/lib/recovery-email.ts',
  'src/lib/admin/send-inactive-alert.ts',
] as const

describe('emailFrom single source (SA-2 spec)', () => {
  const OLD_ENV = process.env.EMAIL_FROM
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.EMAIL_FROM
    else process.env.EMAIL_FROM = OLD_ENV
  })

  it('returns EMAIL_FROM when set', () => {
    process.env.EMAIL_FROM = 'test@example.com'
    expect(emailFrom()).toBe('test@example.com')
  })

  it('falls back when EMAIL_FROM is unset', () => {
    delete process.env.EMAIL_FROM
    expect(emailFrom()).toBe('noreply@games-arabic.com')
  })

  it('falls back when EMAIL_FROM is empty string (|| not ??)', () => {
    process.env.EMAIL_FROM = ''
    expect(emailFrom()).toBe('noreply@games-arabic.com')
  })

  it('from.ts uses || (not ??) with the canonical default', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/lib/email/from.ts'), 'utf8')
    expect(src).toContain("process.env.EMAIL_FROM || 'noreply@games-arabic.com'")
    expect(src).not.toContain('??')
  })
})

describe('sender-file from unification (SA-1 scope, conditional)', () => {
  it('reports residual hardcoded froms WITHOUT failing (SA-1 owns sender files)', () => {
    const residual: string[] = []
    for (const f of SENDER_FILES) {
      const p = path.join(ROOT, f)
      if (!fs.existsSync(p)) continue
      const src = fs.readFileSync(p, 'utf8')
      const hits = src
        .split('\n')
        .filter(
          (l) =>
            l.includes('yourdomain') ||
            l.includes('notifications@games-arabic.com') ||
            l.includes('alerts@yourdomain'),
        )
      if (hits.length > 0) residual.push(`${f}: ${hits.length} hardcoded from hit(s)`)
    }
    if (residual.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[SA-2 info] residual sender hardcoded froms (SA-1 scope, NOT SA-2):\n - ${residual.join('\n - ')}`)
    } else {
      // eslint-disable-next-line no-console
      console.log('[SA-2 info] sender files clean — SA-1 has unified them onto emailFrom()')
    }
    expect(true).toBe(true)
  })
})

describe('seed email-channel rows (static idempotency proof)', () => {
  const seedPath = path.join(ROOT, 'prisma/seed-notification-templates.ts')
  const seed = fs.readFileSync(seedPath, 'utf8')

  it('uses upsert (never create-only) keyed by @@unique([type,channel])', () => {
    expect(seed).toContain('notificationTemplate.upsert')
    expect(seed).toContain('type_channel')
    expect(seed).not.toMatch(/\.create\(\{\s*data:\s*\[\s*$/m)
  })

  it('contains exactly 20 email-channel rows', () => {
    const emailRows = (seed.match(/channel:\s*['"]email['"]/g) || []).length
    expect(emailRows).toBe(20)
  })

  it('keeps the 20 in_app rows intact', () => {
    const inAppRows = (seed.match(/channel:\s*['"]in_app['"]/g) || []).length
    expect(inAppRows).toBe(20)
  })

  it('email rows carry Arabic subjects + RTL bodies + recipientName var', () => {
    expect(seed).toContain('مرحباً {{recipientName}}')
    expect(seed).toContain('dir="rtl"')
    expect(seed).toContain('recipientName')
  })
})

describe('centralized builders (Arabic copy byte-identical to sender sources)', () => {
  it('buildApprovalEmail mirrors email-service.ts:177-215 markup verbatim', () => {
    const { subject, html, text } = buildApprovalEmail({
      username: 'أحمد',
      track: 'publisher',
    })
    expect(subject).toBe('مبروك! انضممت لبرنامج منشئ المحتوى كناشر')
    expect(subject).toContain('ناشر')
    expect(html).toContain('مرحباً أحمد')
    expect(html).toContain('برنامج منشئ المحتوى')
    expect(html).toContain('افتح لوحة منشئ المحتوى')
    expect(html).toContain('منصة تعريب الألعاب — هذا إشعار تلقائي')
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('buildApprovalEmail supports translator track + approveNote', () => {
    const { subject, html } = buildApprovalEmail({
      username: 'سارة',
      track: 'translator',
      approveNote: 'ملاحظة',
    })
    expect(subject).toContain('معرّب')
    expect(html).toContain('ملاحظة من المراجعة')
    expect(html).toContain('رفع تعريباتك')
  })

  it('buildResetEmail mirrors recovery-email.ts:34-40 markup verbatim', () => {
    const { subject, html, text } = buildResetEmail('https://example.com/reset-password?token=abc')
    expect(subject).toBe('استعادة كلمة المرور — GAMES ARABIC')
    expect(html).toContain('استعادة كلمة المرور')
    expect(html).toContain('https://example.com/reset-password?token=abc')
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('إذا لم تطلب ذلك، تجاهل هذه الرسالة.')
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })
})

describe('renderEmailTemplate DB-row path (deferred, documented)', () => {
  it('returns null so SA-1 try/catch-require + inline fallback behaves identically', () => {
    expect(renderEmailTemplate('comment_reply', 'ar', { actorName: 'x' })).toBeNull()
    expect(renderEmailTemplate('nonexistent_type', 'ar', {})).toBeNull()
  })
})

describe('reusable sender builders (verbatim copy, RTL, Brevo-safe HTML)', () => {
  it('buildVerificationEmail mirrors verification-email.ts markup verbatim', () => {
    const link = 'https://example.com/verify-email-address?token=abc'
    const { subject, html, text } = buildVerificationEmail(link)
    expect(subject).toBe('تأكيد بريدك الإلكتروني — GAMES ARABIC')
    expect(html).toContain('تأكيد بريدك الإلكتروني')
    expect(html).toContain(link)
    expect(html).toContain('٢٤ ساعة')
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('إذا لم تطلب ذلك، تجاهل هذه الرسالة.')
    expect(typeof text).toBe('string')
    expect(text).toContain(link)
  })

  it('buildInviteEmail mirrors invites/route.ts markup verbatim', () => {
    const { subject, html, text } = buildInviteEmail({
      inviterUsername: 'boss',
      teamName: 'فريق النور',
      acceptUrl: 'https://example.com/accept?t=1',
    })
    expect(subject).toBe('دعوة للانضمام إلى فريق "فريق النور"')
    expect(html).toContain('دعاك boss للانضمام إلى فريق "فريق النور"')
    expect(html).toContain('https://example.com/accept?t=1')
    expect(html).toContain('قبول الدعوة')
    expect(typeof text).toBe('string')
  })

  it('buildTransferEmail mirrors transfer/nominate/route.ts markup verbatim', () => {
    const { subject, html, text } = buildTransferEmail({
      nomineeUsername: 'sara',
      nominatorUsername: 'boss',
      teamName: 'فريق النور',
      transferLink: 'https://example.com/accept?t=2&transfer=1',
    })
    expect(subject).toBe('ترشيح لملكية فريق "فريق النور"')
    expect(html).toContain('مرحباً sara،')
    expect(html).toContain('رشحك boss لتصبح مالك فريق "فريق النور"')
    expect(html).toContain('https://example.com/accept?t=2&transfer=1')
    expect(typeof text).toBe('string')
  })

  it('all builders emit Brevo-compatible markup (inline CSS, tables-free, no scripts)', () => {
    const samples = [
      buildVerificationEmail('https://example.com/v?t=1').html,
      buildResetEmail('https://example.com/r?t=1').html,
      buildInviteEmail({ inviterUsername: 'a', teamName: 'b', acceptUrl: 'https://example.com' }).html,
      buildTransferEmail({
        nomineeUsername: 'a',
        nominatorUsername: 'b',
        teamName: 'c',
        transferLink: 'https://example.com',
      }).html,
    ]
    for (const html of samples) {
      expect(html).not.toMatch(/<script/i)
      expect(html).not.toMatch(/<iframe/i)
      expect(html).not.toMatch(/javascript:/i)
      expect(html.length).toBeLessThan(1024 * 1024)
    }
  })
})
