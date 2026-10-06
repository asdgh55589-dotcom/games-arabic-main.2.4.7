/**
 * Telegram Rich-Text Phase 0 — canonical contract tests.
 *
 * Binding (task source): all types eligible; security hardcoded;
 * manager-only broadcast; paid disabled; Node22; legacy untouched;
 * no DB / delivery / UI.
 */

import * as richTextContract from '../rich-text'
import {
  documentPlainText,
  makeRichDocument,
  RICH_DOCUMENT_VERSION,
  RICH_MARK_TYPES,
  RICH_TEXT_LIMITS,
  type RichDocument,
  type RichSegment,
  richLink,
  richText,
} from '../rich-text/canonical-rich-document'
import {
  canUseRichDestination,
  RICH_DESTINATION_KINDS,
  RICH_DESTINATIONS,
} from '../rich-text/destination-types'
import {
  applyRichFallback,
  RICH_FALLBACK_POLICY,
  RICH_FALLBACK_REASONS,
  resolveRichFallback,
} from '../rich-text/fallback-policies'
import {
  buildRichBroadcastKey,
  buildRichSendKey,
  isValidRichIdempotencyKey,
  parseRichIdempotencyKey,
  RICH_BROADCAST_OPERATION,
  RICH_IDEMPOTENCY_KEY_RE,
  RICH_IDEMPOTENCY_MAX_KEY_LENGTH,
  RICH_IDEMPOTENCY_TTL_SECONDS,
  RICH_SEND_OPERATION,
  richLockRedisKey,
  richResponseRedisKey,
  sanitizeIdempotencyComponent,
} from '../rich-text/idempotency-formats'
import {
  parseRichSnapshot,
  RICH_SNAPSHOT_SPEC_VERSION,
  richSnapshotFileName,
  serializeRichSnapshot,
  stableStringify,
  toRichSnapshot,
} from '../rich-text/snapshot-spec'
import {
  CANONICAL_ONLY_TYPES,
  classifyNotificationType,
  getTemplateTypeRegistration,
  isRichEligibleType,
  LEGACY_NOTIFICATION_TYPES,
  LEGACY_ONLY_TYPES,
  RICH_ELIGIBLE_TYPES,
  SECURITY_ROUTER_TYPES,
  SHARED_WITH_LEGACY_TYPES,
  TEMPLATE_TYPE_REGISTRY,
  TYPE_UNIVERSE_COUNTS,
} from '../rich-text/template-type-registry'
import {
  getVariableContract,
  isKnownVariable,
  RICH_VARIABLE_SANITIZERS,
  VARIABLE_CONTRACTS,
} from '../rich-text/variable-contracts'
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '../value-objects'

