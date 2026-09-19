/**
 * lib/notification-router.ts — Telegram-first notification routing.
 *
 * Owner policy:
 * - Telegram-linked users: Telegram bot is PRIMARY for every type.
 *   A verified (non-synthetic) email gets a BACKUP copy only for critical
 *   security events (password_reset, password_changed).
 * - Email-only users: existing Brevo email flow, unchanged. Types with no
 *   email equivalent (new_login, welcome) are no-ops for them.
 * - Everything is fail-open: a dead bot or missing chat never blocks auth.
 */

import { db } from '@/lib/db'
import { sendPasswordChangedEmail } from '@/lib/password-changed-email'
import { sendPasswordResetEmail } from '@/lib/recovery-email'
import { isValidChatId, sendTelegramNotification } from '@/lib/telegram-notifications'
import {
  emailChangeMessage,
  mfaChangeMessage,
  newLoginAlert,
  passwordChangedMessage,
  passwordResetMessage,
  passwordSetupPrompt,
  recoveryInitiatedMessage,
  suspiciousActivityMessage,
  welcomeMessage,
} from '@/lib/telegram-templates'
import { logger } from '@/lib/logger'
import { isSyntheticTelegramEmail } from '@/lib/onboarding'

export type NotificationChannel = 'telegram' | 'email' | 'both'

export type NotificationType =
  | 'welcome'
  | 'password_setup_prompt'
  | 'password_reset'
  | 'password_changed'
  | 'new_login'
  | 'mfa_change'
  | 'email_change'
  | 'recovery'
  | 'suspicious'

export interface NotificationRequest {
  userId: string
  type: NotificationType
  /** Per-type payload (see builder switch below for contracts). */
  data: Record<string, any>
}

export interface RouteResult {
  telegram: boolean
  email: boolean
}

export function siteUrl(): string {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://games-arabic.com'
  ).replace(/\/$/, '')
  return base || 'https://games-arabic.com'
}

interface RouteTarget {
  username: string
  displayName: string
  email: string
  emailVerified: boolean
  telegramChatId: string | null
}

async function loadTarget(userId: string): Promise<RouteTarget | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { username: true, displayName: true, email: true, emailVerified: true },
    })
    if (!user) return null
    let telegramChatId: string | null = null
    try {
      const link = await db.oAuthAccount.findFirst({
        where: { userId, provider: 'telegram' },
        select: { providerAccountId: true },
      })
      if (link && isValidChatId(link.providerAccountId)) {
        telegramChatId = link.providerAccountId
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: no link → email-only path
    }
    return {
      username: user.username,
      displayName: user.displayName || user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      telegramChatId,
    }
  } catch (err) {
    logger.warn({ err, userId }, '[notification-router] target lookup failed')
    return null
  }
}

function hasVerifiedInbox(t: RouteTarget): boolean {
  return t.emailVerified && !isSyntheticTelegramEmail(t.email)
}

/** Any deliverable (non-synthetic) address — used only after the caller
 *  proved account access this session (password change / reset success). */
function hasRealEmail(t: RouteTarget): boolean {
  return !isSyntheticTelegramEmail(t.email)
}

/** Critical types get an email backup copy when a verified inbox exists. */
const CRITICAL_TYPES: ReadonlySet<NotificationType> = new Set(['password_reset', 'password_changed'])

export async function routeNotification(request: NotificationRequest): Promise<RouteResult> {
  const out: RouteResult = { telegram: false, email: false }
  try {
    const target = await loadTarget(request.userId)
    if (!target) return out
    const { type, data } = request

    // ── Telegram leg (primary for linked users) ──
    if (target.telegramChatId) {
      const built = buildTelegram(type, target, data)
      if (built) {
        const sent = await sendTelegramNotification({
          chatId: target.telegramChatId,
          text: built.text,
          ...(built.replyMarkup ? { replyMarkup: built.replyMarkup } : {}),
        })
        out.telegram = sent.ok
      }
      // ── Email backup leg (critical only). Reset LINKS go only to
      // verified inboxes (an unverified address may belong to someone else);
      // change notifications (no secret) go to any real address on file.
      if (CRITICAL_TYPES.has(type)) {
        try {
          if (type === 'password_reset' && typeof data.resetUrl === 'string') {
            if (hasVerifiedInbox(target)) {
              // data.resetUrl is the full link already minted by recover.
              out.email = await sendPasswordResetEmail(target.email, data.resetUrl)
            }
          } else if (type === 'password_changed') {
            if (hasRealEmail(target)) {
              out.email = await sendPasswordChangedEmail(target.email, {
                username: target.username,
                changedAt: typeof data.at === 'string' ? data.at : new Date().toISOString(),
                ip: typeof data.ip === 'string' ? data.ip : null,
              })
            }
          }
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: backup leg fail-open
        }
      }
      return out
    }

    // ── Email-only users: the session/token proved account access, so any
    // real (non-synthetic) inbox gets the notification. No prior flow is
    // removed; unset types stay silent.
    try {
      if (type === 'password_reset' && typeof data.resetUrl === 'string') {
        if (hasRealEmail(target)) {
          out.email = await sendPasswordResetEmail(target.email, data.resetUrl)
        }
      } else if (type === 'password_changed') {
        if (hasRealEmail(target)) {
          out.email = await sendPasswordChangedEmail(target.email, {
            username: target.username,
            changedAt: typeof data.at === 'string' ? data.at : new Date().toISOString(),
            ip: typeof data.ip === 'string' ? data.ip : null,
          })
        }
      }
      // new_login / welcome / mfa_change / email_change / suspicious have no
      // email equivalent for email-only users (no prior flow to preserve).
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: email leg fail-open
    }
    return out
  } catch (err) {
    logger.warn({ err }, '[notification-router] failed open')
    return out
  }
}

