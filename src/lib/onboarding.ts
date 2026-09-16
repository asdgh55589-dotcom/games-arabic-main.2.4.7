/**
 * lib/onboarding.ts — account-completion gate (D.6-a).
 *
 * Edge-safe (pure, no Node-only imports): proxy.ts imports this to funnel
 * non-onboarded members to /onboarding without a DB read. The `ob` claim in
 * ga_admin_role carries the flag; the DB column User.onboardingCompleted
 * remains the server-side source of truth (see requireOnboarded below).
 */

export const ONBOARDING_PATH = '/onboarding'

/** Synthetic, undeliverable Telegram identity — can never receive recovery mail. */
export function isSyntheticTelegramEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith('@telegram.local')
}

/**
 * P0-flexible: does this user still need security setup?
 * True when there is no password credential OR no real (recoverable) email.
 * Fail-safe: unknown state prompts setup rather than hiding it.
 */
export function needsSecuritySetup(input: {
  hasPassword?: boolean | null
  email?: string | null
}): boolean {
  if (input.hasPassword !== true) return true
  if (isSyntheticTelegramEmail(input.email)) return true
  return false
}

/** Path prefixes that must stay reachable while onboarding is incomplete. */
const EXEMPT_PREFIXES = [
  '/onboarding',
  '/login',
  '/admin/login',
  '/verify-email',
  '/api/auth/callback',
  '/api/auth/telegram',
  '/api/auth/telegram-bridge',
  '/api/auth/session-ledger',
  '/api/auth/register-ledger',
  '/api/auth/ledger-check',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/mfa',
  '/api/auth/onboarding',
  '/api/auth/recover',
  '/api/auth/reset-password',
  '/api/auth/send-verification-email',
  '/api/settings/link-account',
  '/api/settings/unlink-account',
  '/api/settings/linked-accounts',
]

function stripQuery(pathname: string): string {
  const q = pathname.indexOf('?')
  return q === -1 ? pathname : pathname.slice(0, q)
}

export function isOnboardingExemptPath(pathname: string): boolean {
  const path = stripQuery(pathname)
  if (EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) return true
  // POST /api/users/:username/link-telegram (verified Telegram linking)
  if (path.startsWith('/api/users/') && path.endsWith('/link-telegram')) return true
  return false
}

export type OnboardingGateDecision = 'allow' | 'redirect' | 'json'

/**
 * - non-member roles (incl. creator/publisher/staff): always allow
 * - ob true OR undefined (legacy cookies): allow (fail-open at Edge)
 * - member + ob false: redirect pages to /onboarding, APIs get a JSON gate
 */
export function getOnboardingGate(
  role: string | undefined,
  onboarded: boolean | undefined,
  pathname: string,
): OnboardingGateDecision {
  if (role !== 'member') return 'allow'
  if (onboarded !== false) return 'allow'
  if (isOnboardingExemptPath(pathname)) return 'allow'
  if (stripQuery(pathname).startsWith('/api/')) return 'json'
  return 'redirect'
}
