/**
 * lib/email/from.ts — single source of truth for the email From address (SA-2).
 *
 * WHY LOGICAL-OR AND NOT NULLISH COALESCING:
 * Nullish coalescing only falls back on null/undefined, so an
 * explicitly-set-but-empty `EMAIL_FROM=''` would leak through as an empty
 * From header and the provider would reject the send (or worse, emit a malformed
 * message). Logical-or also falls back on empty-string values, guaranteeing
 * callers always get a usable address. SA-1 sender files import this instead
 * of hardcoding.
 */
export function emailFrom(): string {
  return process.env.EMAIL_FROM || 'noreply@games-arabic.com'
}
