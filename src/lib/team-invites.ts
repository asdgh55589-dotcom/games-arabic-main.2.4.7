import { createHash, randomBytes } from 'crypto'

/** Invitation links expire after 7 days. */
export const TEAM_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const TEAM_INVITE_STATUSES = ['pending', 'accepted', 'declined', 'revoked', 'expired'] as const
export type TeamInviteStatus = (typeof TEAM_INVITE_STATUSES)[number]

export interface InviteBinding {
  invitedUserId: string | null
  inviteeUsername: string | null
  inviteeEmail: string | null
}

export interface InviteAccepter {
  id: string
  username: string
  email: string
}

/** Secure random token (43 chars base64url). Returned ONCE at creation, never persisted. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 hex — the only token material ever stored. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function inviteExpiryDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + TEAM_INVITE_TTL_MS)
}

export function isInviteExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

/** Mask emails in list responses — full addresses are never returned. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const head = (local || '').slice(0, 1)
  const domainHead = domain.split('.')[0]?.slice(0, 1) ?? ''
  return `${head}***@${domainHead}***`
}

/** Binding check: an invite bound to a user/email/username can only be claimed by that identity. */
export function checkInviteBinding(
  invite: InviteBinding,
  user: InviteAccepter,
): { ok: true } | { ok: false; reason: string } {
  if (invite.invitedUserId && invite.invitedUserId !== user.id) {
    return { ok: false, reason: 'هذه الدعوة موجهة لمستخدم آخر' }
  }
  if (
    invite.inviteeEmail &&
    invite.inviteeEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    return { ok: false, reason: 'هذه الدعوة موجهة لبريد إلكتروني آخر' }
  }
  if (
    !invite.invitedUserId &&
    !invite.inviteeEmail &&
    invite.inviteeUsername &&
    invite.inviteeUsername.toLowerCase() !== user.username.toLowerCase()
  ) {
    return { ok: false, reason: 'هذه الدعوة موجهة لمستخدم آخر' }
  }
  return { ok: true }
}

export function buildInviteAcceptUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ''
  return `${base}/creator/team/join?token=${encodeURIComponent(token)}`
}
