/**
 * lib/telegram-login.ts — canonical Telegram login (D.1 slice 3).
 *
 * Unifies the four duplicated performLogin copies that drifted apart across:
 * - app/api/auth/telegram/route.ts          (deep-link, no displayName, no ledger)
 * - app/api/auth/telegram/callback/route.ts (widget, displayName, no ledger)
 * - app/api/auth/telegram/poll/route.ts     (deep-link, no displayName, no ledger)
 * - app/api/auth/telegram-bridge/route.ts   (widget, hand-rolled JWT, random-suffix usernames)
 *
 * Canonical semantics (superset of the four):
 * 1. Reuse the user behind OAuthAccount('telegram', telegramId); refresh the
 *    avatar when missing or changed.
 * 2. Else reuse the synthetic-email user and ensure exactly one link row.
 * 3. Else create user (unique username, displayName, member, emailVerified)
 *    + link row.
 * 4. Ban gate — banned users get no cookie, no loginCount bump, no ledger.
 * 5. setRoleCookie + lastLoginAt/loginCount + Session ledger row + audit log.
 *
 * Ledger creation is fail-soft (returns ledgerToken null) so a Session-table
 * outage degrades to a ledger-less login instead of a 500.
 */

import { randomUUID } from 'crypto'
import { getBanStatus, setRoleCookie, type UserRole } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { generateUniqueUsername } from '@/lib/username-generator'

export const TELEGRAM_PROVIDER = 'telegram'
export const TELEGRAM_SESSION_TTL_DAYS = 7

export interface TelegramUserData {
  telegramId: number
  firstName: string
  lastName?: string | null
  username?: string | null
  photoUrl?: string | null
}

export interface TelegramLoginContext {
  ipAddress?: string | null
  userAgent?: string | null
}

export interface TelegramLoginSuccessUser {
  id: string
  username: string
  email: string
  role: string
  avatarUrl: string | null
}

export type TelegramLoginResult =
  | {
      ok: true
      user: TelegramLoginSuccessUser
      ledgerToken: string | null
      ledgerExpires: Date | null
    }
  | { ok: false; status: 'banned' | 'error'; error: string }

/** Synthetic, undeliverable identity keyed deterministically by telegram id. */
export function telegramSyntheticEmail(telegramId: number | string): string {
  return `telegram_${telegramId}@telegram.local`
}

const userSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  avatarUrl: true,
  banStatus: true,
  bannedUntil: true,
  banReason: true,
  tokenVersion: true,
  onboardingCompleted: true,
} as const

type CanonicalUser = {
  id: string
  username: string
  email: string
  role: string
  avatarUrl: string | null
  banStatus: string
  bannedUntil: Date | null
  banReason: string | null
  tokenVersion: number
  onboardingCompleted: boolean
}

export async function performTelegramLogin(
  userData: TelegramUserData,
  ctx: TelegramLoginContext = {},
): Promise<TelegramLoginResult> {
  try {
    const { telegramId, firstName, lastName, username, photoUrl } = userData
    const providerAccountId = String(telegramId)

    const displayName =
      [firstName, lastName].filter(Boolean).join(' ') || username || `Telegram User ${telegramId}`
    const email = telegramSyntheticEmail(telegramId)
    const avatarUrl = photoUrl || null

    // Step 1: reuse the user behind an existing telegram link.
    let neonUser: CanonicalUser | null = null
    const existingOAuth = await db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: { provider: TELEGRAM_PROVIDER, providerAccountId },
      },
      include: { user: { select: userSelect } },
    })

    if (existingOAuth) {
      neonUser = existingOAuth.user as CanonicalUser
      if (!neonUser.avatarUrl || neonUser.avatarUrl !== avatarUrl) {
        try {
          neonUser = (await db.user.update({
            where: { id: neonUser.id },
            data: { avatarUrl },
            select: userSelect,
          })) as CanonicalUser
        } catch {
          // keep the stored user — avatar refresh is best-effort
        }
      }
    } else {
      // Step 2: reuse the synthetic-email user, ensuring exactly one link row.
      const emailUser = (await db.user.findUnique({
        where: { email },
        select: userSelect,
      })) as CanonicalUser | null

      if (emailUser) {
        neonUser = emailUser
        const existingLink = await db.oAuthAccount.findUnique({
          where: {
            provider_providerAccountId: { provider: TELEGRAM_PROVIDER, providerAccountId },
          },
        })
        if (!existingLink) {
          await db.oAuthAccount.create({
            data: {
              userId: emailUser.id,
              provider: TELEGRAM_PROVIDER,
              providerAccountId,
              providerEmail: email,
              providerUsername: username || null,
              avatarUrl,
            },
          })
        }
      } else {
        // Step 3: create user + link.
        const baseUsername = username || displayName.toLowerCase().replace(/\s+/g, '_')
        const finalUsername = await generateUniqueUsername(baseUsername)

        neonUser = (await db.user.upsert({
          where: { email },
          create: {
            username: finalUsername,
            displayName,
            email,
            avatarUrl,
            role: 'member',
            emailVerified: true,
          },
          update: {},
          select: userSelect,
        })) as CanonicalUser

        const linkExists = await db.oAuthAccount.findUnique({
          where: {
            provider_providerAccountId: { provider: TELEGRAM_PROVIDER, providerAccountId },
          },
        })
        if (!linkExists) {
          await db.oAuthAccount.create({
            data: {
              userId: neonUser.id,
              provider: TELEGRAM_PROVIDER,
              providerAccountId,
              providerEmail: email,
              providerUsername: username || null,
              avatarUrl,
            },
          })
        }
      }
    }

    // Step 4: ban gate — no cookie, no counters, no ledger for banned users.
    const ban = getBanStatus(neonUser)
    if (ban.banned) {
      return { ok: false, status: 'banned', error: 'حسابك محظور' }
    }

    // Step 5: cookie + counters + ledger + audit.
    await setRoleCookie(
      neonUser.id,
      neonUser.role as UserRole,
      neonUser.tokenVersion,
      false,
      neonUser.onboardingCompleted,
    )

    await db.user.update({
      where: { id: neonUser.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    let ledgerToken: string | null = null
    let ledgerExpires: Date | null = null
    try {
      ledgerToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
      ledgerExpires = new Date(Date.now() + TELEGRAM_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
      const now = new Date()
      await db.session.create({
        data: {
          id: randomUUID(),
          token: ledgerToken,
          userId: neonUser.id,
          expiresAt: ledgerExpires,
          createdAt: now,
          updatedAt: now,
          ipAddress: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        } as any,
      })
    } catch (e) {
      console.warn('[performTelegramLogin] ledger create failed', e)
      ledgerToken = null
      ledgerExpires = null
    }

    await logAction({
      userId: neonUser.id,
      username: neonUser.username,
      action: 'login',
      entity: 'user',
      entityId: neonUser.id,
    })

    return {
      ok: true,
      user: {
        id: neonUser.id,
        username: neonUser.username,
        email: neonUser.email,
        role: neonUser.role,
        avatarUrl: neonUser.avatarUrl,
      },
      ledgerToken,
      ledgerExpires,
    }
  } catch (err) {
    console.error('[performTelegramLogin] failed:', err)
    return { ok: false, status: 'error', error: 'حدث خطأ أثناء تسجيل الدخول' }
  }
}
