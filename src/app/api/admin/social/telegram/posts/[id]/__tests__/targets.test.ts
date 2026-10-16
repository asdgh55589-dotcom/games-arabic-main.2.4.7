/**
 * اختبارات أهداف المنشور: إضافة/حذف + إعادة المحاولة + تعديل/حذف الرسائل.
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialPost: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    socialPostTarget: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    socialPostDelivery: { create: jest.fn(), count: jest.fn() },
    telegramDestination: { findUnique: jest.fn() },
    socialTelegramBot: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'a1', role: 'admin' }),
  requireManager: jest.fn().mockResolvedValue({ id: 'm1', username: 'boss', role: 'manager' }),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/social/telegram-send', () => ({
  sendTelegramPost: jest.fn(),
  editTelegramMessage: jest.fn(),
  deleteTelegramMessage: jest.fn(),
}))

jest.mock('@/lib/social/rich-post', () => ({
  isRichPostSpec: jest.fn(() => false),
  toRichMessageInput: jest.fn(),
}))

jest.mock('@/lib/social/validate-post', () => ({
  validateSocialPost: jest.fn(() => ({
    ok: true,
    issues: [],
    preview: { text: 'hello', parseMode: null, photo: null },
  })),
}))

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  deleteSentMessages,
  editSentMessages,
  publishSocialPostMulti,
} from '@/lib/social/publish-multi'
import {
  deleteTelegramMessage,
  editTelegramMessage,
  sendTelegramPost,
} from '@/lib/social/telegram-send'
import { POST as deleteMessagePOST } from '../delete-message/route'
import { POST as editMessagePOST } from '../edit-message/route'
import { POST as retryPOST } from '../retry-targets/route'
import { DELETE as targetDELETE } from '../targets/[targetId]/route'
import { GET as targetsGET, POST as targetsPOST } from '../targets/route'

const mockDb = db as unknown as {
  socialPost: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock }
  socialPostTarget: {
    findMany: jest.Mock
    findFirst: jest.Mock
    create: jest.Mock
    update: jest.Mock
    updateMany: jest.Mock
    delete: jest.Mock
  }
  socialPostDelivery: { create: jest.Mock; count: jest.Mock }
  telegramDestination: { findUnique: jest.Mock }
  socialTelegramBot: { findUnique: jest.Mock }
}
const mockSend = sendTelegramPost as jest.Mock
const mockEdit = editTelegramMessage as jest.Mock
const mockDeleteMsg = deleteTelegramMessage as jest.Mock

const makeReq = (url: string, method = 'GET', body?: unknown) => {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}
const postParams = (id: string) => ({ params: Promise.resolve({ id }) })
const targetParams = (id: string, targetId: string) => ({
  params: Promise.resolve({ id, targetId }),
})

const VERIFIED_SG = {
  id: 'dest-1',
  chatId: '-1001',
  chatType: 'supergroup',
  archivedAt: null,
  verificationStatus: 'verified',
  lastHealthAt: new Date(),
  lastHealthError: null,
}

const POST_ROW = {
  id: 'post-1',
  platform: 'telegram',
  status: 'scheduled',
  title: null,
  body: 'hello',
  parseMode: null,
  richDocument: null,
  mediaUrl: null,
  destinationId: null,
  botId: null,
  externalId: null,
  attempts: 0,
  maxAttempts: 3,
  scheduledFor: new Date(),
}

const TARGET_ROW = {
  id: 't1',
  postId: 'post-1',
  destinationId: 'dest-1',
  botId: null,
  threadId: null,
  status: 'pending',
  attempts: 0,
  externalMessageId: null,
  createdAt: new Date(),
  destination: {
    chatId: '-1001',
    status: 'active',
    verificationStatus: 'verified',
    archivedAt: null,
    botId: null,
    messageThreadId: null,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.TELEGRAM_CHANNEL_ID = '@test-channel'
  process.env.TELEGRAM_BOT_TOKEN = 'env-tok'
  mockDb.socialPostDelivery.create.mockResolvedValue({})
  mockDb.socialPostDelivery.count.mockResolvedValue(1)
  // المسار الأحادي (التفويض بلا أهداف) يطالب عبر socialPost.updateMany.
  mockDb.socialPost.updateMany.mockResolvedValue({ count: 1 })
  mockSend.mockResolvedValue({ ok: true, method: 'sendMessage', messageId: 42 })
  mockEdit.mockResolvedValue({ ok: true })
  mockDeleteMsg.mockResolvedValue({ ok: true })
})

afterEach(() => {
  delete process.env.TELEGRAM_CHANNEL_ID
  delete process.env.TELEGRAM_BOT_TOKEN
})

describe('targets — الإضافة والحذف', () => {
  it('يرفض وجهة مؤرشفة (422)', async () => {
    mockDb.socialPost.findUnique.mockResolvedValueOnce({ id: 'post-1' })
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...VERIFIED_SG,
      archivedAt: new Date(),
    })

    const res = await targetsPOST(
      makeReq('http://localhost/x', 'POST', { destinationId: 'dest-1' }),
      postParams('post-1'),
    )
    expect(res.status).toBe(422)
    expect(mockDb.socialPostTarget.create).not.toHaveBeenCalled()
  })

  it('يرفض التكرار الصريح (409) بلا اعتماد على القيد فقط', async () => {
    mockDb.socialPost.findUnique.mockResolvedValueOnce({ id: 'post-1' })
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(VERIFIED_SG)
    mockDb.socialPostTarget.findFirst.mockResolvedValueOnce({ id: 't-old' })

    const res = await targetsPOST(
      makeReq('http://localhost/x', 'POST', { destinationId: 'dest-1' }),
      postParams('post-1'),
    )
    expect(res.status).toBe(409)
    expect(mockDb.socialPostTarget.create).not.toHaveBeenCalled()
  })

  it('ينشئ هدفاً ويحذفه (سجل التسليم لا يُمس)', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ id: 'post-1' })
    mockDb.telegramDestination.findUnique.mockResolvedValue(VERIFIED_SG)
    mockDb.socialPostTarget.findFirst.mockResolvedValue(null)
    mockDb.socialPostTarget.create.mockResolvedValue({ id: 't-new' })

    const created = await targetsPOST(
      makeReq('http://localhost/x', 'POST', { destinationId: 'dest-1', threadId: 2 }),
      postParams('post-1'),
    )
    expect(created.status).toBe(200)

    mockDb.socialPostTarget.findFirst.mockResolvedValueOnce({
      id: 't-new',
      destinationId: 'dest-1',
    })
    mockDb.socialPostTarget.delete.mockResolvedValueOnce({ id: 't-new' })
    const removed = await targetDELETE(
      makeReq('http://localhost/x', 'DELETE'),
      targetParams('post-1', 't-new'),
    )
    expect(removed.status).toBe(200)
    expect(mockDb.socialPostDelivery.create).not.toHaveBeenCalled()
  })
})

describe('publishSocialPostMulti — التجميع', () => {
  it('هدفان ناجحان → المنشور published', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ ...POST_ROW })
    mockDb.socialPostTarget.findMany.mockResolvedValue([
      { ...TARGET_ROW, id: 't1' },
      { ...TARGET_ROW, id: 't2', destinationId: 'dest-1' },
    ])
    mockDb.socialPostTarget.updateMany.mockResolvedValue({ count: 1 })
    mockDb.socialPostTarget.update.mockImplementation(
      async (arg: { data: Record<string, unknown> }) => ({
        attempts: 1,
      }),
    )
    mockDb.socialPost.update.mockResolvedValue({})

    const result = await publishSocialPostMulti('post-1', { source: 'cron' })

    expect(result.ok).toBe(true)
    expect(result.published).toBe(2)
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'published' }),
      }),
    )
    expect(mockDb.socialPostDelivery.create).toHaveBeenCalledTimes(2)
  })

  it('فشل جزئي → المنشور يبقى scheduled مع خطأ مُجمّع', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ ...POST_ROW })
    mockDb.socialPostTarget.findMany.mockResolvedValue([
      { ...TARGET_ROW, id: 't1' },
      { ...TARGET_ROW, id: 't2' },
    ])
    mockDb.socialPostTarget.updateMany.mockResolvedValue({ count: 1 })
    mockDb.socialPostTarget.update.mockImplementation(async () => ({ attempts: 1 }))
    mockSend
      .mockResolvedValueOnce({ ok: true, method: 'sendMessage', messageId: 1 })
      .mockResolvedValueOnce({ ok: false, method: 'sendMessage', error: 'timeout' })
    mockDb.socialPost.update.mockResolvedValue({})

    const result = await publishSocialPostMulti('post-1', { source: 'cron' })

    expect(result.ok).toBe(true)
    expect(result.published).toBe(1)
    expect(result.skipped).toBe(1)
    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastError: expect.stringContaining('timeout') }),
      }),
    )
    // بلا published — الحالة بقيت scheduled (لم تُمرَّر status في التحديث)
    const updateArg = mockDb.socialPost.update.mock.calls[0][0]
    expect(updateArg.data.status).toBeUndefined()
  })

  it('بلا أهداف → تفويض للمسار الأحادي', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ ...POST_ROW })
    mockDb.socialPostTarget.findMany.mockResolvedValue([])

    // المسار الأحادي يحتاج findUnique ثانية + update نهائياً
    mockDb.socialPost.findUnique.mockResolvedValueOnce({
      ...POST_ROW,
      destinationId: null,
      botId: null,
    })
    mockDb.socialPost.update.mockResolvedValue({})

    const result = await publishSocialPostMulti('post-1', { source: 'cron' })

    expect(result.published).toBe(1)
    expect(result.targets).toEqual([])
  })
})

describe('retry/edit/delete-message — المسارات', () => {
  it('إعادة المحاولة تشغّل المحرك وتُرجع العدّادات', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ ...POST_ROW })
    mockDb.socialPost.findUnique.mockResolvedValueOnce({ id: 'post-1' }) // فحص المسار أولاً
    mockDb.socialPostTarget.findMany.mockResolvedValue([])
    mockDb.socialPost.update.mockResolvedValue({})

    const res = await retryPOST(makeReq('http://localhost/x', 'POST'), postParams('post-1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.published).toBe(1)
  })

  it('تعديل رسالة مرسلة → edited مع توثيق مراجعة', async () => {
    mockDb.socialPost.findUnique.mockResolvedValueOnce({
      id: 'post-1',
      body: 'نص جديد',
      parseMode: 'HTML',
    })
    mockDb.socialPostTarget.findMany.mockResolvedValueOnce([
      {
        ...TARGET_ROW,
        status: 'sent',
        externalMessageId: '99',
        destination: { chatId: '-1001', botId: null },
      },
    ])

    const res = await editMessagePOST(
      makeReq('http://localhost/x', 'POST', { text: 'نص جديد' }),
      postParams('post-1'),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.edited).toBe(1)
    expect(mockEdit).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: '-1001', messageId: 99, text: 'نص جديد' }),
    )
  })

  it('حذف رسالة مرسلة → الهدف skipped مع بقاء التسليم', async () => {
    mockDb.socialPostTarget.findMany.mockResolvedValueOnce([
      {
        ...TARGET_ROW,
        status: 'sent',
        externalMessageId: '99',
        destination: { chatId: '-1001', botId: null },
      },
    ])
    mockDb.socialPostTarget.update.mockResolvedValueOnce({})

    const res = await deleteMessagePOST(
      makeReq('http://localhost/x', 'POST', {}),
      postParams('post-1'),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.deleted).toBe(1)
    expect(mockDeleteMsg).toHaveBeenCalled()
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }),
    )
  })
})
