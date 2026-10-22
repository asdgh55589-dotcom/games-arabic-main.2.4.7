/**
 * اختبارات ثابتة لملف الميجريشن
 * prisma/migrations/20261021000000_stats_baseline_and_dedup/migration.sql
 *
 * الهدف: منع انحراف الميجريشن عن مخطط Prisma وعن اصطلاح أسماء الـ indexes
 * (Prisma يولّد الأسماء بنفسه — أي اختلاف يُنتج drift في migrate diff القادم).
 *
 * هذه اختبارات ثابتة على النص (static) — لا تلمس قاعدة البيانات إطلاقاً.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const MIGRATION = path.join(
  root,
  'prisma/migrations/20261021000000_stats_baseline_and_dedup/migration.sql',
)

function migration(): string {
  return fs.readFileSync(MIGRATION, 'utf8')
}

describe('migration 20261021000000_stats_baseline_and_dedup', () => {
  it('الملف موجود وغير فارغ', () => {
    expect(fs.existsSync(MIGRATION)).toBe(true)
    expect(migration().length).toBeGreaterThan(500)
  })

  it('يضيف أعمدة الـ baseline الستة', () => {
    const sql = migration()
    expect(sql).toContain(
      'ALTER TABLE "Mod" ADD COLUMN IF NOT EXISTS "downloadsBaseline" INTEGER NOT NULL DEFAULT 0',
    )
    expect(sql).toContain(
      'ALTER TABLE "Mod" ADD COLUMN IF NOT EXISTS "endorsementsBaseline" INTEGER NOT NULL DEFAULT 0',
    )
    expect(sql).toContain(
      'ALTER TABLE "Mod" ADD COLUMN IF NOT EXISTS "viewsBaseline" INTEGER NOT NULL DEFAULT 0',
    )
    expect(sql).toContain(
      'ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "totalDownloadsBaseline" INTEGER NOT NULL DEFAULT 0',
    )
    expect(sql).toContain(
      'ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "totalEndorsementsBaseline" INTEGER NOT NULL DEFAULT 0',
    )
    expect(sql).toContain(
      'ALTER TABLE "Series" ADD COLUMN IF NOT EXISTS "totalDownloadsBaseline" INTEGER NOT NULL DEFAULT 0',
    )
    expect(sql).toContain(
      'ALTER TABLE "Series" ADD COLUMN IF NOT EXISTS "totalEndorsementsBaseline" INTEGER NOT NULL DEFAULT 0',
    )
  })

  it('يوحّد مفردات التزكيات القديمة (up→thumbsup، down→thumbsdown)', () => {
    const sql = migration()
    expect(sql).toContain(`UPDATE "Endorsement" SET "value" = 'thumbsup'  WHERE "value" = 'up'`)
    expect(sql).toContain(`UPDATE "Endorsement" SET "value" = 'thumbsdown' WHERE "value" = 'down'`)
  })

  it('يضيف عمود dayBucket للجدولين', () => {
    const sql = migration()
    expect(sql).toContain('ALTER TABLE "ModView" ADD COLUMN IF NOT EXISTS "dayBucket" TIMESTAMP(3)')
    expect(sql).toContain(
      'ALTER TABLE "DownloadClick" ADD COLUMN IF NOT EXISTS "dayBucket" TIMESTAMP(3)',
    )
  })

  it('ينشئ indexes التفرّد الأربعة بأسماء Prisma الاصطلاحية', () => {
    const sql = migration()
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "ModView_modId_userId_dayBucket_key" ON "ModView"("modId", "userId", "dayBucket")',
    )
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "ModView_modId_ipAddress_dayBucket_key" ON "ModView"("modId", "ipAddress", "dayBucket")',
    )
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "DownloadClick_modId_userId_dayBucket_key" ON "DownloadClick"("modId", "userId", "dayBucket")',
    )
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "DownloadClick_modId_ipAddress_dayBucket_key" ON "DownloadClick"("modId", "ipAddress", "dayBucket")',
    )
  })

  it('يحتوي على قسم الرجوع (rollback)', () => {
    const sql = migration()
    expect(sql).toMatch(/--\s*ROLLBACK/i)
    expect(sql).toContain('DROP INDEX IF EXISTS "ModView_modId_userId_dayBucket_key"')
    expect(sql).toContain('ALTER TABLE "Mod" DROP COLUMN IF EXISTS "viewsBaseline"')
  })

  it('كل عبارات DDL قابلة لإعادة التشغيل (idempotent)', () => {
    const sql = migration()
    const alters = sql.match(/ALTER TABLE "[^"]+" ADD COLUMN(?! IF NOT EXISTS)/g) || []
    expect(alters).toHaveLength(0)

    const indexes = sql.match(/CREATE UNIQUE INDEX(?! IF NOT EXISTS)/g) || []
    expect(indexes).toHaveLength(0)
  })

  it('يحتوي على حذف الـ duplicates قبل إنشاء الـ indexes (حارس أمان)', () => {
    const sql = migration()
    const dedupIdx = sql.indexOf('DELETE FROM "ModView" a USING "ModView" b')
    const indexIdx = sql.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS "ModView_modId_userId_dayBucket_key"')
    expect(dedupIdx).toBeGreaterThan(-1)
    expect(indexIdx).toBeGreaterThan(-1)
    expect(dedupIdx).toBeLessThan(indexIdx)
    expect(sql).toContain('DELETE FROM "DownloadClick" a USING "DownloadClick" b')
  })

  it('الـ baseline = العدّاد ناقص صفوف التفاصيل (لا يساوي العدّاد كاملاً)', () => {
    const sql = migration()
    expect(sql).toContain('SET "viewsBaseline" = GREATEST(0, m."views" - (')
    expect(sql).toContain('SET "downloadsBaseline" = GREATEST(0, m."downloads" - (')
    expect(sql).toContain('SET "endorsementsBaseline" = GREATEST(0, m."endorsements" - (')
    // لا يجوز: baseline = counter مباشرة (كان يضاعف الصفوف عند المصالحة)
    expect(sql).not.toMatch(/SET "viewsBaseline"\s*=\s*"views"/)
    expect(sql).not.toMatch(/SET "downloadsBaseline"\s*=\s*"downloads"/)
    expect(sql).not.toMatch(/SET "endorsementsBaseline"\s*=\s*"endorsements"/)
  })

  it('تعبئة baseline للـ Game تأخذ مجموع baselines المودات المنشورة', () => {
    const sql = migration()
    expect(sql).toContain('SELECT COALESCE(SUM(m."downloadsBaseline"), 0)::int FROM "Mod" m')
    expect(sql).toContain('SELECT COALESCE(SUM(m."endorsementsBaseline"), 0)::int FROM "Mod" m')
    expect(sql).toContain(`m."workflowStatus" = 'PUBLISHED'`)
  })

  it('تعبئة baseline للـ Series تأخذ مجموع baselines مودات السلسلة', () => {
    const sql = migration()
    expect(sql).toContain('WHERE m."seriesId" = s."id"')
  })

  it('توحيد المفردات يسبق تعبئة الـ baseline (وإلا فُقدت 9 تزكيات)', () => {
    const sql = migration()
    const normIdx = sql.indexOf(`SET "value" = 'thumbsup'`)
    const backfillIdx = sql.indexOf('SET "endorsementsBaseline"')
    expect(normIdx).toBeGreaterThan(-1)
    expect(backfillIdx).toBeGreaterThan(-1)
    expect(normIdx).toBeLessThan(backfillIdx)
  })

  it('backfill الـ seriesId محمي (يطابق اسماً واحداً فقط، ولا يلمس mods بلا اسم)', () => {
    const sql = migration()
    expect(sql).toContain('UPDATE "Mod" m SET "seriesId" = s."id"')
    expect(sql).toContain(`btrim(m."series") <> ''`)
    expect(sql).toContain('lower(btrim(s."name")) = lower(btrim(m."series"))')
    expect(sql).toContain(') = 1;')
  })

  it('لا يحتوي على أي DML مدمر على صفوس التاريخ (TRUNCATE/DROP TABLE)', () => {
    const sql = migration()
    expect(sql).not.toMatch(/TRUNCATE/i)
    expect(sql).not.toMatch(/DROP\s+TABLE/i)
  })
})

describe('المخطط يتطابق مع الميجريشن', () => {
  it('prisma/schema.prisma يحتوي أعمدة الـ baseline والـ dayBucket', () => {
    const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
    expect(schema).toContain('viewsBaseline')
    expect(schema).toContain('downloadsBaseline')
    expect(schema).toContain('endorsementsBaseline')
    expect(schema).toContain('totalDownloadsBaseline')
    expect(schema).toContain('totalEndorsementsBaseline')
    expect(schema).toMatch(/dayBucket\s+DateTime\?/)
    expect(schema).toContain('@@unique([modId, userId, dayBucket])')
    expect(schema).toContain('@@unique([modId, ipAddress, dayBucket])')
  })
})
