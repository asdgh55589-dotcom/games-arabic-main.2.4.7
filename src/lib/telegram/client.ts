/**
 * lib/telegram/client.ts — Unified Telegram Bot API client.
 */

import { TelegramRateLimitError } from '@/lib/social/telegram-send'

export { TelegramRateLimitError }

const TELEGRAM_API = 'https://api.telegram.org/bot'

export interface TelegramClientOptions {
  botToken?: string | null
  transport?: { baseUrl?: string }
}

export interface TelegramResponse {
  ok: boolean
  result?: any
  description?: string
  error_code?: number
  [key: string]: any
}

export interface SendMessageParams {
  chatId?: string
  chat_id?: string
  text?: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' | null
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2' | null
  replyMarkup?: object
  reply_markup?: object
  disablePreview?: boolean
  disable_web_page_preview?: boolean
  messageThreadId?: number | null
  message_thread_id?: number | null
}

export interface SendPhotoParams {
  chatId?: string
  chat_id?: string
  photo?: string
  caption?: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' | null
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2' | null
  messageThreadId?: number | null
  message_thread_id?: number | null
}

export interface EditMessageParams {
  chatId?: string
  chat_id?: string
  messageId?: number
  message_id?: number
  text?: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' | null
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2' | null
}

export interface DeleteMessageParams {
  chatId?: string
  chat_id?: string
  messageId?: number
  message_id?: number
}

function resolveToken(input?: string | null | TelegramClientOptions): string | null {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const opts = input as TelegramClientOptions
    if (opts.botToken !== undefined) {
      return opts.botToken && opts.botToken.length > 0
        ? opts.botToken
        : process.env.TELEGRAM_BOT_TOKEN || null
    }
  }
  if (typeof input === 'string') {
    return input.length > 0 ? input : process.env.TELEGRAM_BOT_TOKEN || null
  }
  if (input == null) {
    return process.env.TELEGRAM_BOT_TOKEN || null
  }
  return process.env.TELEGRAM_BOT_TOKEN || null
}

function redactToken(value: string, token: string | null): string {
  if (!token) return value
  return value.split(token).join('[REDACTED]')
}

export class TelegramClient {
  private botToken: string | null
  private transportBaseUrl: string

  constructor(botTokenOrOptions?: string | null | TelegramClientOptions) {
    this.botToken = resolveToken(botTokenOrOptions as any)
    this.transportBaseUrl = TELEGRAM_API.replace(/\/bot$/, '') // https://api.telegram.org
  }

  get token(): string | null {
    return this.botToken
  }

  getToken(): string | null {
    return this.botToken
  }

  setToken(token: string | null): void {
    this.botToken = token && token.length > 0 ? token : null
  }

  private buildUrl(method: string): string {
    if (!this.botToken) return `${TELEGRAM_API}[REDACTED]/${method}`
    return `${TELEGRAM_API}${this.botToken}/${method}`
  }

  private async rawRequest(method: string, body: object): Promise<TelegramResponse> {
    if (!this.botToken) {
      return { ok: false, description: 'Bot token not configured' }
    }
    const url = this.buildUrl(method)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) {
      const safe = redactToken(String(err), this.botToken)
      return { ok: false, description: safe }
    }

    if (res.status === 429) {
      let retryAfter = 30
      try {
        const data = (await res.json()) as { parameters?: { retry_after?: number } }
        if (typeof data?.parameters?.retry_after === 'number') {
          retryAfter = data.parameters.retry_after
        }
      } catch {
        // ignore
      }
      throw new TelegramRateLimitError(Math.min(retryAfter, 3600))
    }

