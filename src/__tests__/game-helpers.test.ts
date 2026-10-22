/**
 * اختبارات عدّادات اللعبة (game-helpers).
 *
 * القاعدة (C-SEMANTICS):
 *   Game.totalDownloads    == SUM(Mod.downloads)    over PUBLISHED mods
 *   Game.totalEndorsements == SUM(Mod.endorsements) over PUBLISHED mods
 *   Game.modCount          == COUNT(Mod)            over PUBLISHED mods
 *
 * الاختبارات تعمل على db مُموَّه (mocked) — لا تلمس قاعدة الإنتاج إطلاقاً.
 */

const mockDb = {
  mod: { aggregate: jest.fn() },
  game: { update: jest.fn() },
  $transaction: jest.fn(),
}

jest.mock('@/lib/db', () => ({
  db: mockDb,
}))

import { computeGameTotals, syncGameCounts } from '@/lib/game-helpers'

const mockedDb = mockDb as unknown as {
  mod: { aggregate: jest.Mock }
  game: { update: jest.Mock }
  $transaction: jest.Mock
}

/** محاكاة معاملة Prisma: تُنفّذ الدالة على tx نفسه. */
function mockTransaction() {
  mockedDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockDb),
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockTransaction()
  mockedDb.game.update.mockResolvedValue({})
})

describe('computeGameTotals', () => {
  it('يجمع التحميلات والتزكيات وعدد المودات المنشورة', async () => {
    mockedDb.mod.aggregate.mockResolvedValue({
      _count: 7,
      _sum: { downloads: 1200, endorsements: 340 },
    })

    const totals = await computeGameTotals('game-1')

    expect(totals).toEqual({ modCount: 7, totalDownloads: 1200, totalEndorsements: 340 })
    expect(mockedDb.mod.aggregate).toHaveBeenCalledWith({
      where: { gameId: 'game-1', workflowStatus: 'PUBLISHED' },
      _sum: { downloads: true, endorsements: true },
      _count: true,
    })
  })

  it('لعبة بلا مودات ← أصفار (لا انهيار)', async () => {
    mockedDb.mod.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { downloads: null, endorsements: null },
    })

    const totals = await computeGameTotals('game-empty')

    expect(totals).toEqual({ modCount: 0, totalDownloads: 0, totalEndorsements: 0 })
  })
})

describe('syncGameCounts', () => {
  it('يكتب modCount/totalDownloads/totalEndorsements من التجميع', async () => {
    mockedDb.mod.aggregate.mockResolvedValue({
      _count: 3,
      _sum: { downloads: 500, endorsements: 120 },
    })

    await syncGameCounts('game-1')

    expect(mockedDb.game.update).toHaveBeenCalledWith({
      where: { id: 'game-1' },
      data: { modCount: 3, totalDownloads: 500, totalEndorsements: 120 },
    })
  })

  it('لعبة بلا مودات ← يكتب أصفاراً (لا انهيار، لا بقاء أرقام قديمة)', async () => {
    mockedDb.mod.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { downloads: null, endorsements: null },
    })

    await syncGameCounts('game-empty')

    expect(mockedDb.game.update).toHaveBeenCalledWith({
      where: { id: 'game-empty' },
      data: { modCount: 0, totalDownloads: 0, totalEndorsements: 0 },
    })
  })

  it('يحسب فقط المودات المنشورة', async () => {
    mockedDb.mod.aggregate.mockResolvedValue({ _count: 0, _sum: {} })

    await syncGameCounts('game-1')

    expect(mockedDb.mod.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { gameId: 'game-1', workflowStatus: 'PUBLISHED' } }),
    )
  })

  it('الكتابة تتم داخل معاملة واحدة', async () => {
    mockedDb.mod.aggregate.mockResolvedValue({
      _count: 1,
      _sum: { downloads: 1, endorsements: 1 },
    })

    await syncGameCounts('game-1')

    expect(mockedDb.$transaction).toHaveBeenCalledTimes(1)
  })

  it('لا يكتب الـ baseline (هو مجموع baselines المودات وليس بAggregate هنا)', async () => {
    mockedDb.mod.aggregate.mockResolvedValue({
      _count: 1,
      _sum: { downloads: 10, endorsements: 5 },
    })

    await syncGameCounts('game-1')

    const data = mockedDb.game.update.mock.calls[0][0].data
    expect(Object.keys(data).sort()).toEqual(['modCount', 'totalDownloads', 'totalEndorsements'])
  })
})
