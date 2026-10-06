/**
 * fallback-policies.ts — Telegram Rich-Text Phase 0 fallback contract.
 *
 * When a rich document cannot be delivered as rich (validation failure, API
 * rejection, disabled destination …), these HARDCODED rules decide what happens.
 * Binding decisions encoded here:
 * - anything untrusted (invalid document, unknown reason) → drop, never send;
 * - oversize → truncate to the Telegram ceiling as plain text;
 * - content-shape problems (unsupported entity, unsafe link, render error) →
 *   plain text, which by construction carries no markup and no hrefs;
 * - operational failures (rate limit, denied destination, unreachable
 *   recipient) → drop (retry/lifecycle belongs to delivery, a later phase).
 *
 * Pure policy — no I/O, no DB, no delivery. Phase 0.
 */

import {
  documentPlainText,
  makeRichDocument,
  RICH_TEXT_LIMITS,
  type RichDocument,
  richText,
} from './canonical-rich-document'

export type RichFallbackReason =
  | 'document_invalid'
  | 'document_too_long'
  | 'unsupported_entity'
  | 'unsafe_link'
  | 'render_error'
  | 'rate_limited'
  | 'destination_denied'
  | 'recipient_unreachable'

export type RichFallbackStrategy = 'plain_text' | 'truncate_plain' | 'drop'

export interface RichFallbackRule {
  readonly reason: RichFallbackReason
  readonly strategy: RichFallbackStrategy
  /** How many delivery attempts this strategy permits (0 = never send). */
  readonly maxRenderAttempts: number
  readonly note: string
}

export const RICH_FALLBACK_REASONS: readonly RichFallbackReason[] = [
  'document_invalid',
  'document_too_long',
  'unsupported_entity',
  'unsafe_link',
  'render_error',
  'rate_limited',
  'destination_denied',
  'recipient_unreachable',
] as const

/** The single hardcoded reason → strategy matrix. */
export const RICH_FALLBACK_POLICY: Record<RichFallbackReason, RichFallbackRule> = {
  document_invalid: {
    reason: 'document_invalid',
    strategy: 'drop',
    maxRenderAttempts: 0,
    note: 'Document failed validation — untrusted input is never sent in any form.',
  },
  document_too_long: {
    reason: 'document_too_long',
    strategy: 'truncate_plain',
    maxRenderAttempts: 1,
    note: 'Strip markup and hard-truncate to the 4096 Telegram ceiling.',
  },
  unsupported_entity: {
    reason: 'unsupported_entity',
    strategy: 'plain_text',
    maxRenderAttempts: 1,
    note: 'Unknown markup cannot be rendered — downgrade the whole document.',
  },
  unsafe_link: {
    reason: 'unsafe_link',
    strategy: 'plain_text',
    maxRenderAttempts: 1,
    note: 'Non-https/tg href dropped with all markup — plain text never carries URLs.',
  },
  render_error: {
    reason: 'render_error',
    strategy: 'plain_text',
    maxRenderAttempts: 1,
    note: 'Renderer rejected the markup — one plain-text retry, then give up.',
  },
  rate_limited: {
    reason: 'rate_limited',
    strategy: 'drop',
    maxRenderAttempts: 0,
    note: 'Telegram flood control — dedupe/retry scheduling is delivery-phase work.',
  },
  destination_denied: {
    reason: 'destination_denied',
    strategy: 'drop',
    maxRenderAttempts: 0,
    note: 'Authorization gate refused the destination (paid disabled, role too low).',
  },
  recipient_unreachable: {
    reason: 'recipient_unreachable',
    strategy: 'drop',
    maxRenderAttempts: 0,
    note: 'No linked chat / blocked bot — nothing to fall back to.',
  },
}

/** Unknown or future reasons resolve to the conservative rule. */
const UNKNOWN_REASON_RULE: RichFallbackRule = RICH_FALLBACK_POLICY.document_invalid

/** Look up a rule; anything unregistered degrades to a conservative drop. */
export function resolveRichFallback(reason: RichFallbackReason | string): RichFallbackRule {
  return RICH_FALLBACK_POLICY[reason as RichFallbackReason] ?? UNKNOWN_REASON_RULE
}

export interface RichFallbackResult {
  readonly strategy: RichFallbackStrategy
  /** null only for `drop`. */
  readonly document: RichDocument | null
  readonly plainText: string
}

function toFlatPlainDocument(plain: string): RichDocument {
  return makeRichDocument([], [richText(plain)])
}

/**
 * Execute a fallback rule against a document. Both non-drop strategies emit
 * a markup-free document; `truncate_plain` additionally enforces the length
 * ceiling, and `plain_text` truncates defensively if it somehow exceeds it.
 */
export function applyRichFallback(
  doc: RichDocument,
  reason: RichFallbackReason | string,
): RichFallbackResult {
  const rule = resolveRichFallback(reason)
  if (rule.strategy === 'drop') {
    return { strategy: 'drop', document: null, plainText: '' }
  }
  const plain = documentPlainText(doc)
  const truncated =
    rule.strategy === 'truncate_plain' || plain.length > RICH_TEXT_LIMITS.maxTotalLength
      ? plain.slice(0, RICH_TEXT_LIMITS.maxTotalLength)
      : plain
  return {
    strategy: rule.strategy,
    document: toFlatPlainDocument(truncated),
    plainText: truncated,
  }
}
