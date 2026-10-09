/**
 * idempotency-formats.ts — Telegram Rich-Text Phase 0 idempotency contract.
 *
 * Defines the canonical key shapes for rich sends so replays never double-post.
 * Keys satisfy the EXACT charset/length contract of the existing HTTP
 * idempotency layer (src/lib/idempotency.ts: /^[A-Za-z0-9_-]+$/, ≤128 chars,
 * 24h TTL) and redis keys reuse that layer's byte-identical
 * `idempotency:<op>:<key>:resp|lock` shape — a future delivery phase can pass
 * `operationKey` straight into checkIdempotency().
 *
 * Underscore is RESERVED as the component separator inside send keys;
 * every non-type component is sanitized to [A-Za-z0-9-] so parsing stays
 * unambiguous. Phase 0 contract only — no Redis calls, no delivery.
 */

import { NotificationType } from '../value-objects'

export const RICH_SEND_OPERATION = 'tg-rich-send'
export const RICH_BROADCAST_OPERATION = 'tg-rich-broadcast'

/** Mirrors IDEMPOTENCY_TTL_SECONDS in src/lib/idempotency.ts. */
export const RICH_IDEMPOTENCY_TTL_SECONDS = 86400
/** Mirrors MAX_KEY_LENGTH in src/lib/idempotency.ts. */
export const RICH_IDEMPOTENCY_MAX_KEY_LENGTH = 128
/** Mirrors KEY_RE in src/lib/idempotency.ts — keys must pass it unchanged. */
export const RICH_IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]+$/

/** Per-component charset (separator `_` excluded). */
const COMPONENT_RE = /^[A-Za-z0-9-]+$/
const MAX_COMPONENT_LENGTH = 48
const BROADCAST_PREFIX = 'bcast_'
const EMPTY_COMPONENT = 'na'

/**
 * Force a value into the component charset: every disallowed character
 * becomes `-`, runs collapse, edges trim, length caps at 48.
 * Nothing survives (e.g. pure Arabic text) → '' (builders substitute `na`).
 */
export function sanitizeIdempotencyComponent(raw: string): string {
  const replaced = raw.replace(/[^A-Za-z0-9-]+/g, '-')
  const collapsed = replaced.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '')
  return collapsed.slice(0, MAX_COMPONENT_LENGTH)
}

function component(raw: string): string {
  return sanitizeIdempotencyComponent(raw) || EMPTY_COMPONENT
}

export interface RichSendKeyParts {
  readonly templateType: NotificationType | string
  /** Recipient chat/user id — sanitized, never used for lookup as-is. */
  readonly recipientId: string
  /** Caller-supplied dedupe reference (event id, notification id …). */
  readonly dedupeRef: string
}

/**
 * `\<templateType>_<recipientId>_<dedupeRef>` — template type keeps its
 * canonical underscores; the other two components are hyphen-only.
 */
export function buildRichSendKey(parts: RichSendKeyParts): string {
  return [parts.templateType, component(parts.recipientId), component(parts.dedupeRef)].join('_')
}

export interface RichBroadcastKeyParts {
  /** Campaign/announcement reference that identifies one broadcast. */
  readonly campaignRef: string
}

/** `bcast_<campaignRef>` — never collides with a send key. */
export function buildRichBroadcastKey(parts: RichBroadcastKeyParts): string {
  return `${BROADCAST_PREFIX}${component(parts.campaignRef)}`
}

/**
 * Byte-identical to the legacy response key so both layers share one redis
 * namespace. Callers must pass a key that already passed isValidRichIdempotencyKey.
 */
export function richResponseRedisKey(operationKey: string, key: string): string {
  return `idempotency:${operationKey}:${key}:resp`
}

/** Byte-identical to the legacy in-flight lock key. */
export function richLockRedisKey(operationKey: string, key: string): string {
  return `idempotency:${operationKey}:${key}:lock`
}

export type ParsedRichIdempotencyKey =
  | {
      readonly kind: 'send'
      readonly templateType: string
      readonly recipientId: string
      readonly dedupeRef: string
    }
  | { readonly kind: 'broadcast'; readonly campaignRef: string }

/** Canonical type names longest-first so prefixes match unambiguously. */
const TYPE_NAMES_BY_LENGTH = Object.values(NotificationType)
  .map((type) => type as string)
  .sort((a, b) => b.length - a.length)

/**
 * Parse a rich idempotency key back into its parts.
 * Returns null for anything that is not a well-formed send or broadcast key
 * (charset, length, unknown type, wrong component count).
 */
export function parseRichIdempotencyKey(key: string): ParsedRichIdempotencyKey | null {
  if (!isValidRichIdempotencyKey(key)) return null
  if (key.startsWith(BROADCAST_PREFIX)) {
    const campaignRef = key.slice(BROADCAST_PREFIX.length)
    return COMPONENT_RE.test(campaignRef) ? { kind: 'broadcast', campaignRef } : null
  }
  for (const type of TYPE_NAMES_BY_LENGTH) {
    if (!key.startsWith(`${type}_`)) continue
    const rest = key.slice(type.length + 1)
    const segments = rest.split('_')
    if (segments.length !== 2) return null
    const [recipientId, dedupeRef] = segments
    if (!recipientId || !dedupeRef) return null
    return { kind: 'send', templateType: type, recipientId, dedupeRef }
  }
  return null
}

/** Charset + length validation (what the legacy layer enforces). */
export function isValidRichIdempotencyKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= RICH_IDEMPOTENCY_MAX_KEY_LENGTH &&
    RICH_IDEMPOTENCY_KEY_RE.test(key)
  )
}
