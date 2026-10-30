/**
 * lib/telegram/message-builder.ts — helpers for building Telegram message text.
 */

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export type BuildTextInput =
  | string
  | {
      title?: string
      body?: string
      text?: string
      separator?: string
      prefix?: string
      suffix?: string
    }

export function buildText(input: BuildTextInput, body?: string): string {
  let title = ''
  let content = ''
  let separator = '\n\n'
  let prefix = ''
  let suffix = ''

  if (typeof input === 'string') {
    title = input
    content = body ?? ''
  } else if (input && typeof input === 'object') {
    title = input.title ?? ''
    content = input.body ?? input.text ?? ''
    separator = input.separator ?? '\n\n'
    prefix = input.prefix ?? ''
    suffix = input.suffix ?? ''
  }

  const parts: string[] = []
  if (title) parts.push(title)
  if (content) parts.push(content)
  let result = parts.join(separator)
  if (prefix) result = `${prefix}${result}`
  if (suffix) result = `${result}${suffix}`
  return result.trim()
}

export const buildMessage = buildText
export const buildMessageText = buildText
export const buildTelegramText = buildText
export const buildTelegramMessage = buildText

export default { escapeHtml, buildText }
