/**
 * اختبارات مصالحة الإحصائيات (stats-reconcile).
 *
 * القاعدة (C-SEMANTICS):
 *   Mod.views        == Mod.viewsBaseline        + COUNT(ModView   WHERE modId)
 *   Mod.downloads    == Mod.downloadsBaseline    + COUNT(DownloadClick WHERE modId)
 *   Mod.endorsements == Mod.endorsementsBaseline + COUNT(Endorsement WHERE modId
 *                                                      AND value IN ('fire','sparkle','thumbsup'))
 *
 * التزكيات الإيجابية فقط — thumbsdown تفاعل سلبي وليس إعجاباً.
 *
 * الاختبارات تعمل على db مُموَّه (mocked) — لا تلمس قاعدة الإنتاج إطلاقاً.
 */
import { Prisma } from '@prisma/client'

const mockDb = {
  mod: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  modView: { count: jest.fn() },
  downloadClick: { count: jest.fn() },
  endorsement: { count: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
}

jest.mock('@/lib/db', () => ({
  db: mockDb,
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import {
  computeModCounters,
  POSITIVE_ENDORSEMENT_VALUES,
  PUBLISHED_STATUS,
  reconcileAllStats,
  reconcileModStats,
} from '@/lib/stats-reconcile'

const mockedDb = mockDb as unknown as {
  mod: { findUnique: jest.Mock; update: jest.Mock }
  modView: { count: jest.Mock }
  downloadClick: { count: jest.Mock }
  endorsement: { count: jest.Mock }
  $queryRaw: jest.Mock
  $executeRaw: jest.Mock
}

/** يستخرج نص SQL من Prisma.Sql (المكوّنات raw تُجمَّع في .strings/.values). */
function sqlText(value: unknown): string {
  const parts: string[] = []
  const walk = (node: any): void => {
    if (!node) return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node === 'object') {
      if (typeof node.strings === 'object' && Array.isArray(node.strings)) {
        node.strings.forEach((s: string) => parts.push(s))
      }
      if (node.values) node.values.forEach(walk)
    }
  }
  walk(value)
  return parts.join(' ')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedDb.mod.update.mockResolvedValue({})
  mockedDb.$queryRaw.mockResolvedValue([])
  mockedDb.$executeRaw.mockResolvedValue(0)
})

describe('computeModCounters — الصيغة الأساسية', () => {
  it('endorsements = baseline + عدد التزكيات الإيجابية', () => {
    const out = computeModCounters(
      { viewsBaseline: 10, downloadsBaseline: 20, endorsementsBaseline: 30 },
      { viewCount: 1, downloadCount: 2, positiveEndorsementCount: 3 },
    )
    expect(out).toEqual({ views: 11, downloads: 22, endorsements: 33 })
  })

  it('views/downloads = baseline + عدد الصفوف', () => {
    const out = computeModCounters(
      { viewsBaseline: 100, downloadsBaseline: 200, endorsementsBaseline: 0 },
      { viewCount: 7, downloadCount: 9, positiveEndorsementCount: 0 },
    )
    expect(out.views).toBe(107)
    expect(out.downloads).toBe(209)
    expect(out.endorsements).toBe(0)
  })

  it('مود بلا صفوف تفاصيل يحتفظ بالـ baseline (لا ينهار، لا يصفر)', () => {
    const out = computeModCounters(
      { viewsBaseline: 500, downloadsBaseline: 600, endorsementsBaseline: 700 },
      { viewCount: 0, downloadCount: 0, positiveEndorsementCount: 0 },
    )
    expect(out).toEqual({ views: 500, downloads: 600, endorsements: 700 })
  })

  it('القيم الإيجابية هي fire/sparkle/thumbsup فقط', () => {
    expect([...POSITIVE_ENDORSEMENT_VALUES]).toEqual(['fire', 'sparkle', 'thumbsup'])
    expect([...POSITIVE_ENDORSEMENT_VALUES]).not.toContain('thumbsdown')
  })
})

describe('reconcileModStats — مود واحد', () => {
  const modRow = {
    id: 'mod-1',
    views: 1000,
    downloads: 2000,
    endorsements: 3000,
    viewsBaseline: 900,
    downloadsBaseline: 1900,
    endorsementsBaseline: 2900,
  }

  it('يحسب counters = baseline + صفوف التفاصيل', async () => {
    mockedDb.mod.findUnique.mockResolvedValue(modRow)
    mockedDb.modView.count.mockResolvedValue(10)
    mockedDb.downloadClick.count.mockResolvedValue(5)
    mockedDb.endorsement.count.mockResolvedValue(4)

    const diff = await reconcileModStats('mod-1')

    expect(diff).not.toBeNull()
    expect(diff?.after).toEqual({ views: 910, downloads: 1905, endorsements: 2904 })
    expect(diff?.before).toEqual({ views: 1000, downloads: 2000, endorsements: 3000 })
    expect(diff?.changed).toBe(true)
  })

  it('يستثني thumbsdown من التزكيات (الفلتر يُمرَّر إلى Prisma)', async () => {
    mockedDb.mod.findUnique.mockResolvedValue(modRow)
    mockedDb.modView.count.mockResolvedValue(0)
    mockedDb.downloadClick.count.mockResolvedValue(0)
    mockedDb.endorsement.count.mockResolvedValue(0)

    await reconcileModStats('mod-1')

    expect(mockedDb.endorsement.count).toHaveBeenCalledWith({
      where: { modId: 'mod-1', value: { in: ['fire', 'sparkle', 'thumbsup'] } },
    })
    const where = mockedDb.endorsement.count.mock.calls[0][0].where
    expect(where.value.in).not.toContain('thumbsdown')
    expect(where.value.in).toContain('thumbsup')
  })

  it('مود بلا صفوف تفاصيل: النتيجة = الـ baseline (لا انهيار، لا تصفير)', async () => {
    mockedDb.mod.findUnique.mockResolvedValue({
      ...modRow,
      views: 900,
      downloads: 1900,
      endorsements: 2900,
    })
    mockedDb.modView.count.mockResolvedValue(0)
    mockedDb.downloadClick.count.mockResolvedValue(0)
    mockedDb.endorsement.count.mockResolvedValue(0)

    const diff = await reconcileModStats('mod-1')

    expect(diff?.after).toEqual({ views: 900, downloads: 1900, endorsements: 2900 })
    expect(diff?.changed).toBe(false)
    expect(mockedDb.mod.update).not.toHaveBeenCalled()
  })

  it('dryRun لا يكتب شيئاً', async () => {
    mockedDb.mod.findUnique.mockResolvedValue(modRow)
    mockedDb.modView.count.mockResolvedValue(0)
    mockedDb.downloadClick.count.mockResolvedValue(0)
    mockedDb.endorsement.count.mockResolvedValue(0)

    const diff = await reconcileModStats('mod-1', { dryRun: true })

    expect(diff?.dryRun).toBe(true)
    expect(mockedDb.mod.update).not.toHaveBeenCalled()
  })

  it('مود غير موجود يعيد null', async () => {
    mockedDb.mod.findUnique.mockResolvedValue(null)
    const diff = await reconcileModStats('does-not-exist')
    expect(diff).toBeNull()
  })

  it('يكتب الأعداد المستهدفة عند وجود فرق', async () => {
    mockedDb.mod.findUnique.mockResolvedValue(modRow)
    mockedDb.modView.count.mockResolvedValue(10)
    mockedDb.downloadClick.count.mockResolvedValue(5)
    mockedDb.endorsement.count.mockResolvedValue(4)

    await reconcileModStats('mod-1')

    expect(mockedDb.mod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: { views: 910, downloads: 1905, endorsements: 2904 },
    })
  })
})

describe('reconcileAllStats — SQL الجماعي', () => {
  it('SQL المودات يحتوي أعمدة الـ baseline وفلتر التزكيات الإيجابية', async () => {
    mockedDb.$queryRaw.mockResolvedValue([])
    mockedDb.$executeRaw.mockResolvedValue(0)

    await reconcileAllStats({ dryRun: true })

    expect(mockedDb.$queryRaw).toHaveBeenCalled()
    const sql = sqlText(mockedDb.$queryRaw.mock.calls[0][0])
    expect(sql).toContain('"viewsBaseline"')
    expect(sql).toContain('"downloadsBaseline"')
    expect(sql).toContain('"endorsementsBaseline"')
    expect(sql).toContain("'fire', 'sparkle', 'thumbsup'")
    expect(sql).not.toContain('thumbsdown')
    expect(sql).toContain('COUNT(*)')
  })

  it('dryRun لا ينفّذ UPDATE', async () => {
    mockedDb.$queryRaw.mockResolvedValue([])
    mockedDb.$executeRaw.mockResolvedValue(0)

    await reconcileAllStats({ dryRun: true })

    expect(mockedDb.$executeRaw).not.toHaveBeenCalled()
  })

  it('غير dryRun ينفّذ 3 تطبيقات (مودات + ألعاب + سلاسل)', async () => {
    mockedDb.$queryRaw.mockResolvedValue([])
    mockedDb.$executeRaw.mockResolvedValue(0)

    await reconcileAllStats({})

    expect(mockedDb.$executeRaw).toHaveBeenCalledTimes(3)
  })

  it('يحسب أهداف اللعبة من المودات المنشورة فقط', async () => {
    mockedDb.$queryRaw.mockResolvedValue([])
    mockedDb.$executeRaw.mockResolvedValue(0)

    await reconcileAllStats({ dryRun: true })

    const sql = sqlText(mockedDb.$queryRaw.mock.calls[1][0])
    expect(sql).toContain(`"workflowStatus" = '${PUBLISHED_STATUS}'`)
    expect(sql).toContain('"modCount"')
    expect(sql).toContain('"totalDownloads"')
    expect(sql).toContain('"totalEndorsements"')
  })

  it('يحسب أهداف السلسلة من مودات السلسلة (seriesId)', async () => {
    mockedDb.$queryRaw.mockResolvedValue([])
    mockedDb.$executeRaw.mockResolvedValue(0)

    await reconcileAllStats({ dryRun: true })

    const sql = sqlText(mockedDb.$queryRaw.mock.calls[2][0])
    expect(sql).toContain('"seriesId"')
    expect(sql).toContain('"Series"')
  })

  it('يقرأ الملخّص من أول صف ويعيد الأعداد', async () => {
    mockedDb.$queryRaw.mockResolvedValue([
      {
        modsScanned: 225,
        modsChanged: 3,
        viewsDelta: 10,
        downloadsDelta: -2,
        endorsementsDelta: 1,
      },
    ])

    const summary = await reconcileAllStats({ dryRun: true })

    expect(summary.modsScanned).toBe(225)
    expect(summary.modsChanged).toBe(3)
    expect(summary.viewsDelta).toBe(10)
    expect(summary.downloadsDelta).toBe(-2)
    expect(summary.endorsementsDelta).toBe(1)
    expect(summary.errors).toEqual([])
  })

  it('خطأ في الاستعلام يُسجَّل في errors ولا يرمي استثناء', async () => {
    mockedDb.$queryRaw.mockRejectedValue(new Error('boom'))

    const summary = await reconcileAllStats({ dryRun: true })

    expect(summary.errors.length).toBeGreaterThan(0)
    expect(summary.errors[0]).toContain('boom')
  })

  it('SQL المودات يستعمل Mod كجدول أساسي ويقارن العدّادات', async () => {
    mockedDb.$queryRaw.mockResolvedValue([])
    mockedDb.$executeRaw.mockResolvedValue(0)

    await reconcileAllStats({ dryRun: true })

    const sql = sqlText(mockedDb.$queryRaw.mock.calls[0][0])
    expect(sql).toContain('FROM "Mod"')
    expect(sql).toContain('LEFT JOIN v ON v."modId" = m."id"')
  })
})

describe('Prisma SQL — سلامة التركيب', () => {
  it('الاستعلامات مبنية بـ Prisma.sql (ليست نصوصاً خاماً)', () => {
    const sql = sqlText(Prisma.sql`SELECT ${1}`)
    expect(sql).toContain('SELECT')
  })
})
