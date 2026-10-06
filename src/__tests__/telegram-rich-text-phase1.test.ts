/**
 * Telegram Rich-Text Phase 1 — persistence, versions, destinations.
 *
 * يقفل:
 *  1) امتدادات schema.prisma (NotificationTemplate/NotificationJob + ثلاث جداول جديدة).
 *  2) ملف migration إضافي فقط (additive-only) ومتطابق عموداً بعمود مع schema.
 *  3) العميل المولَّد يعرّف النماذج الجديدة.
 *  4) سكربت ترحيل legacy يعمل DRY-RUN فقط (لا Prisma، لا كتابة، لا seed).
 *
 * لا يُشغَّل هنا أي migrate deploy ولا أي إرسال.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  assessEligibility,
  buildReport,
  collectLegacySources,
  DRY_RUN_WRITE_FLAGS,
  eligibleNotificationTypes,
  extractTemplateVariables,
  TELEGRAM_MESSAGE_LIMIT,
} from '../../scripts/migrate-legacy-templates'

const ROOT = path.resolve(__dirname, '..', '..')
const MIGRATION = '20261006000000_telegram_rich_text_phase1'
const SQL_PATH = path.join(ROOT, 'prisma/migrations', MIGRATION, 'migration.sql')
const SCHEMA_PATH = path.join(ROOT, 'prisma/schema.prisma')

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
const sql = fs.existsSync(SQL_PATH) ? fs.readFileSync(SQL_PATH, 'utf8') : ''

interface Column {
  field: string
  column: string
  type: string
  nullable: boolean
  default: string | null
}

function modelBody(name: string): string {
  const start = schema.indexOf(`model ${name} {`)
  if (start < 0) throw new Error(`model ${name} not found in schema.prisma`)
  const end = schema.indexOf('\n}', start)
  return schema.slice(start, end + 2)
}

function prismaDefaultToSql(raw: string): string | null {
  if (raw === 'now()') return 'CURRENT_TIMESTAMP'
  const literalString = raw.match(/^"(.*)"$/)
  if (literalString) return `'${literalString[1]}'`
  if (/^(true|false|\d+)$/.test(raw)) return raw
  // cuid()/uuid()/client-side defaults ⇒ لا يوجد DEFAULT في قاعدة البيانات
  return null
}

function parseSchemaColumns(body: string): Column[] {
  const columns: Column[] = []
  for (const rawLine of body.split('\n')) {
    const line = rawLine.split('//')[0].trim()
    if (!line || line.startsWith('model ') || line.startsWith('@@') || line.startsWith('}'))
      continue
    const field = line.match(/^(\w+)\s+(\w+)(\??)(\[\])?/)
    if (!field) continue
    const [, name, typeName, optional, listMarker] = field
    // حقول العلاقات (Model[] أو Model @relation) ليست أعمدة في جدول قاعدة البيانات
    if (listMarker || !(typeName in PRISMA_TO_SQL_TYPE)) continue
    const mapMatch = line.match(/@map\("([^"]+)"\)/)
    const defaultMatch = line.match(/@default\(([^)]*\)?[^)]*)\)/)
    let defaultValue: string | null = null
    if (defaultMatch) {
      // @default(now()) يحتوي قوسين — أعد الالتقاط بشكل صحيح
      const balanced = line.match(/@default\((now\(\)|cuid\(\)|uuid\(\)|"[^"]*"|\d+|true|false)\)/)
      defaultValue = balanced ? prismaDefaultToSql(balanced[1]) : null
    }
    columns.push({
      field: name,
      column: mapMatch ? mapMatch[1] : name,
      type: typeName,
      nullable: Boolean(optional),
      default: defaultValue,
    })
  }
  return columns
}

const PRISMA_TO_SQL_TYPE: Record<string, string> = {
  String: 'TEXT',
  Int: 'INTEGER',
  Boolean: 'BOOLEAN',
  DateTime: 'TIMESTAMP(3)',
  Json: 'JSONB',
  Float: 'DOUBLE PRECISION',
  BigInt: 'BIGINT',
}

interface SqlColumn {
  name: string
  type: string
  nullable: boolean
  default: string | null
}

function parseSqlCreateTable(table: string): SqlColumn[] {
  const match = sql.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS "${table}" \\(\\n([\\s\\S]*?)\\n\\);`),
  )
  if (!match) throw new Error(`CREATE TABLE "${table}" not found in ${MIGRATION}`)
  const columns: SqlColumn[] = []
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('CONSTRAINT')) continue
    const col = line.match(/^"([^"]+)"\s+([A-Z0-9() ]+?)(?:\s+NOT NULL)?(?:\s+DEFAULT\s+(.+?))?,?$/)
    if (!col) throw new Error(`unparsed SQL column line: ${line}`)
    columns.push({
      name: col[1],
      type: col[2].trim(),
      nullable: !line.includes('NOT NULL'),
      default: col[3] ? col[3].replace(/,$/, '') : null,
    })
  }
  return columns
}

function parseSqlAlterColumns(table: string): SqlColumn[] {
  const pattern = new RegExp(
    `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "([^"]+)" ([A-Z0-9() ]+?)( DEFAULT (.+?))?;`,
    'g',
  )
  const columns: SqlColumn[] = []
  for (const match of sql.matchAll(pattern)) {
    columns.push({
      name: match[1],
      type: match[2].trim(),
      nullable: true,
      default: match[4] ?? null,
    })
  }
  return columns
}

function indexStatements(body: string): Array<{ unique: boolean; columns: string[] }> {
  const statements: Array<{ unique: boolean; columns: string[] }> = []
  for (const match of body.matchAll(/@@(unique|index)\(\[([^\]]+)\]\)/g)) {
    statements.push({
      unique: match[1] === 'unique',
      columns: match[2].split(',').map((part) => part.trim()),
    })
  }
  return statements
}

function expectedIndexSql(
  table: string,
  index: { unique: boolean; columns: string[] },
  columns: Column[],
): string {
  const mapped = index.columns.map((field) => {
    const column = columns.find((entry) => entry.field === field)
    if (!column) throw new Error(`unknown index field ${field} on ${table}`)
    return column.column
  })
  const name = `${table}_${mapped.join('_')}_${index.unique ? 'key' : 'idx'}`
  const kind = index.unique ? 'UNIQUE INDEX' : 'INDEX'
  return `CREATE ${kind} IF NOT EXISTS "${name}" ON "${table}"("${mapped.join('", "')}")`
}

const NEW_TABLES = [
  'notification_template_versions',
  'telegram_destinations',
  'notification_batches',
]
const NEW_MODELS: Array<{ model: string; table: string }> = [
  { model: 'NotificationTemplateVersion', table: 'notification_template_versions' },
  { model: 'TelegramDestination', table: 'telegram_destinations' },
  { model: 'NotificationBatch', table: 'notification_batches' },
]

describe(`${MIGRATION} — additive-only`, () => {
  it('exists', () => {
    expect(fs.existsSync(SQL_PATH)).toBe(true)
  })

  it('never drops or rewrites anything (incl. the six _trgm GIN indexes)', () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i)
    expect(sql).not.toMatch(/ALTER\s+COLUMN/i)
    expect(sql).not.toMatch(/_trgm/i)
    expect(sql).not.toMatch(/^\s*(DELETE|TRUNCATE|UPDATE|INSERT)\b/im)
  })

  it('only touches the four notification tables + three new ones', () => {
    const touched = [...sql.matchAll(/(?:TABLE|TABLE IF NOT EXISTS) "([a-z_]+)"/g)].map(
      (match) => match[1],
    )
    expect([...new Set(touched)].sort()).toEqual(
      [
        'notification_batches',
        'notification_jobs',
        'notification_template_versions',
        'notification_templates',
        'telegram_destinations',
      ].sort(),
    )
  })
})

describe('schema extensions — NotificationTemplate / NotificationJob', () => {
  it('NotificationTemplate gains rich-text columns (legacy columns untouched)', () => {
    const body = modelBody('NotificationTemplate')
    const columns = parseSchemaColumns(body)
    const byField = new Map(columns.map((column) => [column.field, column]))
    expect(byField.get('parseMode')).toMatchObject({ column: 'parseMode', nullable: true })
    expect(byField.get('richBodyTemplate')).toMatchObject({
      column: 'richBodyTemplate',
      nullable: true,
    })
    // النصوص القديمة تبقى كما هي تماماً
    expect(byField.get('bodyTemplate')).toMatchObject({ column: 'bodyTemplate', nullable: false })
    expect(byField.get('titleTemplate')).toMatchObject({ column: 'titleTemplate', nullable: false })

    expect(sql).toContain('ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS')
    expect(sql).toContain('"parseMode" TEXT;')
    expect(sql).toContain('"richBodyTemplate" TEXT;')
  })

  it('NotificationJob gains destination / parse mode / batch links', () => {
    const body = modelBody('NotificationJob')
    const columns = parseSchemaColumns(body)
    const byField = new Map(columns.map((column) => [column.field, column]))
    expect(byField.get('destinationId')).toMatchObject({ column: 'destination_id', nullable: true })
    expect(byField.get('parseMode')).toMatchObject({ column: 'parse_mode', nullable: true })
    expect(byField.get('batchId')).toMatchObject({ column: 'batch_id', nullable: true })

    for (const statement of [
      'ALTER TABLE "notification_jobs" ADD COLUMN IF NOT EXISTS "destination_id" TEXT;',
      'ALTER TABLE "notification_jobs" ADD COLUMN IF NOT EXISTS "parse_mode" TEXT;',
      'ALTER TABLE "notification_jobs" ADD COLUMN IF NOT EXISTS "batch_id" TEXT;',
      'CREATE INDEX IF NOT EXISTS "notification_jobs_destination_id_idx" ON "notification_jobs"("destination_id")',
      'CREATE INDEX IF NOT EXISTS "notification_jobs_batch_id_idx" ON "notification_jobs"("batch_id")',
    ]) {
      expect(sql).toContain(statement)
    }
  })

  it('declares the three foreign keys with the expected delete rules', () => {
    expect(sql).toContain(
      'ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "telegram_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
    )
    expect(sql).toContain(
      'ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "notification_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
    )
    expect(sql).toContain(
      'ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    )
  })
})

describe('schema ↔ migration parity — new tables', () => {
  for (const { model, table } of NEW_MODELS) {
    describe(model, () => {
      const body = modelBody(model)
      const schemaColumns = parseSchemaColumns(body)
      const sqlColumns = parseSqlCreateTable(table)

      it('has exactly the schema columns, with matching type/nullability/default', () => {
        expect(sqlColumns.map((column) => column.name)).toEqual(
          schemaColumns.map((column) => column.column),
        )
        for (const column of schemaColumns) {
          const actual = sqlColumns.find((entry) => entry.name === column.column)
          expect(actual).toBeDefined()
          expect(actual?.type).toBe(PRISMA_TO_SQL_TYPE[column.type])
          expect(actual?.nullable).toBe(column.nullable)
          if (column.default !== null) expect(actual?.default).toBe(column.default)
          else expect(actual?.default).toBeNull()
        }
      })

      it('creates every @@index / @@unique with the Prisma-computed name', () => {
        for (const index of indexStatements(body)) {
          expect(sql).toContain(expectedIndexSql(table, index, schemaColumns))
        }
      })
    })
  }
})

describe('generated client exposes the new models', () => {
  const clientTypesPath = path.join(ROOT, 'node_modules/.prisma/client/index.d.ts')
  const clientTypes = fs.existsSync(clientTypesPath) ? fs.readFileSync(clientTypesPath, 'utf8') : ''

  it('has NotificationTemplateVersion / TelegramDestination / NotificationBatch', () => {
    expect(clientTypes).toContain('NotificationTemplateVersion')
    expect(clientTypes).toContain('TelegramDestination')
    expect(clientTypes).toContain('NotificationBatch')
  })

  it('exposes the extended fields', () => {
    expect(clientTypes).toContain('richBodyTemplate')
    expect(clientTypes).toContain('destinationId')
    expect(clientTypes).toContain('verificationStatus')
  })
})

describe('scripts/migrate-legacy-templates.ts — DRY-RUN ONLY', () => {
  const scriptPath = path.join(ROOT, 'scripts/migrate-legacy-templates.ts')
  const source = fs.readFileSync(scriptPath, 'utf8')

  it('never imports Prisma or a database client', () => {
    expect(source).not.toMatch(/@prisma\/client/)
    expect(source).not.toMatch(/from ['"]@\/lib\/db['"]/)
    expect(source).not.toMatch(/PrismaClient/)
  })

  it('performs no writes and refuses every write/seed flag', () => {
    expect(source).not.toMatch(/\.(create|createMany|update|upsert|delete|executeRaw)\(/)
    expect(source).toContain('DRY-RUN ONLY')
    for (const flag of ['--apply', '--write', '--seed', '--migrate']) {
      expect([...DRY_RUN_WRITE_FLAGS]).toContain(flag)
    }
  })

  it('reads legacy sources read-only and marks security messages ineligible', () => {
    const sources = collectLegacySources()
    const rows = assessEligibility(sources)
    expect(sources.length).toBeGreaterThanOrEqual(10)

    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('default_post_template')?.eligible).toBe(true)

    const securityIds = sources
      .filter((source) => source.kind === 'account_security_message')
      .map((source) => source.id)
    expect(securityIds).toContain('welcome_message')
    expect(securityIds).toContain('new_login_alert')
    for (const id of securityIds) {
      expect(byId.get(id)?.eligible).toBe(false)
      expect(byId.get(id)?.reasons).toContain('security_hardcoded_untouched')
      expect(byId.get(id)?.target).toBeNull()
    }

    // لا شيء يتجاوز حد تليجرام
    for (const source of sources)
      expect(source.content.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT)
  })

  it('extracts variables from both legacy {var} and Handlebars {{var}}', () => {
    expect(extractTemplateVariables('hello {game_name} and {{actorName}}')).toEqual([
      'actorName',
      'game_name',
    ])
    expect(extractTemplateVariables('no vars')).toEqual([])
  })

  it('reports ALL notification types as eligible (no allowlist)', () => {
    const types = eligibleNotificationTypes()
    expect(types.length).toBeGreaterThanOrEqual(20)
    expect(types).toContain('mod_published')
    expect(types).toContain('comment_reply')
    expect(types).toContain('system_alert')
    expect(types).toEqual([...types].sort())
  })

  it('prints a report that seeds nothing', () => {
    const sources = collectLegacySources()
    const report = buildReport(sources, assessEligibility(sources))
    expect(report).toContain('DRY-RUN ONLY')
    expect(report).toContain('0 rows written')
    expect(report).toContain('NOTHING was seeded')
    expect(report).toContain('SUMMARY:')
    expect(report).toContain('written=0')
    expect(report).toContain('all types eligible')
    expect(report).toContain('manager-only broadcast unchanged')
    expect(report).toContain('security HARDCODED untouched')
  })
})
