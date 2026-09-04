/**
 * lib/telegram-sessions.ts — إدارة sessions تسجيل الدخول عبر Telegram باستخدام Redis.
 *
 * يحل مشكلة filesystem في بيئات serverless (Vercel).
 */

import { redisGet, redisSet, redisDel } from './redis'

const SESSION_PREFIX = 'telegram_session:'
const SESSION_TTL = 5 * 60 // 5 دقائق

export interface TelegramSession {
  used: boolean
  expiresAt: number
  createdAt: number
  userData?: {
    telegramId: number
    firstName: string
    lastName?: string | null
    username?: string | null
    photoUrl?: string | null
  }
  user?: {
    id: string
    username: string
    email: string
    role: string
    avatarUrl: string | null
  }
}

function getSessionKey(token: string): string {
  return `${SESSION_PREFIX}${token}`
}

/** إنشاء session جديد */
export async function createTelegramSession(token: string): Promise<void> {
  const session: TelegramSession = {
    used: false,
    expiresAt: Date.now() + SESSION_TTL * 1000,
    createdAt: Date.now(),
  }
  await redisSet(getSessionKey(token), session, SESSION_TTL)
}

/** قراءة session */
export async function getTelegramSession(token: string): Promise<TelegramSession | null> {
  return redisGet<TelegramSession>(getSessionKey(token))
}

/** تحديث session (عند اكتشاف المستخدم) */
export async function updateTelegramSession(
  token: string,
  session: TelegramSession,
): Promise<void> {
  const remaining = Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000))
  await redisSet(getSessionKey(token), session, remaining)
}

/** حذف session */
export async function deleteTelegramSession(token: string): Promise<void> {
  await redisDel(getSessionKey(token))
}