function buildTelegram(
  type: NotificationType,
  target: RouteTarget,
  data: Record<string, any>,
): { text: string; replyMarkup?: object } | null {
  const name = target.displayName
  switch (type) {
    case 'welcome':
      return welcomeMessage(name)
    case 'password_setup_prompt':
      return passwordSetupPrompt(
        name,
        typeof data.setupUrl === 'string' ? data.setupUrl : `${siteUrl()}/settings?setup-password=true`,
      )
    case 'password_reset':
      if (typeof data.resetUrl !== 'string') return null
      return passwordResetMessage(name, data.resetUrl)
    case 'password_changed':
      return passwordChangedMessage({
        displayName: name,
        at: data.at instanceof Date ? data.at : undefined,
        ip: typeof data.ip === 'string' ? data.ip : null,
      })
    case 'new_login':
      return newLoginAlert({
        displayName: name,
        device: typeof data.device === 'string' ? data.device : 'جهاز غير معروف',
        ip: typeof data.ip === 'string' ? data.ip : null,
        secureUrl:
          typeof data.secureUrl === 'string' ? data.secureUrl : `${siteUrl()}/settings/sessions`,
      })
    case 'mfa_change':
      if (data.action !== 'enabled' && data.action !== 'disabled') return null
      return mfaChangeMessage({ displayName: name, action: data.action })
    case 'email_change':
      if (typeof data.newEmail !== 'string') return null
      return emailChangeMessage({ displayName: name, newEmail: data.newEmail })
    case 'recovery':
      return recoveryInitiatedMessage(name)
    case 'suspicious':
      if (typeof data.detail !== 'string') return null
      return suspiciousActivityMessage({
        displayName: name,
        detail: data.detail,
        secureUrl:
          typeof data.secureUrl === 'string' ? data.secureUrl : `${siteUrl()}/settings?section=security`,
      })
    default:
      return null
  }
}

/**
 * Best-effort new-device login alert for Telegram-linked users.
 * Compares the current IP against the latest *other* ledger row; alerts on
 * mismatch. No-op for email-only users and on any failure.
 */
export async function maybeSendLoginAlert(
  userId: string,
  opts: { ip: string | null; userAgent: string | null; currentToken?: string | null },
): Promise<void> {
  try {
    const target = await loadTarget(userId)
    if (!target?.telegramChatId) return
    let previousIp: string | null | undefined
    try {
      const rows = (await db.session.findMany({
        where: { userId, expiresAt: { gt: new Date() } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { token: true, ipAddress: true },
      } as never)) as Array<{ token: string; ipAddress: string | null }>
      // Latest row that is NOT the just-created current session.
      const other = rows.find((r) => r.token !== opts.currentToken)
      if (!other) {
        // First-ever session (brand-new device) — worth one alert.
        previousIp = undefined
      } else {
        previousIp = other.ipAddress
      }
    } catch {
      return
    }
    const currentIp = opts.ip ?? null
    if (previousIp && currentIp && previousIp === currentIp) return
    const ua = (opts.userAgent || '').toLowerCase()
    const device = ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')
      ? 'هاتف'
      : ua.includes('tablet') || ua.includes('ipad')
        ? 'تابلت'
        : ua.includes('telegram')
          ? 'Telegram'
          : 'حاسوب'
    await routeNotification({
      userId,
      type: 'new_login',
      data: { displayName: target.displayName, device, ip: currentIp },
    })
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: alert is advisory
  }
}