describe('canonical-rich-document', () => {
  it('pins the document version to 1', () => {
    expect(RICH_DOCUMENT_VERSION).toBe(1)
    expect(makeRichDocument([], [richText('مرحبا')]).version).toBe(1)
  })

  it('exposes the hardcoded mark whitelist', () => {
    expect([...RICH_MARK_TYPES]).toEqual([
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'spoiler',
      'code',
    ])
  })

  it('exposes hardcoded limits (Telegram 4096 ceiling)', () => {
    expect(RICH_TEXT_LIMITS.maxTotalLength).toBe(4096)
    expect(RICH_TEXT_LIMITS.maxTitleLength).toBe(256)
    expect(RICH_TEXT_LIMITS.maxSegments).toBe(256)
    expect(RICH_TEXT_LIMITS.maxMarksPerSegment).toBe(6)
    expect(RICH_TEXT_LIMITS.maxHrefLength).toBe(1024)
  })

  it('constructs text segments with explicit marks', () => {
    expect(richText('نص')).toEqual({ kind: 'text', text: 'نص', marks: [] })
    expect(richText('نص', [{ type: 'bold' }])).toEqual({
      kind: 'text',
      text: 'نص',
      marks: [{ type: 'bold' }],
    })
  })

  it('constructs link segments wrapping child text', () => {
    const seg = richLink('https://example.com/a', [richText('اضغط', [{ type: 'italic' }])])
    expect(seg.kind).toBe('link')
    expect(seg.href).toBe('https://example.com/a')
    expect(seg.children).toHaveLength(1)
    expect(seg.children[0]).toEqual({
      kind: 'text',
      text: 'اضغط',
      marks: [{ type: 'italic' }],
    })
  })

  it('documentPlainText strips marks and drops hrefs', () => {
    const doc = makeRichDocument(
      [richText('عنوان', [{ type: 'bold' }])],
      [
        richText('أهلاً '),
        richLink('https://example.com/secret-token', [richText('بالرابط')]),
        richText(' هنا', [{ type: 'italic' }]),
      ],
    )
    expect(documentPlainText(doc)).toBe('عنوان\n\nأهلاً بالرابط هنا')
    expect(documentPlainText(doc)).not.toContain('https://')
    expect(documentPlainText(doc)).not.toContain('secret-token')
  })

  it('joins title and body with a blank line, tolerating an empty title', () => {
    const noTitle = makeRichDocument([], [richText('جسم')])
    expect(documentPlainText(noTitle)).toBe('جسم')
    const withTitle = makeRichDocument([richText('عنوان')], [richText('جسم')])
    expect(documentPlainText(withTitle)).toBe('عنوان\n\nجسم')
  })

  it('builds plain segments for links whose children carry no marks', () => {
    const doc: RichDocument = makeRichDocument(
      [],
      [richLink('tg://resolve?domain=x', [richText('x')])],
    )
    const plain: readonly RichSegment[] = doc.body
    expect(plain).toHaveLength(1)
    expect(documentPlainText(doc)).toBe('x')
  })
})

describe('variable-contracts', () => {
  it('registers a contract for every NotificationType (all types eligible)', () => {
    for (const type of Object.values(NotificationType)) {
      expect(VARIABLE_CONTRACTS[type]).toBeDefined()
      expect(VARIABLE_CONTRACTS[type].length).toBeGreaterThan(0)
    }
    expect(Object.keys(VARIABLE_CONTRACTS)).toHaveLength(Object.values(NotificationType).length)
  })

  it('declares the exact comment_reply contract', () => {
    expect(getVariableContract(NotificationType.CommentReply)).toEqual([
      {
        name: 'actorName',
        kind: 'string',
        required: true,
        sanitizer: 'escape-telegram-html',
        maxLength: 256,
      },
      {
        name: 'modTitle',
        kind: 'string',
        required: true,
        sanitizer: 'escape-telegram-html',
        maxLength: 256,
      },
    ])
  })

  it('hardcodes sanitizers — every variable has one, whitelist only', () => {
    for (const defs of Object.values(VARIABLE_CONTRACTS)) {
      expect(defs.length).toBeGreaterThan(0)
      for (const def of defs) {
        expect(RICH_VARIABLE_SANITIZERS).toContain(def.sanitizer)
        expect(def.required).toBe(true)
        if (def.kind === 'string') expect(typeof def.maxLength).toBe('number')
        if (def.kind === 'number') {
          expect(typeof def.min).toBe('number')
          expect(typeof def.max).toBe('number')
        }
      }
    }
  })

  it('marks count as a bounded strict integer', () => {
    const count = getVariableContract(NotificationType.ModEndorseMilestone)?.find(
      (v) => v.name === 'count',
    )
    expect(count).toMatchObject({
      kind: 'number',
      sanitizer: 'strict-integer',
      min: 0,
      max: 1_000_000,
    })
  })

  it('caps free-text message variables at 4000 and names at 256', () => {
    const announcement = getVariableContract(NotificationType.SystemAnnouncement)?.[0]
    expect(announcement).toMatchObject({ name: 'announcementMessage', maxLength: 4000 })
    const follow = getVariableContract(NotificationType.Follow)?.[0]
    expect(follow).toMatchObject({ name: 'followerName', maxLength: 256 })
  })

  it('resolves unknown template types to undefined and knows variable names', () => {
    expect(getVariableContract('nope')).toBeUndefined()
    expect(isKnownVariable(NotificationType.CommentReply, 'actorName')).toBe(true)
    expect(isKnownVariable(NotificationType.CommentReply, 'evilVar')).toBe(false)
  })
})

