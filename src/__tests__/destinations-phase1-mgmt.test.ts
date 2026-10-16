/**
 * المرحلة 1 — إدارة الوجهات: تحقق المواضيع/البوت، فحص الصحة، قائمة البوتات.
 *
 * العقود المثبتة:
 *  1) thread مرفوض على القنوات/غير-المعروف، مقبول للـ supergroup.
 *  2) botId غير موجود → 422؛ null تُخلي الإسناد.
 *  3) فحص الصحة: بلا توكن → 422؛ فشل الشبكة → healthy:false مع حفظ الخطأ؛
 *     التوكن لا يظهر في أي استجابة أو سجل أبداً.
 *  4) قائمة البوتات بلا tokenEnc.
 */

jest.mock('@/lib/db', () => ({
  db: {
    telegramDestination: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    socialPost: { findMany: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
    socialTelegramBot: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireManager: jest.fn().mockResolvedValue({ id: 'mgr-1', username: 'boss', role: 'manager' }),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/social/destination-health', () => ({
  checkDestinationHealth: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { checkDestinationHealth } from '@/lib/social/destination-health'
import { GET as botsGET } from '../app/api/admin/social/telegram/bots/route'
import { POST as healthPOST } from '../app/api/admin/telegram-destinations/[id]/health/route'
import { POST as restorePOST } from '../app/api/admin/telegram-destinations/[id]/restore/route'
import { PATCH as destPATCH } from '../app/api/admin/telegram-destinations/[id]/route'
import { POST as listPOST } from '../app/api/admin/telegram-destinations/route'

const mockDb = db as unknown as {
  telegramDestination: {
    findUnique: jest.Mock
    update: jest.Mock
    create: jest.Mock
  }
  socialPost: { count: jest.Mock }
  socialTelegramBot: { findUnique: jest.Mock; findMany: jest.Mock }
}
const mockLogAction = logAction as jest.Mock
const mockCheckHealth = checkDestinationHealth as jest.Mock

function makeReq(url: string, method = 'GET', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) })

const SUPERGROUP_DEST = {
  id: 'dest-sg',
  chatId: '-100111',
  chatType: 'supergroup',
  username: null,
  title: 'مجموعة',
  status: 'active',
  verificationStatus: 'verified',
  isDefault: false,
  botId: null,
  messageThreadId: null,
  archivedAt: null,
  // بلا فحص صحة ناجح ⇒ النوع «مخمّن» لا مؤكد (غموض -100).
  lastHealthAt: null,
  lastHealthError: null,
}

const CONFIRMED_SUPERGROUP_DEST = {
  ...SUPERGROUP_DEST,
  lastHealthAt: '2026-10-15T10:00:00.000Z',
  lastHealthError: null,
}

const CHANNEL_DEST = { ...SUPERGROUP_DEST, id: 'dest-ch', chatId: '@chan', chatType: 'channel' }

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.TELEGRAM_BOT_TOKEN
})

describe('المرحلة 1 — تحقق المواضيع والبوت (إنشاء)', () => {
  it('يرفض thread مع معرّف -100 غير مؤكد (قد يكون قناة) ويطلب الفحص أولاً', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null) // not existing
    mockDb.socialTelegramBot.findUnique.mockResolvedValueOnce({ id: 'bot-1' })

    const res = await listPOST(
      makeReq('http://localhost/x', 'POST', {
        chatId: '-100111',
        botId: 'bot-1',
        messageThreadId: 3,
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(mockDb.telegramDestination.findUnique).toHaveBeenCalled()
    expect(JSON.stringify(body)).toMatch(/فحص الصحة/)
    expect(mockDb.telegramDestination.create).not.toHaveBeenCalled()
  })

  it('يقبل thread لمعرّف غير -100 (مجموعة عادية) مع بوت موجود', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null) // not existing
    mockDb.socialTelegramBot.findUnique.mockResolvedValueOnce({ id: 'bot-1' })
    mockDb.telegramDestination.create.mockResolvedValueOnce({
      ...SUPERGROUP_DEST,
      chatId: '-12345',
      chatType: 'group',
      botId: 'bot-1',
      messageThreadId: 2,
    })

    const res = await listPOST(
      makeReq('http://localhost/x', 'POST', {
        chatId: '-12345',
        botId: 'bot-1',
        messageThreadId: 2,
      }),
    )
    expect(res.status).toBe(200)
    expect(mockDb.telegramDestination.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ botId: 'bot-1', messageThreadId: 2 }),
      }),
    )
  })

  it('يرفض thread على معرّف @username (نوع مجهول — يطلب فحص الصحة أولاً)', async () => {
    // '@channews' صالح نحوياً (5+ أحرف) لكن نوعه unknown بلا استعلام —
    // يجب أن يصل لفحص الـ thread (فيستهلك findUnique) ثم يُرفض بـ unknown_type.
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)

    const res = await listPOST(
      makeReq('http://localhost/x', 'POST', { chatId: '@channews', messageThreadId: 2 }),
    )
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(mockDb.telegramDestination.findUnique).toHaveBeenCalled()
    expect(JSON.stringify(body)).toMatch(/فحص الصحة/)
    expect(mockDb.telegramDestination.create).not.toHaveBeenCalled()
  })

  it('يرفض botId غير موجود (422)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)
    mockDb.socialTelegramBot.findUnique.mockResolvedValueOnce(null)

    const res = await listPOST(
      makeReq('http://localhost/x', 'POST', { chatId: '-100111', botId: 'ghost' }),
    )
    expect(res.status).toBe(422)
    expect(mockDb.telegramDestination.create).not.toHaveBeenCalled()
  })
})

