/**
 * lib/telegram-bot.ts — Telegram Bot API integration
 *
 * Refactored to delegate to TelegramClient (src/lib/telegram/client.ts).
 * Public exports kept backward compatible.
 *
 * @deprecated Prefer TelegramClient from @/lib/telegram/client for new code.
 */

import { TelegramClient } from '@/lib/telegram/client'

const TELEGRAM_API = 'https://api.telegram.org/bot'

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

export function buildTelegramUrl(token: string, method: string): string {
  return `${TELEGRAM_API}${token}/${method}`
}

export function redactTelegramUrl(url: string): string {
  return url.replace(/\/bot[^/]+\//, '/bot[REDACTED]/')
}

export async function sendMessage(options: SendMessageOptions): Promise<any> {
  const client = new TelegramClient()
  try {
    return await client.sendMessage({
      chatId: options.chatId,
      text: options.text,
      parseMode: options.parseMode,
      replyMarkup: options.replyMarkup,
      disablePreview: options.disablePreview,
    })
  } catch (err) {
    return { ok: false, description: redactTelegramUrl(String(err)) }
  }
}

export async function sendPhoto(options: SendPhotoOptions): Promise<any> {
  const client = new TelegramClient()
  try {
    return await client.sendPhoto({
      chatId: options.chatId,
      photo: options.photo,
      caption: options.caption,
      parseMode: options.parseMode,
    })
  } catch (err) {
    return { ok: false, description: redactTelegramUrl(String(err)) }
  }
}

export async function sendToChannel(text: string, photoUrl?: string): Promise<any> {
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

export async function verifyBot(): Promise<{
  configured: boolean
  botInfo?: { username: string; first_name: string }
  error?: string
}> {
  const token = getBotToken()
  if (!token) {
    return { configured: false, error: 'TELEGRAM_BOT_TOKEN not set' }
  }

  const client = new TelegramClient(token)
  try {
    const result = await client.getMe()
    if (result.ok) {
      return { configured: true, botInfo: result.result }
    }
    return { configured: false, error: result.description }
  } catch (err) {
    return { configured: false, error: redactTelegramUrl(String(err)) }
  }
}

export async function verifyChannel(): Promise<{
  configured: boolean
  channelInfo?: { title: string; id: number }
  error?: string
}> {
  const channelId = getChannelId()
  if (!channelId) {
    return { configured: false, error: 'TELEGRAM_CHANNEL_ID not set' }
  }

  const client = new TelegramClient()
  try {
    const result = await client.getChat(channelId)
    if (result.ok) {
      return { configured: true, channelInfo: result.result }
    }
    return { configured: false, error: result.description }
  } catch (err) {
    return { configured: false, error: redactTelegramUrl(String(err)) }
  }
}