describe('destination-types', () => {
  it('exposes exactly dm / broadcast / paid', () => {
    expect([...RICH_DESTINATION_KINDS]).toEqual(['dm', 'broadcast', 'paid'])
  })

  it('hardcodes policy per destination', () => {
    expect(RICH_DESTINATIONS.dm.enabled).toBe(true)
    expect(RICH_DESTINATIONS.dm.minimumRole).toBeUndefined()
    expect(RICH_DESTINATIONS.broadcast.enabled).toBe(true)
    expect(RICH_DESTINATIONS.broadcast.minimumRole).toBe('manager')
    // binding: paid disabled
    expect(RICH_DESTINATIONS.paid.enabled).toBe(false)
  })

  it('broadcast is manager-only: manager and owner pass, everyone else is denied', () => {
    expect(canUseRichDestination('broadcast', 'owner')).toEqual({
      allowed: true,
      destination: RICH_DESTINATIONS.broadcast,
    })
    expect(canUseRichDestination('broadcast', 'manager')).toMatchObject({ allowed: true })
    expect(canUseRichDestination('broadcast', 'admin')).toEqual({
      allowed: false,
      reason: 'insufficient_role',
    })
    expect(canUseRichDestination('broadcast', 'moderator')).toMatchObject({ allowed: false })
    expect(canUseRichDestination('broadcast', 'member')).toMatchObject({ allowed: false })
    expect(canUseRichDestination('broadcast', null)).toEqual({
      allowed: false,
      reason: 'insufficient_role',
    })
  })

  it('paid is disabled for every role, even owner', () => {
    for (const role of ['member', 'moderator', 'admin', 'manager', 'owner']) {
      expect(canUseRichDestination('paid', role)).toEqual({
        allowed: false,
        reason: 'destination_disabled',
      })
    }
    expect(canUseRichDestination('paid', null)).toMatchObject({ allowed: false })
  })

  it('dm needs no role, unknown kinds are denied as disabled', () => {
    expect(canUseRichDestination('dm', null)).toMatchObject({ allowed: true })
    expect(canUseRichDestination('dm', 'member')).toMatchObject({ allowed: true })
    expect(canUseRichDestination('group' as never, 'owner')).toEqual({
      allowed: false,
      reason: 'destination_disabled',
    })
  })
})

