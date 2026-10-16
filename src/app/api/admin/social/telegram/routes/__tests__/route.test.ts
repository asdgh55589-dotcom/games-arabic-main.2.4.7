/**
 * اختبارات API قواعد التوجيه: إنشاء/تعديل/حذف + معاينة + إرسال تجريبي.
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialPublishRoute: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
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

jest.mock('@/lib/social/telegram-send', () => ({ sendTelegramPost: jest.fn() }))

jest.mock('@/lib/social/bot-token', () => ({ decryptBotToken: jest.fn(() => 'decrypted-tok') }))

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sendTelegramPost } from '@/lib/social/telegram-send'
import { DELETE as deleteRule, PATCH as patchRule } from '../[id]/route'
import { POST as testSend } from '../[id]/test/route'
import { GET as previewGET } from '../preview/route'
import { POST as createPOST, GET as listGET } from '../route'

const mockDb = db as unknown as {
  socialPublishRoute: {
    findMany: jest.Mock
    findFirst: jest.Mock
    findUnique: jest.Mock
    create: jest.Mock
    update: jest.Mock
    updateMany: jest.Mock
    delete: jest.Mock
  }
  telegramDestination: { findUnique: jest.Mock }
  socialTelegramBot: { findUnique: jest.Mock }
}
const mockSend = sendTelegramPost as jest.Mock

const makeReq = (url: string, method = 'GET', body?: unknown) => {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}
const routeParams = (id: string) => ({ params: Promise.resolve({ id }) })

const VERIFIED_DEST = {
  id: 'dest-1',
  chatId: '-1001',
  chatType: 'channel',
  archivedAt: null,
  verificationStatus: 'verified',
  lastHealthAt: new Date(),
  lastHealthError: null,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('routes — الإنشاء', () => {
  it('يرفض منصة مجهولة (422)', async () => {
    const res = await createPOST(
      makeReq('http://localhost/x', 'POST', {
        platformKey: 'ATARI',
        targetType: 'channel',
        destinationId: 'dest-1',
      }),
    )
    expect(res.status).toBe(422)
    expect(mockDb.socialPublishRoute.create).not.toHaveBeenCalled()
  })

  it('يرفض وجهة غير موثقة (422)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...VERIFIED_DEST,
      verificationStatus: 'unverified',
    })

    const res = await createPOST(
      makeReq('http://localhost/x', 'POST', {
        platformKey: 'PS5',
        targetType: 'channel',
        destinationId: 'dest-1',
      }),
    )
    expect(res.status).toBe(422)
    expect(mockDb.socialPublishRoute.create).not.toHaveBeenCalled()
  })

  it('يرفض topic بلا thread (422)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...VERIFIED_DEST,
      chatType: 'supergroup',
    })

    const res = await createPOST(
      makeReq('http://localhost/x', 'POST', {
        platformKey: 'PS5',
        targetType: 'topic',
        destinationId: 'dest-1',
      }),
    )
    expect(res.status).toBe(422)
  })

  it('يرفض التكرار (post,destination,thread) بـ 409', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(VERIFIED_DEST)
    mockDb.socialPublishRoute.findFirst.mockResolvedValueOnce({ id: 'existing' })

    const res = await createPOST(
      makeReq('http://localhost/x', 'POST', {
        platformKey: 'PS5',
        targetType: 'channel',
        destinationId: 'dest-1',
      }),
    )
    expect(res.status).toBe(409)
    expect(mockDb.socialPublishRoute.create).not.toHaveBeenCalled()
  })

  it('الافتراضية الجديدة تُسقط الافتراضية السابقة للمنصة نفسها', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(VERIFIED_DEST)
    mockDb.socialPublishRoute.findFirst.mockResolvedValueOnce(null)
    mockDb.socialPublishRoute.create.mockResolvedValueOnce({ id: 'r-new' })

    const res = await createPOST(
      makeReq('http://localhost/x', 'POST', {
        platformKey: 'PS5',
        targetType: 'channel',
        destinationId: 'dest-1',
        isDefault: true,
      }),
    )
    expect(res.status).toBe(200)
    expect(mockDb.socialPublishRoute.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ platformKey: 'PS5', isDefault: true }),
        data: { isDefault: false },
      }),
    )
  })
})

describe('routes — المعاينة والإرسال التجريبي', () => {
  it('المعاينة ترفض منصة مجهولة (422)', async () => {
    const res = await previewGET(makeReq('http://localhost/x?platformKey=ATARI'))
    expect(res.status).toBe(422)
  })

  it('الإرسال التجريبي يرسل عبر بوت القاعدة بلا صفوف تسليم', async () => {
    mockDb.socialPublishRoute.findUnique.mockResolvedValueOnce({
      id: 'r1',
      botId: 'bot-1',
      threadId: 2,
      destination: { chatId: '-1001', status: 'active', botId: null, messageThreadId: null },
    })
    mockDb.socialTelegramBot.findUnique.mockResolvedValueOnce({
      id: 'bot-1',
      status: 'active',
      tokenEnc: 'enc',
    })
    process.env.TELEGRAM_BOT_TOKEN = 'env-tok'
    mockSend.mockResolvedValueOnce({ ok: true, method: 'sendMessage', messageId: 42 })

    const res = await testSend(makeReq('http://localhost/x', 'POST', {}), routeParams('r1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.messageId).toBe(42)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ chatId: '-1001', messageThreadId: 2 }),
      }),
    )
    delete process.env.TELEGRAM_BOT_TOKEN
  })

  it('الإرسال التجريبي يرفض وجهة معطلة (422) بلا إرسال', async () => {
    mockDb.socialPublishRoute.findUnique.mockResolvedValueOnce({
      id: 'r1',
      botId: null,
      threadId: null,
      destination: { chatId: '-1001', status: 'disabled', botId: null, messageThreadId: null },
    })

    const res = await testSend(makeReq('http://localhost/x', 'POST', {}), routeParams('r1'))
    expect(res.status).toBe(422)
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('routes — التعديل والحذف', () => {
  it('الحذف يحذف ويدقق (200)', async () => {
    mockDb.socialPublishRoute.findUnique.mockResolvedValueOnce({
      id: 'r1',
      platformKey: 'PS5',
      destinationId: 'dest-1',
    })
    mockDb.socialPublishRoute.delete.mockResolvedValueOnce({ id: 'r1' })

    const res = await deleteRule(makeReq('http://localhost/x', 'DELETE'), routeParams('r1'))
    expect(res.status).toBe(200)
    expect(mockDb.socialPublishRoute.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
  })

  it('القائمة تُفلتر بالمنصة', async () => {
    mockDb.socialPublishRoute.findMany.mockResolvedValueOnce([])

    await listGET(makeReq('http://localhost/x?platformKey=NS'))
    expect(mockDb.socialPublishRoute.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { platformKey: 'NS' } }),
    )
  })

  it('التعديل يعيد فحص الوجهة عند تغييرها', async () => {
    mockDb.socialPublishRoute.findUnique.mockResolvedValueOnce({
      id: 'r1',
      platformKey: 'PS5',
      targetType: 'channel',
      destinationId: 'old',
      botId: null,
      threadId: null,
      validFrom: null,
      validUntil: null,
    })
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...VERIFIED_DEST,
      chatType: 'group',
    })

    const res = await patchRule(
      makeReq('http://localhost/x', 'PATCH', { destinationId: 'dest-1' }),
      routeParams('r1'),
    )
    // channel→group عدم توافق
    expect(res.status).toBe(422)
    expect(mockDb.socialPublishRoute.update).not.toHaveBeenCalled()
  })
})
