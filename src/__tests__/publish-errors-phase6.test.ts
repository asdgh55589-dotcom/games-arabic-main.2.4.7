/**
 * Phase 6 — مركز أخطاء النشر: تطابق سكيما↔هجرة + اكتمال الكتالوج والإشعارات.
 *
 * يقفل: (1) هجرة publish_error_events إضافية خالصة ومطابقة للنموذج عموداً
 * بعمود، (2) كل رمز كتالوج له سبب/إصلاح/قابلية إعادة والـ fallback آمن،
 * (3) الأنواع الأربعة الجديدة مكتملة في كل خرائط الإشعارات والقوالب
 * (in_app + email)، (4) صفر alert() في مسارات النشر — إرشاد منظّم بدلاً منه.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { EMAILABLE_TYPES, NOTIFICATION_TYPE_LABELS, NotificationType } from '@/domain/index'
import { DEFAULT_DEDUPLICATION_CONFIG } from '@/domain/policies/deduplication-policy'
import { PUBLISH_ERROR_CATALOG, PUBLISH_ERROR_CODES, publishErrorDef } from '@/lib/publish-errors'

const ROOT = path.resolve(__dirname, '..', '..')
const MIGRATION = '20261017000002_phase6_publish_errors'
const SQL_PATH = path.join(ROOT, 'prisma/migrations', MIGRATION, 'migration.sql')
const SCHEMA_PATH = path.join(ROOT, 'prisma/schema.prisma')
const SQL = fs.readFileSync(SQL_PATH, 'utf8')
const SCHEMA = fs.readFileSync(SCHEMA_PATH, 'utf8')

const PRISMA_TO_SQL_TYPE: Record<string, string> = {
  String: 'TEXT',
  Int: 'INTEGER',
  BigInt: 'BIGINT',
  Boolean: 'BOOLEAN',
  DateTime: 'TIMESTAMP(3)',
  Float: 'DOUBLE PRECISION',
  Json: 'JSONB',
}

function modelBody(name: string): string {
  const start = SCHEMA.indexOf(`model ${name} {`)
  if (start < 0) throw new Error(`model ${name} not found`)
  const end = SCHEMA.indexOf('\n}', start)
  return SCHEMA.slice(start, end + 2)
}

function mappedColumnNames(body: string): string[] {
  const names: string[] = []
  for (const rawLine of body.split('\n')) {
    const line = rawLine.split('//')[0].trim()
    if (!line || line.startsWith('model ') || line.startsWith('@@') || line.startsWith('}'))
      continue
    const field = line.match(/^(\w+)\s+(\w+)(\??)(\[\])?/)
    if (!field) continue
    const [, name, typeName, , listMarker] = field
    if (listMarker || !(typeName in PRISMA_TO_SQL_TYPE)) continue
    const mapMatch = line.match(/@map\("([^"]+)"\)/)
    names.push(mapMatch ? mapMatch[1] : name)
  }
  return names
}

function sqlCreateTableColumns(table: string): string[] {
  const match = SQL.match(new RegExp(`CREATE TABLE "${table}" \\(\\n([\\s\\S]*?)\\n\\);`))
  if (!match) throw new Error(`CREATE TABLE "${table}" not found in ${MIGRATION}`)
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('CONSTRAINT'))
    .map((line) => {
      const col = line.match(/^"([^"]+)"/)
      if (!col) throw new Error(`unparsed SQL column line: ${line}`)
      return col[1]
    })
}

describe(`${MIGRATION} — publish error events table`, () => {
  it('exists and is additive-only (no drops/alters/dml)', () => {
    expect(fs.existsSync(SQL_PATH)).toBe(true)
    expect(SQL).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i)
    expect(SQL).not.toMatch(/ALTER\s+COLUMN/i)
    expect(SQL).not.toMatch(/^\s*(DELETE|TRUNCATE|UPDATE|INSERT)\b/im)
  })

  it('creates exactly the publish_error_events table', () => {
    const created = [...SQL.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1])
    expect(created).toEqual(['publish_error_events'])
  })

  it('model columns match the migration, in order', () => {
    expect(sqlCreateTableColumns('publish_error_events')).toEqual(
      mappedColumnNames(modelBody('PublishErrorEvent')),
    )
  })

  it('uses TIMESTAMP(3) for datetimes (no drift)', () => {
    expect(SQL).not.toMatch(/TIMESTAMPTZ/i)
    expect(SQL).toMatch(/TIMESTAMP\(3\)/)
  })

  it('indexes the unresolved-list, entity-scope and catalog-code lookups', () => {
    expect(SQL).toMatch(/ON "publish_error_events"\("resolved_at", "created_at"\)/)
    expect(SQL).toMatch(/ON "publish_error_events"\("scope", "ref_id"\)/)
    expect(SQL).toMatch(/ON "publish_error_events"\("code"\)/)
  })
})

describe('publish error catalog completeness', () => {
  it('every code carries an Arabic cause + fix and a retryable flag', () => {
    for (const code of PUBLISH_ERROR_CODES) {
      const def = PUBLISH_ERROR_CATALOG[code]
      expect(def.causeAr.length).toBeGreaterThan(0)
      expect(def.fixAr.length).toBeGreaterThan(0)
      expect(typeof def.retryable).toBe('boolean')
    }
  })

  it('unknown codes fall back to the "unknown" definition without throwing', () => {
    const def = publishErrorDef('this_code_does_not_exist')
    expect(def.code).toBe('unknown')
    expect(def.causeAr).toBe(PUBLISH_ERROR_CATALOG.unknown.causeAr)
  })

  it('all codes referenced by the publish engine exist in the catalog', () => {
    for (const code of [
      'destination_missing',
      'destination_not_qualified',
      'destination_archived',
      'rich_spec_invalid',
      'validation_failed',
      'caption_too_long',
      'rate_limited',
      'transport_rejected',
      'chat_not_found',
      'parse_error',
      'bot_missing',
      'bot_not_active',
      'bot_token_decrypt',
      'legacy_job_failed',
      'unsupported_platform',
    ]) {
      expect(PUBLISH_ERROR_CODES).toContain(code)
    }
  })
})

describe('phase 6 notification types — full map coverage', () => {
  const NEW_TYPES = [
    NotificationType.SocialPublishFailed,
    NotificationType.SocialPublishSucceeded,
    NotificationType.PublishDegraded,
    NotificationType.PublishDigest,
  ] as const

  it('each new type has an Arabic display label', () => {
    for (const type of NEW_TYPES) {
      expect(NOTIFICATION_TYPE_LABELS[type]).toBeTruthy()
    }
  })

  it('failure/degraded/digest are emailable; success stays in-app only', () => {
    expect(EMAILABLE_TYPES.has(NotificationType.SocialPublishFailed)).toBe(true)
    expect(EMAILABLE_TYPES.has(NotificationType.PublishDegraded)).toBe(true)
    expect(EMAILABLE_TYPES.has(NotificationType.PublishDigest)).toBe(true)
    expect(EMAILABLE_TYPES.has(NotificationType.SocialPublishSucceeded)).toBe(false)
  })

  it('each new type has a dedupe window configured', () => {
    const windows = DEFAULT_DEDUPLICATION_CONFIG.windowMinutes
    expect(windows[NotificationType.SocialPublishFailed]).toBe(30)
    expect(windows[NotificationType.PublishDegraded]).toBe(60)
    expect(windows[NotificationType.SocialPublishSucceeded]).toBe(0)
    expect(windows[NotificationType.PublishDigest]).toBe(0)
  })

  it('each new type has in_app and email templates seeded', () => {
    const seed = fs.readFileSync(path.join(ROOT, 'prisma/seed-notification-templates.ts'), 'utf8')
    for (const type of NEW_TYPES) {
      const matches = seed.match(new RegExp(`type: '${type}'`, 'g')) ?? []
      // in_app + email rows share the same `type` value.
      expect(matches.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('mirrored in the zod NotificationType enum', () => {
    const schemas = fs.readFileSync(path.join(ROOT, 'src/lib/schemas.ts'), 'utf8')
    for (const type of NEW_TYPES) {
      expect(schemas).toContain(`'${type}'`)
    }
  })
})

describe('zero alert() in publish flows (Phase 6 Cat-7 #12)', () => {
  const FLOW_DIRS = [
    'src/app/admin/publish',
    'src/app/admin/scheduler',
    'src/app/api/admin/social',
    'src/app/api/cron/social-publish',
    'src/lib/social',
    'src/components/admin/social',
  ]

  function collect(dir: string): string[] {
    const abs = path.join(ROOT, dir)
    if (!fs.existsSync(abs)) return []
    const out: string[] = []
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...collect(rel))
      else if (/\.(ts|tsx)$/.test(entry.name) && !rel.includes('__tests__')) out.push(rel)
    }
    return out
  }

  it('publish surfaces use catalog-driven toasts, not window alert()', () => {
    const offenders: string[] = []
    for (const dir of FLOW_DIRS) {
      for (const file of collect(dir)) {
        const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          // Ignore comment-only lines (documentation may mention alert()).
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue
          }
          if (/[^.\w]alert\(/.test(line)) {
            offenders.push(`${file}: ${trimmed}`)
            break
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