describe('template-type-registry', () => {
  it('covers every NotificationType exactly once', () => {
    const enumValues = Object.values(NotificationType)
    expect(Object.keys(TEMPLATE_TYPE_REGISTRY)).toHaveLength(enumValues.length)
    expect(enumValues.length).toBe(20)
    for (const type of enumValues) {
      const registration = TEMPLATE_TYPE_REGISTRY[type]
      expect(registration).toBeDefined()
      expect(registration.type).toBe(type)
      expect(registration.variables).toBe(VARIABLE_CONTRACTS[type])
    }
  })

  it('binding: every type is rich-eligible', () => {
    for (const registration of Object.values(TEMPLATE_TYPE_REGISTRY)) {
      expect(registration.richEligible).toBe(true)
    }
    expect(RICH_ELIGIBLE_TYPES.size).toBe(Object.values(NotificationType).length)
    expect([...RICH_ELIGIBLE_TYPES].sort()).toEqual([...Object.values(NotificationType)].sort())
  })

  it('defaults every type to the dm destination and a known category', () => {
    const allowedCategories = ['social', 'mods', 'tiers_roles', 'admin', 'system']
    for (const registration of Object.values(TEMPLATE_TYPE_REGISTRY)) {
      expect(registration.defaultDestination).toBe('dm')
      expect(allowedCategories).toContain(registration.category)
    }
    expect(TEMPLATE_TYPE_REGISTRY[NotificationType.CommentReply].category).toBe('social')
    expect(TEMPLATE_TYPE_REGISTRY[NotificationType.ModFeatured].category).toBe('mods')
    expect(TEMPLATE_TYPE_REGISTRY[NotificationType.TierUpgrade].category).toBe('tiers_roles')
    expect(TEMPLATE_TYPE_REGISTRY[NotificationType.AdminReport].category).toBe('admin')
    expect(TEMPLATE_TYPE_REGISTRY[NotificationType.SystemAnnouncement].category).toBe('system')
  })

  it('carries the Arabic label and the security lock on every registration', () => {
    for (const type of Object.values(NotificationType)) {
      const registration = TEMPLATE_TYPE_REGISTRY[type]
      // labelAr mirrors the domain labels — single source of truth, no drift
      expect(registration.labelAr).toBe(NOTIFICATION_TYPE_LABELS[type])
      expect(registration.labelAr.length).toBeGreaterThan(0)
      expect(registration.labelAr).toMatch(/[؀-ۿ]/)
      // binding: security hardcoded, compile-enforced as literal true
      expect(registration.securityLocked).toBe(true)
    }
  })

  it('reconciles the three type universes with pinned counts', () => {
    expect(TYPE_UNIVERSE_COUNTS).toEqual({
      canonical: 20,
      legacyNotificationTypes: 23,
      securityRouterTypes: 9,
      sharedWithLegacy: 14,
      legacyOnly: 9,
      canonicalOnly: 6,
    })
    expect(LEGACY_NOTIFICATION_TYPES).toHaveLength(TYPE_UNIVERSE_COUNTS.legacyNotificationTypes)
    expect(SECURITY_ROUTER_TYPES).toHaveLength(TYPE_UNIVERSE_COUNTS.securityRouterTypes)
    expect(SHARED_WITH_LEGACY_TYPES).toHaveLength(TYPE_UNIVERSE_COUNTS.sharedWithLegacy)
    expect(LEGACY_ONLY_TYPES).toHaveLength(TYPE_UNIVERSE_COUNTS.legacyOnly)
    expect(CANONICAL_ONLY_TYPES).toHaveLength(TYPE_UNIVERSE_COUNTS.canonicalOnly)

    // shared legacy types are canonical; legacy-only / security-router are not eligible
    expect(SHARED_WITH_LEGACY_TYPES).toContain('mod_published')
    expect(LEGACY_ONLY_TYPES).toContain('mod_submitted')
    expect(LEGACY_ONLY_TYPES).not.toContain('comment_reply')
    expect(CANONICAL_ONLY_TYPES).toContain('top_level_comment')
    expect(SECURITY_ROUTER_TYPES).toContain('password_reset')

    expect(classifyNotificationType('comment_reply')).toBe('canonical')
    expect(classifyNotificationType('mod_submitted')).toBe('legacy_only')
    expect(classifyNotificationType('password_reset')).toBe('security_router')
    expect(classifyNotificationType('nope')).toBe('unknown')

    expect(isRichEligibleType('mod_submitted')).toBe(false)
    expect(isRichEligibleType('password_reset')).toBe(false)
  })

  it('resolves eligibility by raw string, rejecting legacy-only types', () => {
    expect(isRichEligibleType('comment_reply')).toBe(true)
    expect(isRichEligibleType('system_announcement')).toBe(true)
    // present in legacy src/lib/notifications/types.ts but not canonical set
    expect(isRichEligibleType('mod_submitted')).toBe(false)
    expect(isRichEligibleType('nope')).toBe(false)
    expect(getTemplateTypeRegistration('nope')).toBeUndefined()
    expect(getTemplateTypeRegistration('like')?.type).toBe(NotificationType.Like)
  })
})