describe('المرحلة 1 — تحقق المواضيع والبوت (تعديل)', () => {
  it('يرفض thread على قناة موجودة (422)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(CHANNEL_DEST)

    const res = await destPATCH(
      makeReq('http://localhost/x', 'PATCH', { messageThreadId: 5 }),
      routeParams('dest-ch'),
    )
    expect(res.status).toBe(422)
    expect(mockDb.telegramDestination.update).not.toHaveBeenCalled()
  })

  it('يقبل thread صالحاً على supergroup مؤكدة الفحص ويخلي botId بـ null', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...CONFIRMED_SUPERGROUP_DEST,
      botId: 'bot-1',
    })
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...CONFIRMED_SUPERGROUP_DEST,
      botId: null,
      messageThreadId: 7,
    })

    const res = await destPATCH(
      makeReq('http://localhost/x', 'PATCH', { messageThreadId: 7, botId: null }),
      routeParams('dest-sg'),
    )
    expect(res.status).toBe(200)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ messageThreadId: 7, botId: null }),
      }),
    )
  })

  it('يرفض thread على supergroup غير مؤكدة الفحص (-100 غامض)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(SUPERGROUP_DEST)

    const res = await destPATCH(
      makeReq('http://localhost/x', 'PATCH', { messageThreadId: 7 }),
      routeParams('dest-sg'),
    )
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(JSON.stringify(body)).toMatch(/فحص الصحة/)
    expect(mockDb.telegramDestination.update).not.toHaveBeenCalled()
  })
})

describe('المرحلة 1 — فحص الصحة', () => {
  it('بلا بوت مسند ولا env → 422 NO_BOT_TOKEN', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(SUPERGROUP_DEST)

    const res = await healthPOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(body.error.code).toBe('NO_BOT_TOKEN')
    expect(mockCheckHealth).not.toHaveBeenCalled()
  })

  it('بوت معطل → 422 BOT_DISABLED', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...SUPERGROUP_DEST,
      botId: 'bot-1',
    })
    mockDb.socialTelegramBot.findUnique.mockResolvedValueOnce({
      id: 'bot-1',
      status: 'disabled',
      tokenEnc: 'x',
    })

    const res = await healthPOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(body.error.code).toBe('BOT_DISABLED')
  })

  it('نجاح الفحص يزامن النوع ويخبئ postCount ويخفي التوكن', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'env-token-value'
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...SUPERGROUP_DEST,
      chatType: 'unknown',
      title: null,
    })
    mockCheckHealth.mockResolvedValueOnce({
      ok: true,
      memberStatus: 'administrator',
      canPost: true,
      chat: { id: -100111, type: 'supergroup', title: 'الاسم الحقيقي' },
    })
    mockDb.socialPost.count.mockResolvedValueOnce(4)
    mockDb.telegramDestination.update.mockResolvedValueOnce({ ...SUPERGROUP_DEST })

    const res = await healthPOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.healthy).toBe(true)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastHealthError: null,
          postCount: 4,
          chatType: 'supergroup',
          title: 'الاسم الحقيقي',
        }),
      }),
    )
    const serialized = JSON.stringify(body) + JSON.stringify(mockLogAction.mock.calls)
    expect(serialized).not.toContain('env-token-value')
  })

  it('فشل الفحص يُخزَّن في lastHealthError ويُرجع healthy:false', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'env-token-value'
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(SUPERGROUP_DEST)
    mockCheckHealth.mockResolvedValueOnce({
      ok: false,
      memberStatus: 'kicked',
      canPost: false,
      error: 'البوت مطرود من الوجهة — أعده مشرفاً ثم أعد الفحص',
    })
    mockDb.socialPost.count.mockResolvedValueOnce(0)
    mockDb.telegramDestination.update.mockResolvedValueOnce({ ...SUPERGROUP_DEST })

    const res = await healthPOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.healthy).toBe(false)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastHealthError: expect.stringContaining('مطرود'),
        }),
      }),
    )
  })

  it('مزامنة النوع إلى قناة تُصفّر thread عالقاً وتُعلِم بذلك', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'env-token-value'
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...SUPERGROUP_DEST,
      messageThreadId: 5,
    })
    mockCheckHealth.mockResolvedValueOnce({
      ok: true,
      memberStatus: 'administrator',
      canPost: true,
      chat: { id: -100111, type: 'channel', title: 'قناة' },
    })
    mockDb.socialPost.count.mockResolvedValueOnce(1)
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...SUPERGROUP_DEST,
      messageThreadId: null,
    })

    const res = await healthPOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.healthy).toBe(true)
    expect(body.data.threadCleared).toBe(true)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chatType: 'channel', messageThreadId: null }),
      }),
    )
  })

  it('لا يصفّر thread سليماً على supergroup مؤكدة', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'env-token-value'
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...CONFIRMED_SUPERGROUP_DEST,
      messageThreadId: 5,
    })
    mockCheckHealth.mockResolvedValueOnce({
      ok: true,
      memberStatus: 'administrator',
      canPost: true,
      chat: { id: -100111, type: 'supergroup', title: 'مجموعة' },
    })
    mockDb.socialPost.count.mockResolvedValueOnce(1)
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...CONFIRMED_SUPERGROUP_DEST,
      messageThreadId: 5,
    })

    const res = await healthPOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.threadCleared).toBe(false)
    const updateArg = mockDb.telegramDestination.update.mock.calls[0][0]
    expect(updateArg.data.messageThreadId).toBeUndefined()
  })

  it('يخزّن username بلا @ — نفس صيغة مسار الإنشاء', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'env-token-value'
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...SUPERGROUP_DEST,
      chatId: '@mygroup',
      chatType: 'unknown',
      username: null,
    })
    mockCheckHealth.mockResolvedValueOnce({
      ok: true,
      memberStatus: 'administrator',
      canPost: true,
      chat: { id: -100111, type: 'supergroup', title: 'مجموعة', username: 'mygroup' },
    })
    mockDb.socialPost.count.mockResolvedValueOnce(0)
    mockDb.telegramDestination.update.mockResolvedValueOnce({ ...SUPERGROUP_DEST })

    const res = await healthPOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chatType: 'supergroup', username: 'mygroup' }),
      }),
    )
    expect(JSON.stringify(body)).not.toContain('@@')
  })

  it('يطبّع صفاً قديماً مخزناً بـ @handle إلى handle', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'env-token-value'
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      ...SUPERGROUP_DEST,
      chatId: '@old',
      chatType: 'supergroup',
      username: '@old',
    })
    mockCheckHealth.mockResolvedValueOnce({
      ok: true,
      memberStatus: 'administrator',
      canPost: true,
      chat: { id: -100111, type: 'supergroup', title: 'مجموعة', username: 'old' },
    })
    mockDb.socialPost.count.mockResolvedValueOnce(0)
    mockDb.telegramDestination.update.mockResolvedValueOnce({ ...SUPERGROUP_DEST })

    const res = await healthPOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    expect(res.status).toBe(200)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: 'old' }),
      }),
    )
  })
})

