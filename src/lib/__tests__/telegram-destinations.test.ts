/**
 * Phase 1 (Telegram Rich-Text) — دوال التحقق من الوجهة.
 * نقية تماماً: لا شبكة، لا قاعدة بيانات، لا إرسال.
 */
import {
  classifyTelegramChatId,
  DESTINATION_TOKEN_DEFAULT_MAX_AGE_MS,
  destinationReadiness,
  parseTelegramDestination,
  signDestinationVerificationToken,
  TELEGRAM_CHAT_TYPES,
  TELEGRAM_DESTINATION_STATUSES,
  TELEGRAM_VERIFICATION_STATUSES,
  verifyDestinationVerificationToken,
} from '../telegram-destinations'

describe('all destination chat types are eligible', () => {
  it('accepts channel/group/supergroup/private/bot with no allowlist', () => {
    expect([...TELEGRAM_CHAT_TYPES].sort()).toEqual(
      ['bot', 'channel', 'group', 'private', 'supergroup', 'unknown'].sort(),
    )
    expect([...TELEGRAM_DESTINATION_STATUSES].sort()).toEqual(
      ['active', 'disabled', 'pending'].sort(),
    )
    expect([...TELEGRAM_VERIFICATION_STATUSES].sort()).toEqual(
      ['failed', 'unverified', 'verified'].sort(),
    )
  })

  it('parses every chat-type shape without rejecting on type', () => {
    const samples: Array<[string, string]> = [
      ['-1001234567890', 'supergroup'], // channel/supergroup (بادئة -100)
      ['-4321', 'group'],
      ['42424242', 'private'],
      ['+42424242', 'private'], // علامة موجبة تُطبَّع
      ['@games_arabic', 'unknown'], // username يحتاج استعلاماً لتحديد النوع
    ]
    for (const [raw, expectedType] of samples) {
      const result = parseTelegramDestination(raw)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.ref.chatType).toBe(expectedType)
    }
  })
})

describe('parseTelegramDestination', () => {
  it('canonicalises numeric chat ids', () => {
    const result = parseTelegramDestination('  -1001234567890  ')
    expect(result).toMatchObject({
      ok: true,
      ref: { canonical: '-1001234567890', kind: 'chat_id', chatType: 'supergroup' },
    })
  })

  it('canonicalises @handles and keeps the bare username', () => {
    const result = parseTelegramDestination('@My_Channel_1')
    expect(result).toMatchObject({
      ok: true,
      ref: { canonical: '@My_Channel_1', kind: 'username', username: 'My_Channel_1' },
    })
  })

  it('rejects invalid input with a precise reason', () => {
    expect(parseTelegramDestination('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseTelegramDestination('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(parseTelegramDestination(null)).toEqual({ ok: false, reason: 'empty' })
    expect(parseTelegramDestination(123 as unknown as string)).toEqual({
      ok: false,
      reason: 'empty',
    })
    expect(parseTelegramDestination('x'.repeat(65))).toEqual({ ok: false, reason: 'too_long' })
    expect(parseTelegramDestination('@ab')).toEqual({ ok: false, reason: 'invalid_username' })
    expect(parseTelegramDestination('@1handle')).toEqual({
      ok: false,
      reason: 'invalid_username',
    })
    expect(parseTelegramDestination('not-a-chat')).toEqual({
      ok: false,
      reason: 'invalid_chat_id',
    })
  })
})

describe('classifyTelegramChatId', () => {
  it('derives the type from the numeric shape only', () => {
    expect(classifyTelegramChatId('-100999')).toBe('supergroup')
    expect(classifyTelegramChatId('-999')).toBe('group')
    expect(classifyTelegramChatId('999')).toBe('private')
    expect(classifyTelegramChatId('@handle')).toBe('unknown')
    expect(classifyTelegramChatId('')).toBe('unknown')
  })
})

describe('destination verification token', () => {
  const secret = 'test-bot-token'
  const chatId = '-1001234567890'

  it('round-trips for the same chat and secret', () => {
    const issuedAt = 1_700_000_000_000
    const token = signDestinationVerificationToken({ chatId, secret, issuedAt })
    expect(token).toMatch(/^\d+\.[0-9a-f]{64}$/)
    expect(
      verifyDestinationVerificationToken(token, {
        chatId,
        secret,
        issuedAt: 0,
        now: issuedAt + 1000,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects a token issued for another chat', () => {
    const issuedAt = 1_700_000_000_000
    const token = signDestinationVerificationToken({ chatId: '-100111', secret, issuedAt })
    expect(
      verifyDestinationVerificationToken(token, { chatId, secret, now: issuedAt + 1000 }),
    ).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('rejects a tampered signature and malformed tokens', () => {
    const issuedAt = 1_700_000_000_000
    const token = signDestinationVerificationToken({ chatId, secret, issuedAt })
    const [stamp, signature] = token.split('.')
    const forged = `${stamp}.${signature.replace(/^./, signature[0] === 'a' ? 'b' : 'a')}`
    expect(verifyDestinationVerificationToken(forged, { chatId, secret, now: issuedAt })).toEqual({
      ok: false,
      reason: 'mismatch',
    })
    expect(verifyDestinationVerificationToken('garbage', { chatId, secret })).toEqual({
      ok: false,
      reason: 'malformed',
    })
    expect(verifyDestinationVerificationToken(`${issuedAt}.`, { chatId, secret })).toEqual({
      ok: false,
      reason: 'malformed',
    })
    expect(verifyDestinationVerificationToken(null, { chatId, secret })).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('rejects expired and not-yet-valid tokens', () => {
    const issuedAt = 1_700_000_000_000
    const token = signDestinationVerificationToken({ chatId, secret, issuedAt })
    expect(
      verifyDestinationVerificationToken(token, {
        chatId,
        secret,
        now: issuedAt + DESTINATION_TOKEN_DEFAULT_MAX_AGE_MS + 1,
      }),
    ).toEqual({ ok: false, reason: 'expired' })
    expect(
      verifyDestinationVerificationToken(token, { chatId, secret, now: issuedAt - 1 }),
    ).toEqual({ ok: false, reason: 'expired' })
  })
})

describe('destinationReadiness', () => {
  it('is ready only for active + verified destinations', () => {
    expect(destinationReadiness({ status: 'active', verificationStatus: 'verified' })).toEqual({
      ready: true,
      reason: 'ok',
    })
  })

  it('blocks every other combination with a reason', () => {
    expect(destinationReadiness({ status: 'pending', verificationStatus: 'unverified' })).toEqual({
      ready: false,
      reason: 'pending',
    })
    expect(destinationReadiness({ status: 'disabled', verificationStatus: 'verified' })).toEqual({
      ready: false,
      reason: 'disabled',
    })
    expect(destinationReadiness({ status: 'active', verificationStatus: 'unverified' })).toEqual({
      ready: false,
      reason: 'unverified',
    })
    expect(destinationReadiness({ status: 'active', verificationStatus: 'failed' })).toEqual({
      ready: false,
      reason: 'failed_verification',
    })
    expect(destinationReadiness({ status: 'active', verificationStatus: null })).toEqual({
      ready: false,
      reason: 'unverified',
    })
  })
})