describe('idempotency-formats', () => {
  it('pins operation names, TTL and charset to the legacy idempotency contract', () => {
    expect(RICH_SEND_OPERATION).toBe('tg-rich-send')
    expect(RICH_BROADCAST_OPERATION).toBe('tg-rich-broadcast')
    // mirrors src/lib/idempotency.ts IDEMPOTENCY_TTL_SECONDS / MAX_KEY_LENGTH
    expect(RICH_IDEMPOTENCY_TTL_SECONDS).toBe(86400)
    expect(RICH_IDEMPOTENCY_MAX_KEY_LENGTH).toBe(128)
    expect(RICH_IDEMPOTENCY_KEY_RE.source).toBe('^[A-Za-z0-9_-]+$')
    expect('x'.repeat(128)).toMatch(RICH_IDEMPOTENCY_KEY_RE)
    expect('has space').not.toMatch(RICH_IDEMPOTENCY_KEY_RE)
    // length is a separate gate (mirrors legacy sanitizeKey: length + charset)
    expect(isValidRichIdempotencyKey('x'.repeat(129))).toBe(false)
    expect(isValidRichIdempotencyKey('x'.repeat(128))).toBe(true)
  })

  it('sanitizes components to [A-Za-z0-9-] (underscore reserved as separator)', () => {
    expect(sanitizeIdempotencyComponent('plain')).toBe('plain')
    expect(sanitizeIdempotencyComponent('user_1')).toBe('user-1')
    expect(sanitizeIdempotencyComponent('a:/../b  c')).toBe('a-b-c')
    expect(sanitizeIdempotencyComponent('تعليق')).toBe('')
    expect(sanitizeIdempotencyComponent('---x---')).toBe('x')
    expect(sanitizeIdempotencyComponent('')).toBe('')
    expect(sanitizeIdempotencyComponent('x'.repeat(80))).toHaveLength(48)
    expect(sanitizeIdempotencyComponent('x'.repeat(80))).toMatch(/^[A-Za-z0-9-]+$/)
  })

  it('builds charset-safe send keys that survive the legacy validator', () => {
    const key = buildRichSendKey({
      templateType: 'comment_reply',
      recipientId: 'user_1',
      dedupeRef: 'evt:42',
    })
    expect(key).toBe('comment_reply_user-1_evt-42')
    expect(key).toMatch(RICH_IDEMPOTENCY_KEY_RE)
    expect(key.length).toBeLessThanOrEqual(RICH_IDEMPOTENCY_MAX_KEY_LENGTH)
    expect(isValidRichIdempotencyKey(key)).toBe(true)
    expect(parseRichIdempotencyKey(key)).toEqual({
      kind: 'send',
      templateType: 'comment_reply',
      recipientId: 'user-1',
      dedupeRef: 'evt-42',
    })
  })

  it('parses multi-underscore canonical types (top_level_comment)', () => {
    const key = buildRichSendKey({
      templateType: 'top_level_comment',
      recipientId: 'u9',
      dedupeRef: 'r1',
    })
    expect(key).toBe('top_level_comment_u9_r1')
    expect(parseRichIdempotencyKey(key)).toEqual({
      kind: 'send',
      templateType: 'top_level_comment',
      recipientId: 'u9',
      dedupeRef: 'r1',
    })
  })

  it('builds broadcast keys and distinguishes them from send keys', () => {
    const key = buildRichBroadcastKey({ campaignRef: 'announce-2026-10' })
    expect(key).toBe('bcast_announce-2026-10')
    expect(isValidRichIdempotencyKey(key)).toBe(true)
    expect(parseRichIdempotencyKey(key)).toEqual({
      kind: 'broadcast',
      campaignRef: 'announce-2026-10',
    })
    expect(key).toMatch(RICH_IDEMPOTENCY_KEY_RE)
  })

  it('emits legacy-shaped redis keys', () => {
    expect(richResponseRedisKey(RICH_SEND_OPERATION, 'comment_reply_u-1_e-1')).toBe(
      'idempotency:tg-rich-send:comment_reply_u-1_e-1:resp',
    )
    expect(richLockRedisKey(RICH_SEND_OPERATION, 'comment_reply_u-1_e-1')).toBe(
      'idempotency:tg-rich-send:comment_reply_u-1_e-1:lock',
    )
    expect(richResponseRedisKey(RICH_BROADCAST_OPERATION, 'bcast_a')).toBe(
      'idempotency:tg-rich-broadcast:bcast_a:resp',
    )
  })

  it('rejects malformed keys', () => {
    expect(isValidRichIdempotencyKey('')).toBe(false)
    expect(isValidRichIdempotencyKey('has space')).toBe(false)
    expect(isValidRichIdempotencyKey('has:colon')).toBe(false)
    expect(isValidRichIdempotencyKey('has/slash')).toBe(false)
    expect(isValidRichIdempotencyKey('x'.repeat(129))).toBe(false)
    expect(parseRichIdempotencyKey('has space')).toBeNull()
    expect(parseRichIdempotencyKey('unknown_type_a_b')).toBeNull()
    expect(parseRichIdempotencyKey('comment_reply_onlytwo')).toBeNull()
  })
})

