/**
 * تطابق سكيما↔هجرة للمرحلة 3: التوجيه والنشر المتعدد.
 *
 * الهجرة إضافية خالصة (لا حذف/تعديل/كتابة)، وتُنشئ الجداول الثلاثة
 * بالضبط مع قيد الوحدة (post,destination,thread) وفهارس الأداء.
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..', '..')
const MIGRATION = '20261016000000_phase3_routing_targets'
const SQL_PATH = path.join(ROOT, 'prisma', 'migrations', MIGRATION, 'migration.sql')
const sql = fs.readFileSync(SQL_PATH, 'utf8')

describe(`${MIGRATION} — routing + multi tables`, () => {
  it('exists and is additive-only', () => {
    expect(fs.existsSync(SQL_PATH)).toBe(true)
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i)
    expect(sql).not.toMatch(/ALTER\s+COLUMN/i)
    expect(sql).not.toMatch(/^\s*(DELETE|TRUNCATE|UPDATE|INSERT)\b/im)
  })

  it('creates exactly the three phase-3 tables', () => {
    const created = [...sql.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((match) => match[1])
    expect(created.sort()).toEqual(
      ['social_post_deliveries', 'social_post_targets', 'social_publish_routes'].sort(),
    )
  })

  it('uses TIMESTAMP(3) for datetimes (Prisma default, no drift)', () => {
    expect(sql).not.toMatch(/TIMESTAMPTZ/i)
    expect(sql).toMatch(/TIMESTAMP\(3\)/)
  })

  it('guards (post,destination,thread) uniqueness at the DB level', () => {
    expect(sql).toMatch(/UNIQUE.*"post_id", "destination_id", "thread_id"/)
  })

  it('cascades post/destination deletes, nulls bot unlinks', () => {
    const cascadeCount = (sql.match(/ON DELETE CASCADE/g) || []).length
    const setNullCount = (sql.match(/ON DELETE SET NULL/g) || []).length
    // routes.destination + targets.(post,destination) + deliveries.(post,destination)
    expect(cascadeCount).toBe(5)
    // bot FKs الثلاثة تُصفَّر بدل الحذف المتتالي.
    expect(setNullCount).toBe(3)
  })
})