    let json: TelegramResponse
    try {
      json = (await res.json()) as TelegramResponse
    } catch (err) {
      const safe = redactToken(String(err), this.botToken)
      return { ok: false, description: safe }
    }
    return json
  }

  // Generic request helper (extra)
  async request(method: string, body: object = {}): Promise<TelegramResponse> {
    return this.rawRequest(method, body)
  }

  async getMe(): Promise<TelegramResponse> {
    return this.rawRequest('getMe', {})
  }

  async getChat(chatId: string): Promise<TelegramResponse> {
    return this.rawRequest('getChat', { chat_id: chatId })
  }

  async sendMessage(...args: any[]): Promise<TelegramResponse> {
    let params: SendMessageParams = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0] as SendMessageParams
    } else {
      params = { chatId: args[0], text: args[1], ...(args[2] ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, description: 'chatId is required' }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: params.text,
    }
    const parseMode = params.parseMode ?? params.parse_mode
    if (parseMode) body.parse_mode = parseMode
    const replyMarkup = params.replyMarkup ?? params.reply_markup
    if (replyMarkup) body.reply_markup = replyMarkup
    const disablePreview = params.disablePreview ?? params.disable_web_page_preview
    if (disablePreview !== undefined) body.disable_web_page_preview = disablePreview
    const threadId = params.messageThreadId ?? params.message_thread_id
    if (threadId != null) body.message_thread_id = threadId

    // Split long messages (keep parity with telegram-bot)
    if (typeof params.text === 'string' && params.text.length > 4096) {
      const chunks = splitMessage(params.text, 4096)
      let last: TelegramResponse = { ok: true }
      for (const chunk of chunks) {
        last = await this.rawRequest('sendMessage', { ...body, text: chunk })
        if (!last.ok) return last
      }
      return last
    }

    return this.rawRequest('sendMessage', body)
  }

  async sendPhoto(...args: any[]): Promise<TelegramResponse> {
    let params: SendPhotoParams = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0] as SendPhotoParams
    } else {
      if (args[2] && typeof args[2] === 'object') {
        params = { chatId: args[0], photo: args[1], ...(args[2] ?? {}) }
      } else {
        params = { chatId: args[0], photo: args[1], caption: args[2], ...(args[3] ?? {}) }
      }
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, description: 'chatId is required' }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      photo: params.photo,
    }
    if (params.caption !== undefined) body.caption = String(params.caption).slice(0, 1024)
    const parseMode = params.parseMode ?? params.parse_mode
    if (parseMode) body.parse_mode = parseMode
    const threadId = params.messageThreadId ?? params.message_thread_id
    if (threadId != null) body.message_thread_id = threadId

    return this.rawRequest('sendPhoto', body)
  }

  private normalizeResponse(raw: TelegramResponse): any {
    const result = raw.result
    let messageId: number | undefined
    if (Array.isArray(result)) {
      messageId = result[0]?.message_id
    } else if (result && typeof result === 'object') {
      messageId = (result as any).message_id
    }
    return {
      ok: raw.ok,
      messageId,
      error: raw.description,
      description: raw.description,
      result: raw.result,
    }
  }

  private mergeOptions(body: Record<string, unknown>, options: any): void {
    if (!options || typeof options !== 'object') return
    const mapping: Record<string, string> = {
      parseMode: 'parse_mode',
      parse_mode: 'parse_mode',
      replyMarkup: 'reply_markup',
      reply_markup: 'reply_markup',
      disablePreview: 'disable_web_page_preview',
      disable_web_page_preview: 'disable_web_page_preview',
      messageThreadId: 'message_thread_id',
      message_thread_id: 'message_thread_id',
      thumbnail: 'thumbnail',
      thumb: 'thumbnail',
      caption: 'caption',
    }
    for (const [k, v] of Object.entries(options)) {
      if (v === undefined) continue
      if (k === 'chatId' || k === 'chat_id' || k === 'items' || k === 'media' || k === 'type')
        continue
      const target = mapping[k] ?? k
      body[target] = v
    }
  }

  async sendMediaGroup(...args: any[]): Promise<any> {
    let params: any = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0]
    } else if (Array.isArray(args[1])) {
      params = { chatId: args[0], items: args[1], ...(args[2] ?? {}) }
    } else {
      params = { chatId: args[0], items: args[1], ...(args[2] ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    const items = params.items ?? params.media ?? []
    if (!chatId) return { ok: false, error: 'chatId is required' }
    if (!Array.isArray(items)) return { ok: false, error: 'items must be an array' }
    if (items.length < 2 || items.length > 10) {
      return { ok: false, error: 'Media group must contain 2-10 items' }
    }
    const types = new Set(items.map((i: any) => i?.type))
    if (types.size !== 1) {
      return { ok: false, error: 'All media items must be the same type' }
    }
    const type = items[0]?.type
    if (type !== 'photo' && type !== 'video') {
      return { ok: false, error: 'Unsupported media type' }
    }
    for (const item of items) {
      if (item?.size != null || item?.fileSize != null || item?.file_size != null) {
        const size = item.size ?? item.fileSize ?? item.file_size
        if (!validateFileSize(type, size)) {
          return { ok: false, error: 'File too large' }
        }
      }
    }

    const media = items.map((i: any) => {
      const entry: Record<string, unknown> = { type: i.type, media: i.media }
      if (i.caption !== undefined) entry.caption = String(i.caption).slice(0, 1024)
      return entry
    })

    const body: Record<string, unknown> = { chat_id: chatId, media }
    // top-level options may include caption? no
    this.mergeOptions(body, params)
    // remove items/media from body if merged
    delete body.items
    const raw = await this.rawRequest('sendMediaGroup', body)
    return this.normalizeResponse(raw)
  }

  async sendDocument(...args: any[]): Promise<any> {
    let params: any = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0]
    } else if (args[2] && typeof args[2] === 'object') {
      params = { chatId: args[0], document: args[1], ...(args[2] ?? {}) }
    } else {
      params = { chatId: args[0], document: args[1], caption: args[2], ...(args[3] ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, error: 'chatId is required' }

    const body: Record<string, unknown> = { chat_id: chatId, document: params.document }
    if (params.caption !== undefined) body.caption = String(params.caption).slice(0, 1024)
    this.mergeOptions(body, params)
    const raw = await this.rawRequest('sendDocument', body)
    return this.normalizeResponse(raw)
  }

  async sendVideo(...args: any[]): Promise<any> {
    let params: any = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0]
    } else {
      const chatId = args[0]
      const video = args[1]
      let caption: any
      let thumbnail: any
      let options: any
      if (typeof args[2] === 'string' || args[2] == null) {
        caption = args[2]
        if (typeof args[3] === 'string' || args[3] == null) {
          thumbnail = args[3]
          options = args[4]
        } else {
          options = args[3]
        }
      } else if (args[2] && typeof args[2] === 'object') {
        options = args[2]
      }
      params = { chatId, video, caption, thumbnail, ...(options ?? {}) }
      if (params.caption === undefined && options?.caption !== undefined)
        params.caption = options.caption
      if (params.thumbnail === undefined && options?.thumbnail !== undefined)
        params.thumbnail = options.thumbnail
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, error: 'chatId is required' }

    // file size validation if provided
    const size = params.size ?? params.fileSize ?? params.file_size
    if (size != null && !validateFileSize('video', size)) {
      return { ok: false, error: 'File too large' }
    }

    const body: Record<string, unknown> = { chat_id: chatId, video: params.video }
    if (params.caption !== undefined) body.caption = String(params.caption).slice(0, 1024)
    if (params.thumbnail !== undefined) body.thumbnail = params.thumbnail
    this.mergeOptions(body, params)
    const raw = await this.rawRequest('sendVideo', body)
    return this.normalizeResponse(raw)
  }

  async sendAudio(...args: any[]): Promise<any> {
    let params: any = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0]
    } else if (args[2] && typeof args[2] === 'object') {
      params = { chatId: args[0], audio: args[1], ...(args[2] ?? {}) }
    } else {
      params = { chatId: args[0], audio: args[1], caption: args[2], ...(args[3] ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, error: 'chatId is required' }

    const body: Record<string, unknown> = { chat_id: chatId, audio: params.audio }
    if (params.caption !== undefined) body.caption = String(params.caption).slice(0, 1024)
    this.mergeOptions(body, params)
    const raw = await this.rawRequest('sendAudio', body)
    return this.normalizeResponse(raw)
  }

  async sendSticker(...args: any[]): Promise<any> {
    let params: any = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0]
    } else if (args[2] && typeof args[2] === 'object') {
      params = { chatId: args[0], sticker: args[1], ...(args[2] ?? {}) }
    } else {
      params = { chatId: args[0], sticker: args[1], ...(args[2] ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, error: 'chatId is required' }

    const body: Record<string, unknown> = { chat_id: chatId, sticker: params.sticker }
    this.mergeOptions(body, params)
    const raw = await this.rawRequest('sendSticker', body)
    return this.normalizeResponse(raw)
  }

  async sendPoll(...args: any[]): Promise<any> {
    let params: any = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0]
    } else {
      const chatId = args[0]
      const question = args[1]
      let optionsArray: any
      let optionsObj: any
      if (Array.isArray(args[2])) {
        optionsArray = args[2]
        optionsObj = args[3]
      } else if (args[2] && typeof args[2] === 'object') {
        optionsArray = args[2].options ?? args[2].pollOptions
        optionsObj = args[2]
      }
      params = { chatId, question, options: optionsArray, ...(optionsObj ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, error: 'chatId is required' }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      question: params.question,
      options: params.options,
    }
    this.mergeOptions(body, params)
    delete body.options // keep options? mergeOptions won't remove; re-set
    body.options = params.options
    const raw = await this.rawRequest('sendPoll', body)
    return this.normalizeResponse(raw)
  }

  async sendLocation(...args: any[]): Promise<any> {
    let params: any = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0]
    } else {
      params = { chatId: args[0], latitude: args[1], longitude: args[2], ...(args[3] ?? {}) }
      // support sendLocation(chatId, latitude, longitude, options) signature in task: (chatId, latitude, longitude, options)
      if (args.length === 4 && typeof args[3] === 'object')
        params = { chatId: args[0], latitude: args[1], longitude: args[2], ...(args[3] ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, error: 'chatId is required' }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      latitude: params.latitude,
      longitude: params.longitude,
    }
    this.mergeOptions(body, params)
    const raw = await this.rawRequest('sendLocation', body)
    return this.normalizeResponse(raw)
  }

  async sendContact(...args: any[]): Promise<any> {
    let params: any = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0]
    } else {
      params = { chatId: args[0], phoneNumber: args[1], firstName: args[2], ...(args[3] ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    if (!chatId) return { ok: false, error: 'chatId is required' }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      phone_number: params.phoneNumber ?? params.phone_number,
      first_name: params.firstName ?? params.first_name,
    }
    this.mergeOptions(body, params)
    const raw = await this.rawRequest('sendContact', body)
    return this.normalizeResponse(raw)
  }

  async editMessage(...args: any[]): Promise<TelegramResponse> {
    let params: EditMessageParams = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0] as EditMessageParams
    } else {
      params = { chatId: args[0], messageId: args[1], text: args[2], ...(args[3] ?? {}) }
    }

    const chatId = params.chatId ?? params.chat_id
    const messageId = params.messageId ?? params.message_id
    if (!chatId) return { ok: false, description: 'chatId is required' }
    if (messageId === undefined || messageId === null)
      return { ok: false, description: 'messageId is required' }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text: params.text,
    }
    const parseMode = params.parseMode ?? params.parse_mode
    if (parseMode) body.parse_mode = parseMode

    return this.rawRequest('editMessageText', body)
  }

  async deleteMessage(...args: any[]): Promise<TelegramResponse> {
    let params: DeleteMessageParams = {}
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      params = args[0] as DeleteMessageParams
    } else {
      if (args[1] && typeof args[1] === 'object') {
        params = { chatId: args[0], ...(args[1] ?? {}) }
      } else {
        params = { chatId: args[0], messageId: args[1] }
      }
    }

    const chatId = params.chatId ?? params.chat_id
    const messageId = params.messageId ?? params.message_id
    if (!chatId) return { ok: false, description: 'chatId is required' }
    if (messageId === undefined || messageId === null)
      return { ok: false, description: 'messageId is required' }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
    }

    return this.rawRequest('deleteMessage', body)
  }

  static validateFileSize(...args: any[]): boolean {
    return validateFileSize(...args)
  }

  validateFileSize(...args: any[]): boolean {
    return validateFileSize(...args)
  }

  static checkFileSize(...args: any[]): { ok: boolean; error?: string } {
    return checkFileSize(...args)
  }

  checkFileSize(...args: any[]): { ok: boolean; error?: string } {
    return checkFileSize(...args)
  }

  static isFileSizeValid(...args: any[]): boolean {
    return validateFileSize(...args)
  }

  isFileSizeValid(...args: any[]): boolean {
    return validateFileSize(...args)
  }
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }
    let splitIdx = remaining.lastIndexOf('\n', maxLength)
    if (splitIdx === 0 || splitIdx === -1) splitIdx = maxLength
    chunks.push(remaining.slice(0, splitIdx))
    remaining = remaining.slice(splitIdx).trimStart()
  }
  return chunks
}

export function validateFileSize(...args: any[]): boolean {
  let type: any
  let size: any
  if (args.length === 1 && args[0] && typeof args[0] === 'object') {
    const obj = args[0]
    type = obj.type ?? obj.mediaType ?? obj.kind
    size = obj.size ?? obj.fileSize ?? obj.file_size ?? obj.bytes
  } else if (typeof args[0] === 'number') {
    size = args[0]
    type = args[1]
  } else {
    type = args[0]
    size = args[1]
  }
  if (size === null || size === undefined) return true
  const n = Number(size)
  if (!Number.isFinite(n)) return true
  const max = String(type).toLowerCase().includes('video')
    ? 2 * 1024 * 1024 * 1024
    : 50 * 1024 * 1024
  return n <= max
}

export function checkFileSize(...args: any[]): { ok: boolean; error?: string } {
  return validateFileSize(...args) ? { ok: true } : { ok: false, error: 'File too large' }
}

export const isFileSizeValid = validateFileSize
export const validateMediaSize = validateFileSize
export const checkMediaSize = checkFileSize
export const isMediaSizeValid = validateFileSize

export default TelegramClient