describe('snapshot-spec', () => {
  const sample = makeRichDocument(
    [richText('عنوان', [{ type: 'bold' }])],
    [richText('مرحبا '), richLink('https://example.com/a', [richText('بالرابط')])],
  )

  it('pins the snapshot spec version', () => {
    expect(RICH_SNAPSHOT_SPEC_VERSION).toBe(1)
  })

  it('stableStringify is key-order independent and compact', () => {
    expect(stableStringify({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}')
    expect(stableStringify({ x: 1, y: 2 })).toBe(stableStringify({ y: 2, x: 1 }))
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]')
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}')
    expect(stableStringify(stableStringify({ a: 1, b: 2 }))).toBe('"{\\"a\\":1,\\"b\\":2}"')
  })

  it('builds a deterministic snapshot envelope', () => {
    const snap = toRichSnapshot(sample)
    expect(snap.specVersion).toBe(1)
    expect(snap.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(snap.plainText).toBe(documentPlainText(sample))
    expect(snap.segmentCount).toBe(3)
    expect(toRichSnapshot(sample).hash).toBe(snap.hash)

    // key order inside segments must not change the hash
    const reordered = makeRichDocument([], [
      { marks: [], text: 'مرحبا ', kind: 'text' },
      {
        children: [{ marks: [], text: 'بالرابط', kind: 'text' }],
        href: 'https://example.com/a',
        kind: 'link',
      },
    ] as RichSegment[])
    expect(toRichSnapshot(reordered).hash).toBe(
      toRichSnapshot(
        makeRichDocument(
          [],
          [richText('مرحبا '), richLink('https://example.com/a', [richText('بالرابط')])],
        ),
      ).hash,
    )
  })

  it('serializes with a trailing newline and round-trips through parse', () => {
    const text = serializeRichSnapshot(toRichSnapshot(sample))
    expect(text.endsWith('\n')).toBe(true)
    const parsed = parseRichSnapshot(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.snapshot.hash).toBe(toRichSnapshot(sample).hash)
      expect(parsed.snapshot.plainText).toBe(sample.title.length ? documentPlainText(sample) : '')
    }
    expect(parseRichSnapshot(serializeRichSnapshot(toRichSnapshot(sample)))).toEqual(
      parseRichSnapshot(text),
    )
  })

  it('detects tampering, bad version and garbage', () => {
    const text = serializeRichSnapshot(toRichSnapshot(sample))
    const tampered = text.replace('مرحبا', 'احمرار')
    expect(parseRichSnapshot(tampered)).toEqual({ ok: false, error: 'hash_mismatch' })

    const wrongVersion = JSON.stringify({ ...toRichSnapshot(sample), specVersion: 99 })
    expect(parseRichSnapshot(wrongVersion)).toEqual({
      ok: false,
      error: 'unsupported_spec_version',
    })

    expect(parseRichSnapshot('{not json')).toEqual({ ok: false, error: 'invalid_json' })
    expect(parseRichSnapshot('null')).toEqual({ ok: false, error: 'not_an_object' })
    expect(parseRichSnapshot('[]')).toEqual({ ok: false, error: 'not_an_object' })
  })

  it('derives the golden file naming convention without touching disk', () => {
    expect(richSnapshotFileName('comment_reply')).toBe('rich-snapshot/comment_reply.json')
    expect(richSnapshotFileName('system_announcement')).toBe(
      'rich-snapshot/system_announcement.json',
    )
  })
})

