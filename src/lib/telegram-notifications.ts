/**
 * lib/telegram-notifications.ts — Telegram-first user notification service.
 *
 * Thin, fail-open layer over lib/telegram-bot.ts `sendMessage` (which owns
 * the Bot API call, token handling, and retry policy):
 * - chat IDs are NUMERIC Telegram user/chat IDs (never usernames)
 * - all interpolated user content is HTML-escaped (Telegram renders HTML)
 * - unconfigured bot / API errors / rate limits resolve { ok:false } and
 *   NEVER throw — callers treat Telegram as advisory, auth flows continue
 * - token is read from env inside telegram-bot.ts; never logged here
 */

import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/telegram-bot'

export interface TelegramNotification {
  /** Numeric Telegram chat_id (= user_id for DMs). Never a username. */
  chatId: number | string
  /** Arabic message text (already HTML-formatted by telegram-templates). */
  text: string
  parseMode?: 'HTML' | 'MarkdownV2'
  /** Inline keyboard buttons, e.g. { inline_keyboard: [[{ text, url }]] }. */
  replyMarkup?: object
}

export interface TelegramSendResult {
  ok: boolean
  error?: string
}

/** Escape user-controlled text for Telegram HTML parse mode. */
export function escapeTelegramHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** A Telegram chat target must be a finite numeric ID. */
export function isValidChatId(chatId: number | string): boolean {
  if (typeof chatId === 'number') return Number.isFinite(chatId)
  return /^\d+$/.test(chatId.trim())
}

/** Bot configured = token present (checked inside telegram-bot.ts). */
export function hasTelegramBot(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN
}

// Best-effort in-process guard for Telegram's ~30 msg/sec/bot flood limit.
// Distributed exactness is unnecessary: a 429 from the API is also handled
// fail-open below.
const WINDOW_MS = 1000
const MAX_PER_WINDOW = 25
let windowStart = 0
let windowCount = 0

function checkLocalRate(): boolean {
  const now = Date.now()
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now
    windowCount = 0
  }
  if (windowCount >= MAX_PER_WINDOW) return false
  windowCount += 1
  return true
}

export async function sendTelegramNotification(
  notification: TelegramNotification,
): Promise<TelegramSendResult> {
  const { chatId } = notification
  try {
    if (!hasTelegramBot()) {
      return { ok: false, error: 'telegram bot not configured' }
    }
    if (!isValidChatId(chatId)) {
      logger.warn('[telegram-notifications] invalid chat id, skipped')
      return { ok: false, error: 'invalid chat id' }
    }
    if (!checkLocalRate()) {
      logger.warn('[telegram-notifications] local flood guard tripped, skipped')
      return { ok: false, error: 'rate limited' }
    }
    const text = notification.text.slice(0, 4000)
    const result = await sendMessage({
      chatId: String(chatId),
      text,
      parseMode: notification.parseMode ?? 'HTML',
      ...(notification.replyMarkup ? { replyMarkup: notification.replyMarkup } : {}),
    })
    if (!result.ok) {
      // 429 / blocked-bot / chat-not-found all land here — advisory only.
      // 403 (blocked / never-started bot) is user-caused → warn only.
      // Anything else (400, 5xx, network) is a bot/config problem → Sentry.
      const blocked = result.error_code === 403
      logger.warn('[telegram-notifications] send failed', {
        chatId: String(chatId),
        description: result.description,
        error_code: result.error_code,
        blocked,
      })
      if (!blocked) {
        reportError(
          new Error(`[telegram-notifications] send failed: ${result.description || 'unknown'}`),
          { route: 'telegram-notifications:send' },
        )
      }
      return { ok: false, error: result.description || 'send failed' }
    }
    logger.info('[telegram-notifications] sent', { chatId: String(chatId) })
    return { ok: true }
  } catch (err) {
    logger.warn('[telegram-notifications] failed open', err)
    return { ok: false, error: 'failed open' }
  }
}

/** Inline URL button keyboard helper. */
export function urlButton(
  text: string,
  url: string,
): { inline_keyboard: Array<Array<{ text: string; url: string }>> } {
  return { inline_keyboard: [[{ text, url }]] }
}