describe('المرحلة 1 — قائمة البوتات', () => {
  it('تُرجع الحقول الآمنة فقط — بلا tokenEnc أبداً', async () => {
    mockDb.socialTelegramBot.findMany.mockResolvedValueOnce([
      { id: 'bot-1', label: 'الرئيسي', botUsername: 'mainbot', status: 'active' },
    ])

    const res = await botsGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(mockDb.socialTelegramBot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, label: true, botUsername: true, status: true },
      }),
    )
    expect(JSON.stringify(body)).not.toContain('tokenEnc')
    expect(body.data.bots[0]).toEqual({
      id: 'bot-1',
      label: 'الرئيسي',
      botUsername: 'mainbot',
      status: 'active',
    })
  })
})

describe('المرحلة 1 — حارس الأرشيف والاستعادة الصريحة', () => {
  const ARCHIVED_DEST = {
    ...SUPERGROUP_DEST,
    id: 'dest-arch',
    status: 'disabled',
    archivedAt: '2026-10-15T10:00:00.000Z',
  }

  it('PATCH على صف مؤرشف → 409 بلا أي كتابة (يمنع الزومبي النشط-المخفي)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(ARCHIVED_DEST)

    const res = await destPATCH(
      makeReq('http://localhost/x', 'PATCH', { status: 'active' }),
      routeParams('dest-arch'),
    )
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(JSON.stringify(body)).toMatch(/مؤرشفة/)
    expect(mockDb.telegramDestination.update).not.toHaveBeenCalled()
  })

  it('الاستعادة تُفرغ الأرشيف وتعيد معلقة (لا نشطة أبداً) مع تدقيق', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(ARCHIVED_DEST)
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...ARCHIVED_DEST,
      archivedAt: null,
      status: 'pending',
    })

    const res = await restorePOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-arch'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dest-arch' },
        data: { archivedAt: null, status: 'pending' },
      }),
    )
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TELEGRAM_DESTINATION_RESTORED' }),
    )
    expect(body.data.archivedAt).toBeNull()
  })

  it('الاستعادة على غير مؤرشفة → 409', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(SUPERGROUP_DEST)

    const res = await restorePOST(makeReq('http://localhost/x', 'POST'), routeParams('dest-sg'))
    expect(res.status).toBe(409)
    expect(mockDb.telegramDestination.update).not.toHaveBeenCalled()
  })

  it('الاستعادة على مفقودة → 404', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)

    const res = await restorePOST(makeReq('http://localhost/x', 'POST'), routeParams('missing'))
    expect(res.status).toBe(404)
  })
})