describe('fallback-policies', () => {
  it('maps every reason to a hardcoded strategy', () => {
    expect([...RICH_FALLBACK_REASONS].sort()).toEqual(
      [
        'destination_denied',
        'document_invalid',
        'document_too_long',
        'rate_limited',
        'recipient_unreachable',
        'render_error',
        'unsafe_link',
        'unsupported_entity',
      ].sort(),
    )
    expect(RICH_FALLBACK_POLICY.document_invalid.strategy).toBe('drop')
    expect(RICH_FALLBACK_POLICY.document_too_long.strategy).toBe('truncate_plain')
    expect(RICH_FALLBACK_POLICY.unsupported_entity.strategy).toBe('plain_text')
    expect(RICH_FALLBACK_POLICY.unsafe_link.strategy).toBe('plain_text')
    expect(RICH_FALLBACK_POLICY.render_error.strategy).toBe('plain_text')
    expect(RICH_FALLBACK_POLICY.rate_limited.strategy).toBe('drop')
    expect(RICH_FALLBACK_POLICY.destination_denied.strategy).toBe('drop')
    expect(RICH_FALLBACK_POLICY.recipient_unreachable.strategy).toBe('drop')
    for (const rule of Object.values(RICH_FALLBACK_POLICY)) {
      expect(typeof rule.maxRenderAttempts).toBe('number')
      expect(rule.note.length).toBeGreaterThan(0)
    }
    expect(RICH_FALLBACK_POLICY.destination_denied.maxRenderAttempts).toBe(0)
    expect(RICH_FALLBACK_POLICY.render_error.maxRenderAttempts).toBe(1)
  })

  it('resolves unknown reasons conservatively to drop', () => {
    expect(resolveRichFallback('bogus_reason')).toMatchObject({ strategy: 'drop' })
    expect(resolveRichFallback('render_error').strategy).toBe('plain_text')
  })

  it('plain_text strips marks and links entirely', () => {
    const doc = makeRichDocument(
      [richText('عنوان', [{ type: 'bold' }])],
      [
        richText('نص ', [{ type: 'italic' }]),
        richLink('https://example.com/x', [richText('رابط')]),
      ],
    )
    const result = applyRichFallback(doc, 'render_error')
    expect(result.strategy).toBe('plain_text')
    expect(result.document).not.toBeNull()
    expect(result.plainText).toBe('عنوان\n\nنص رابط')
    expect(result.document?.title).toEqual([])
    expect(result.document?.body).toEqual([richText('عنوان\n\nنص رابط')])
    expect(JSON.stringify(result.document)).not.toContain('example.com')
    expect(JSON.stringify(result.document)).not.toContain('"marks":[{"type"')
  })

  it('truncate_plain caps at the 4096 ceiling', () => {
    const long = 'س'.repeat(5000)
    const doc = makeRichDocument([], [richText(long)])
    const result = applyRichFallback(doc, 'document_too_long')
    expect(result.strategy).toBe('truncate_plain')
    expect(result.plainText.length).toBe(RICH_TEXT_LIMITS.maxTotalLength)
    expect(result.document?.body[0]).toEqual(richText('س'.repeat(RICH_TEXT_LIMITS.maxTotalLength)))
  })

  it('drop never yields content', () => {
    const doc = makeRichDocument([], [richText('نص')])
    for (const reason of [
      'document_invalid',
      'rate_limited',
      'destination_denied',
      'recipient_unreachable',
    ] as const) {
      const result = applyRichFallback(doc, reason)
      expect(result).toEqual({ strategy: 'drop', document: null, plainText: '' })
    }
  })
})

describe('rich-text barrel', () => {
  it('exposes the full Phase 0 surface from a single entry point', () => {
    expect(richTextContract.richText).toBeDefined()
    expect(richTextContract.VARIABLE_CONTRACTS).toBeDefined()
    expect(richTextContract.canUseRichDestination).toBeDefined()
    expect(richTextContract.TEMPLATE_TYPE_REGISTRY).toBeDefined()
    expect(richTextContract.buildRichSendKey).toBeDefined()
    expect(richTextContract.toRichSnapshot).toBeDefined()
    expect(richTextContract.applyRichFallback).toBeDefined()
    expect(richTextContract.validateRichDocument).toBeDefined()
    expect(richTextContract.richText('x', [{ type: 'bold' }]).marks).toHaveLength(1)
    expect(
      richTextContract.validateRichDocument(
        richTextContract.makeRichDocument([], [richTextContract.richText('س')]),
      ).ok,
    ).toBe(true)
  })
})
