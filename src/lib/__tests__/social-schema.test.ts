/**
 * Social Hub A0 — schema ↔ migration parity للنماذج الجديدة.
 *
 * يقفل أن نماذج SocialPost / SocialPostTemplate / SocialTelegramBot في
 * schema.prisma مطابقة عموداً بعمود لهجرة 20261008000000_social_hub،
 * وأن العميل المولّد يعرّفها فعلاً.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..', '..')
const MIGRATION = '20261008000000_social_hub'
const SQL_PATH = path.join(ROOT, 'prisma/migrations', MIGRATION, 'migration.sql')
const SCHEMA_PATH = path.join(ROOT, 'prisma/schema.prisma')

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
const sql = fs.existsSync(SQL_PATH) ? fs.readFileSync(SQL_PATH, 'utf8') : ''

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
  const start = schema.indexOf(`model ${name} {`)
  if (start < 0) throw new Error(`model ${name} not found in schema.prisma`)
  const end = schema.indexOf('\n}', start)
  return schema.slice(start, end + 2)
}

function mappedColumnNames(body: string): string[] {
  const names: string[] = []
  for (const rawLine of body.split('\n')) {
    const line = rawLine.split('//')[0].trim()
    if (!line || line.startsWith('model ') || line.startsWith('@@') || line.startsWith('}')) continue
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
  const match = sql.match(
    new RegExp(`CREATE TABLE "${table}" \\(\\n([\\s\\S]*?)\\n\\);`),
  )
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

const NEW_MODELS = [
  { model: 'SocialPost', table: 'social_posts' },
  { model: 'SocialPostTemplate', table: 'social_post_templates' },
  { model: 'SocialTelegramBot', table: 'social_telegram_bots' },
]

describe(`${MIGRATION} — social hub tables`, () => {
  it('exists and is additive-only', () => {
    expect(fs.existsSync(SQL_PATH)).toBe(true)
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i)
    expect(sql).not.toMatch(/ALTER\s+COLUMN/i)
    expect(sql).not.toMatch(/^\s*(DELETE|TRUNCATE|UPDATE|INSERT)\b/im)
  })

  it('creates exactly the three social tables', () => {
    const created = [...sql.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((match) => match[1])
    expect(created.sort()).toEqual(
      ['social_posts', 'social_post_templates', 'social_telegram_bots'].sort(),
    )
  })

  for (const { model, table } of NEW_MODELS) {
    describe(model, () => {
      it('has the same columns as the migration, in order', () => {
        expect(sqlCreateTableColumns(table)).toEqual(mappedColumnNames(modelBody(model)))
      })
    })
  }

  it('social_posts requires body/platform/status with the telegram default', () => {
    const columns = sqlCreateTableColumns('social_posts')
    expect(columns).toContain('body')
    expect(columns).toContain('platform')
    expect(columns).toContain('status')
    const tableSql = sql.slice(sql.indexOf('CREATE TABLE "social_posts"'))
    expect(tableSql).toMatch(/"body" TEXT NOT NULL/)
    expect(tableSql).toMatch(/"platform" TEXT NOT NULL DEFAULT 'telegram'/)
    expect(tableSql).toMatch(/"status" TEXT NOT NULL DEFAULT 'draft'/)
    expect(tableSql).toMatch(/"max_attempts" INTEGER NOT NULL DEFAULT 3/)
  })

  it('social_post_templates requires name and body', () => {
    const columns = sqlCreateTableColumns('social_post_templates')
    expect(columns).toContain('name')
    expect(columns).toContain('body')
    expect(columns).toContain('is_default')
    const tableSql = sql.slice(sql.indexOf('CREATE TABLE "social_post_templates"'))
    expect(tableSql).toMatch(/"name" TEXT NOT NULL/)
    expect(tableSql).toMatch(/"body" TEXT NOT NULL/)
    expect(tableSql).toMatch(/"variables" JSONB NOT NULL DEFAULT '\[\]'/)
  })

  it('social_telegram_bots requires label and an encrypted token', () => {
    const columns = sqlCreateTableColumns('social_telegram_bots')
    expect(columns).toContain('label')
    expect(columns).toContain('token_enc')
    const tableSql = sql.slice(sql.indexOf('CREATE TABLE "social_telegram_bots"'))
    expect(tableSql).toMatch(/"label" TEXT NOT NULL/)
    expect(tableSql).toMatch(/"token_enc" TEXT NOT NULL/)
    expect(tableSql).toMatch(/"status" TEXT NOT NULL DEFAULT 'active'/)
  })

  it('social_posts carries the rich-document column additively', () => {
    expect(sql).toMatch(/"rich_document" JSONB/)
    // body يبقى مطلوباً — الوضع الغني إضافة لا بديل
    expect(sql).toMatch(/"body" TEXT NOT NULL/)
  })

  it('social_telegram_bots stores an encrypted token column', () => {
    expect(sql).toMatch(/"token_enc" TEXT NOT NULL/)
  })

  it('links destinations to bots with SET NULL, never CASCADE delete', () => {
    expect(sql).toContain(
      'ALTER TABLE "telegram_destinations" ADD CONSTRAINT "telegram_destinations_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "social_telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
    )
    expect(sql).toContain(
      'ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "telegram_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
    )
    expect(sql).toContain(
      'ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "social_post_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
    )
    expect(sql).not.toMatch(/ON DELETE CASCADE/)
  })

  it('indexes the scheduling query (status, scheduled_for)', () => {
    expect(sql).toContain('CREATE INDEX "social_posts_status_scheduled_for_idx"')
    expect(sql).toContain('CREATE INDEX "social_posts_platform_status_idx"')
  })
})

describe('generated client exposes the social models', () => {
  const clientTypesPath = path.join(ROOT, 'node_modules/.prisma/client/index.d.ts')
  const clientTypes = fs.existsSync(clientTypesPath)
    ? fs.readFileSync(clientTypesPath, 'utf8')
    : ''

  it('defines SocialPost / SocialPostTemplate / SocialTelegramBot', () => {
    expect(clientTypes).toContain('SocialPost')
    expect(clientTypes).toContain('SocialPostTemplate')
    expect(clientTypes).toContain('SocialTelegramBot')
  })

  it('exposes the extended destination fields and rich columns', () => {
    expect(clientTypes).toContain('messageThreadId')
    expect(clientTypes).toContain('richDocument')
    expect(clientTypes).toContain('tokenEnc')
  })
})
