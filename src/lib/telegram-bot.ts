/**
 * lib/telegram-bot.ts — Telegram Bot API integration
 *
 * Uses native fetch (no SDK dependency). Supports text messages,
 * photos, and inline keyboards.
 */

import { telegramPolicy } from '@/lib/resilience/policies'

const TELEGRAM_API = 'https://api.telegram.org/bot'

interface TelegramResponse {
  ok: boolean
  result?: any
  description?: string
  error_code?: number
}

interface SendMessageOptions {
  chatId: string
  text: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  replyMarkup?: object
  disablePreview?: boolean
}

interface SendPhotoOptions {
  chatId: string
  photo: string
  caption?: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
}

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null
}

function getChannelId(): string | null {
  return process.env.TELEGRAM_CHANNEL_ID || null
}

async function apiCall(method: string, body: object): Promise<TelegramResponse> {
  const token = getBotToken()
  if (!token) {
    return { ok: false, description: 'Bot token not configured' }
  }

  try {
    // Retry network failures via cockatiel (2 attempts, fast backoff).
    // Behavior unchanged: any failure still resolves to { ok: false }.
    const res = await telegramPolicy.execute(() =>
      fetch(`${TELEGRAM_API}${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    )
    return await res.json()
  } catch (err) {
    console.error(`[telegram-bot] ${method} failed:`, err)
    return { ok: false, description: String(err) }
  }
}

/**
 * إرسال رسالة نصية
 */
export async function sendMessage(options: SendMessageOptions): Promise<TelegramResponse> {
  const { chatId, text, parseMode = 'HTML', replyMarkup, disablePreview } = options

  if (text.length > 4096) {
    // Split long messages
    const chunks = splitMessage(text, 4096)
    const results: TelegramResponse[] = []
    for (const chunk of chunks) {
      const result = await apiCall('sendMessage', {
        chat_id: chatId,
        text: chunk,
        parse_mode: parseMode,
        disable_web_page_preview: disablePreview,
      })
      results.push(result)
    }
    return results[results.length - 1]
  }

  return apiCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: disablePreview,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

/**
 * إرسال صورة مع تعليق
 */
export async function sendPhoto(options: SendPhotoOptions): Promise<TelegramResponse> {
  const { chatId, photo, caption, parseMode = 'HTML' } = options

  return apiCall('sendPhoto', {
    chat_id: chatId,
    photo,
    caption: caption?.slice(0, 1024), // Telegram caption limit
    parse_mode: parseMode,
  })
}

/**
 * إرسال منشور إلى القناة
 */
export async function sendToChannel(text: string, photoUrl?: string): Promise<TelegramResponse> {
  const channelId = getChannelId()
  if (!channelId) {
    return { ok: false, description: 'Channel ID not configured' }
  }

  if (photoUrl) {
    return sendPhoto({
      chatId: channelId,
      photo: photoUrl,
      caption: text,
    })
  }

  return sendMessage({
    chatId: channelId,
    text,
    disablePreview: true,
  })
}

/**
 * التحقق من إعدادات البوت
 */
export async function verifyBot(): Promise<{
  configured: boolean
  botInfo?: { username: string; first_name: string }
  error?: string
}> {
  const token = getBotToken()
  if (!token) {
    return { configured: false, error: 'TELEGRAM_BOT_TOKEN not set' }
  }

  const result = await apiCall('getMe', {})
  if (result.ok) {
    return {
      configured: true,
      botInfo: result.result,
    }
  }

  return { configured: false, error: result.description }
}

/**
 * التحقق من صلاحية البوت في القناة
 */
export async function verifyChannel(): Promise<{
  configured: boolean
  channelInfo?: { title: string; id: number }
  error?: string
}> {
  const channelId = getChannelId()
  if (!channelId) {
    return { configured: false, error: 'TELEGRAM_CHANNEL_ID not set' }
  }

  const result = await apiCall('getChat', { chat_id: channelId })
  if (result.ok) {
    return {
      configured: true,
      channelInfo: result.result,
    }
  }

  return { configured: false, error: result.description }
}

/**
 * تقسيم الرسائل الطويلة
 */
function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    // Find last newline before limit
    let splitIdx = remaining.lastIndexOf('\n', maxLength)
    if (splitIdx === 0 || splitIdx === -1) {
      splitIdx = maxLength
    }

    chunks.push(remaining.slice(0, splitIdx))
    remaining = remaining.slice(splitIdx).trimStart()
  }

  return chunks
}
