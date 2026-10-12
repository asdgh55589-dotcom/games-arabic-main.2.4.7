/**
 * lib/social/serialize.ts — تسلسل استجابات Social Hub.
 *
 * قاعدة صريحة: لا يُعاد أي توكن بوت (`tokenEnc`) في أي استجابة — لا كاملاً
 * ولا مقطّعاً. `maskBotToken` موجود للاستخدام الخادمي/السجلات فقط.
 */

export interface SocialPostDto {
  id: string
  platform: string
  status: string
  title: string | null
  body: string
  parseMode: string | null
  richDocument: unknown
  mediaUrl: string | null
  destinationId: string | null
  botId: string | null
  templateId: string | null
  scheduledFor: Date | null
  publishedAt: Date | null
  externalId: string | null
  attempts: number
  maxAttempts: number
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

export function serializePost(post: Record<string, unknown>): SocialPostDto {
  return {
    id: post.id as string,
    platform: post.platform as string,
    status: post.status as string,
    title: (post.title as string | null) ?? null,
    body: post.body as string,
    parseMode: (post.parseMode as string | null) ?? null,
    richDocument: post.richDocument ?? null,
    mediaUrl: (post.mediaUrl as string | null) ?? null,
    destinationId: (post.destinationId as string | null) ?? null,
    botId: (post.botId as string | null) ?? null,
    templateId: (post.templateId as string | null) ?? null,
    scheduledFor: (post.scheduledFor as Date | null) ?? null,
    publishedAt: (post.publishedAt as Date | null) ?? null,
    externalId: (post.externalId as string | null) ?? null,
    attempts: (post.attempts as number) ?? 0,
    maxAttempts: (post.maxAttempts as number) ?? 3,
    lastError: (post.lastError as string | null) ?? null,
    createdAt: post.createdAt as Date,
    updatedAt: post.updatedAt as Date,
  }
}

export interface SocialTemplateDto {
  id: string
  platform: string
  name: string
  title: string | null
  body: string
  parseMode: string | null
  richDocument: unknown
  mediaUrl: string | null
  variables: unknown
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export function serializeTemplate(template: Record<string, unknown>): SocialTemplateDto {
  return {
    id: template.id as string,
    platform: template.platform as string,
    name: template.name as string,
    title: (template.title as string | null) ?? null,
    body: template.body as string,
    parseMode: (template.parseMode as string | null) ?? null,
    richDocument: template.richDocument ?? null,
    mediaUrl: (template.mediaUrl as string | null) ?? null,
    variables: template.variables ?? [],
    isDefault: Boolean(template.isDefault),
    createdAt: template.createdAt as Date,
    updatedAt: template.updatedAt as Date,
  }
}

export interface SocialBotDto {
  id: string
  label: string
  botUsername: string | null
  status: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

/** لا يشمل `tokenEnc` إطلاقاً — هذا هو المطلوب في العقد. */
export function serializeBot(bot: Record<string, unknown>): SocialBotDto {
  return {
    id: bot.id as string,
    label: bot.label as string,
    botUsername: (bot.botUsername as string | null) ?? null,
    status: bot.status as string,
    notes: (bot.notes as string | null) ?? null,
    createdAt: bot.createdAt as Date,
    updatedAt: bot.updatedAt as Date,
  }
}

export function serializeDestination(
  destination: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: destination.id,
    chatId: destination.chatId,
    chatType: destination.chatType,
    username: destination.username ?? null,
    title: destination.title ?? null,
    status: destination.status,
    verificationStatus: destination.verificationStatus,
    isDefault: destination.isDefault,
    notes: destination.notes ?? null,
    // حقول Social Hub الإضافية فقط — لا يُعاد verificationToken أبداً
    botId: destination.botId ?? null,
    messageThreadId: destination.messageThreadId ?? null,
    createdAt: destination.createdAt,
    updatedAt: destination.updatedAt,
  }
}
