/**
 * lib/backup.ts — خدمة النسخ الاحتياطي التلقائي
 *
 * تدعم النسخ الاحتياطي للقاعدة البيانات والملفات مع سياسة الاحتفاظ.
 */

import { execFile } from 'child_process'
import { createHash, randomUUID } from 'crypto'
import {
  chmodSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { basename, join, resolve, sep } from 'path'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'
import { createGzip, gunzipSync, gzipSync } from 'zlib'
import { db } from './db'

const execFileAsync = promisify(execFile)
const PG_DUMP_BIN = process.env.PG_DUMP_BIN || 'pg_dump'

const BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), 'backups')
const MAX_DAILY = 7
const MAX_WEEKLY = 4
const MAX_MONTHLY = 12

export interface BackupInfo {
  id: string
  filename: string
  size: number
  type: 'manual' | 'scheduled'
  status: 'pending' | 'completed' | 'partial' | 'failed'
  createdAt: Date
  error?: string
  path?: string
  sha256?: string
  uploaded?: boolean
  remoteUrl?: string
  uploadSkipped?: string
  uploadError?: string
}

/**
 * Classify a pg_dump stderr into a short reason bucket so operators can
 * tell auth vs connection vs permissions failures at a glance.
 * The full stderr is always propagated alongside the bucket.
 */
export function classifyPgDumpError(
  stderr: string,
): 'auth' | 'connection' | 'permissions' | 'unknown' {
  const s = (stderr || '').toLowerCase()
  if (
    s.includes('password authentication failed') ||
    s.includes('authentication failed') ||
    s.includes('no password supplied') ||
    s.includes('fe_sendauth') ||
    (s.includes('role') && s.includes('does not exist'))
  ) {
    return 'auth'
  }
  if (s.includes('permission denied')) {
    return 'permissions'
  }
  if (
    s.includes('could not connect') ||
    s.includes('connection refused') ||
    s.includes('connection timed out') ||
    s.includes('could not translate host') ||
    s.includes('no such host') ||
    s.includes('server closed the connection') ||
    s.includes('timeout expired') ||
    s.includes('network is unreachable')
  ) {
    return 'connection'
  }
  return 'unknown'
}

/**
 * Neon/PgBouncer pooled hosts contain `-pooler`. pg_dump needs a direct
 * session endpoint, so pooled URLs must never be used for backups.
 */
export function isPooledDatabaseUrl(url: string): boolean {
  try {
    const host = decodeURIComponent(new URL(url).hostname).replace(/\.$/, '').toLowerCase()
    return host.includes('-pooler')
  } catch {
    return /-pooler/i.test(url)
  }
}

/**
 * Resolve the direct (non-pooled) URL used by pg_dump.
 * Prefers DIRECT_URL; falls back to DATABASE_URL only when it is non-pooled.
 */
export function resolveBackupDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const direct = env.DIRECT_URL?.trim()
  const fallback = env.DATABASE_URL?.trim()
  const candidate = direct || fallback

  if (!candidate) {
    throw new Error(
      'No direct PostgreSQL URL configured for backups: set DIRECT_URL (preferred) or a non-pooled DATABASE_URL.',
    )
  }
  if (isPooledDatabaseUrl(candidate)) {
    throw new Error(
      `${direct ? 'DIRECT_URL' : 'DATABASE_URL'} points at a pooled endpoint (-pooler). pg_dump requires a direct connection: set DIRECT_URL to the non-pooled connection string.`,
    )
  }
  if (!/^postgres(ql)?:\/\//i.test(candidate)) {
    throw new Error('DIRECT_URL/DATABASE_URL must be a postgresql:// URL for pg_dump.')
  }
  return candidate
}

async function sha256File(filepath: string): Promise<string> {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filepath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolveHash(hash.digest('hex')))
    stream.on('error', rejectHash)
  })
}

function ensureBackupDir(): void {
  if (!existsSync(/*turbopackIgnore: true*/ BACKUP_DIR)) {
    mkdirSync(/*turbopackIgnore: true*/ BACKUP_DIR, { recursive: true, mode: 0o700 })
  }
  try {
    chmodSync(/*turbopackIgnore: true*/ BACKUP_DIR, 0o700)
  } catch {
    // Best effort on platforms that do not implement POSIX modes.
  }
}

function isPgDumpMissing(stderr: string, code?: number | string): boolean {
  return (
    code === 127 || code === 'ENOENT' || /(pg_dump|command).*(not found|no such file)/i.test(stderr)
  )
}

interface UploadResult {
  uploaded: boolean
  url?: string
  skipped?: string
  error?: string
}

async function uploadBackupToS3(filepath: string, filename: string): Promise<UploadResult> {
  const endpoint = process.env.BACKUP_S3_ENDPOINT?.trim()
  const bucket = process.env.BACKUP_S3_BUCKET?.trim() || (endpoint ? 'backups' : '')
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY?.trim()
  const secretAccessKey = process.env.BACKUP_S3_SECRET_KEY?.trim()

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    const missing = [
      !endpoint ? 'BACKUP_S3_ENDPOINT' : '',
      !bucket ? 'BACKUP_S3_BUCKET' : '',
      !accessKeyId ? 'BACKUP_S3_ACCESS_KEY' : '',
      !secretAccessKey ? 'BACKUP_S3_SECRET_KEY' : '',
    ].filter(Boolean)
    const reason = `S3/R2 upload skipped — missing ${missing.join(', ')} (local dump kept at ${filepath})`
    console.warn(`[backup] ${reason}`)
    return { uploaded: false, skipped: reason }
  }

  const prefix = process.env.BACKUP_S3_KEY?.trim()
  const key = prefix ? `${prefix.replace(/\/+$/, '')}/${filename}` : filename
  const url = `${endpoint.replace(/\/+$/, '')}/${bucket}/${key}`

  try {
    const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
      region: process.env.BACKUP_S3_REGION?.trim() || 'auto',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    })
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(filepath),
        ContentLength: statSync(filepath).size,
        ContentType: 'application/octet-stream',
      }),
    )
    console.log(`[backup] Uploaded to S3/R2: ${url}`)
    return { uploaded: true, url }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[backup] S3/R2 upload failed (local dump kept at ${filepath}): ${reason}`)
    return { uploaded: false, error: reason }
  }
}

/**
 * تنفيذ نسخ احتياطي للقاعدة البيانات
 */
export async function createDatabaseBackup(): Promise<BackupInfo> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `db-backup-${timestamp}.sql.gz`
  const filepath = join(BACKUP_DIR, filename)
  const tmpSql = join(BACKUP_DIR, `.pgdump-${process.pid}-${randomUUID()}.sql`)
  const partial = `${filepath}.partial`

  ensureBackupDir()

  const backup: BackupInfo = {
    id: timestamp,
    filename,
    size: 0,
    type: 'manual',
    status: 'pending',
    createdAt: new Date(),
  }

  try {
    let dbUrl: string
    try {
      dbUrl = resolveBackupDatabaseUrl()
    } catch (urlErr) {
      backup.status = 'failed'
      backup.error = urlErr instanceof Error ? urlErr.message : String(urlErr)
      console.error('[backup] Database backup failed:', backup.error)
      return backup
    }

    let pgDumpReason = ''
    try {
      // execFile (not a shell) + --file keeps credentials out of the shell and
      // avoids buffering the entire dump in a JS string.
      await execFileAsync(
        PG_DUMP_BIN,
        [
          dbUrl,
          '--format=plain',
          '--no-owner',
          '--no-privileges',
          '--no-tablespaces',
          '--schema=public',
          `--file=${tmpSql}`,
        ],
        { timeout: 300_000, maxBuffer: 1024 * 1024 },
      )

      if (!existsSync(tmpSql) || statSync(tmpSql).size === 0) {
        pgDumpReason = 'pg_dump produced an empty file'
      } else {
        await pipeline(createReadStream(tmpSql), createGzip(), createWriteStream(partial))
        chmodSync(partial, 0o600)
        renameSync(partial, filepath)
        backup.size = statSync(filepath).size
        backup.path = filepath
        backup.sha256 = await sha256File(filepath)
        backup.status = 'completed'

        const upload = await uploadBackupToS3(filepath, filename)
        backup.uploaded = upload.uploaded
        backup.remoteUrl = upload.url
        backup.uploadSkipped = upload.skipped
        backup.uploadError = upload.error
        return backup
      }
    } catch (pgErr) {
      const stderr =
        (pgErr as { stderr?: unknown }).stderr != null
          ? String((pgErr as { stderr?: unknown }).stderr)
          : pgErr instanceof Error
            ? pgErr.message
            : String(pgErr)
      const rawCode = (pgErr as { code?: unknown }).code
      const code = typeof rawCode === 'number' || typeof rawCode === 'string' ? rawCode : undefined
      if (isPgDumpMissing(stderr, code)) {
        backup.status = 'failed'
        backup.error = `pg_dump is not available (${stderr || 'not found'}). Install PostgreSQL 17 client tools or run inside the postgres:17 image, then retry.`
        console.error(`[backup] ${backup.error}`)
        return backup
      }
      const bucket = classifyPgDumpError(stderr)
      pgDumpReason = `pg_dump failed (${bucket}): ${stderr}`
    }

    // JSON fallback is degraded by definition: data-only, no schema /
    // enums / indexes / pg_trgm / sequences / RLS — pg_dump-only caveat.
    console.warn(`[backup] ${pgDumpReason} — falling back to JSON (partial backup)`)
    await createJsonBackup(filepath)
    chmodSync(filepath, 0o600)
    backup.size = statSync(filepath).size
    backup.path = filepath
    backup.sha256 = await sha256File(filepath)
    backup.status = 'partial'
    backup.error = pgDumpReason
    console.warn(
      `[backup] Partial JSON backup kept at ${filepath}; S3/R2 upload skipped because it is not a full pg_dump.`,
    )
    return backup
  } catch (err) {
    backup.status = 'failed'
    backup.error = err instanceof Error ? err.message : String(err)
    console.error('[backup] Database backup failed:', err)
  } finally {
    for (const leftover of [tmpSql, partial]) {
      try {
        if (existsSync(leftover)) unlinkSync(leftover)
      } catch {
        // Best-effort cleanup only.
      }
    }
  }

  return backup
}

/**
 * نسخ احتياطي بصيغة JSON (fallback — PARTIAL only)
 *
 * CHOICE: full-cover (not remove). The JSON fallback is kept because
 * environments without pg_dump still need *something*, but it is now
 * explicitly degraded: status 'partial', never 'completed'.
 *
 * Coverage: ALL Prisma models (before: only 5 — mods, users, games,
 * teams, series). Data-only dump: schema, enums, indexes, pg_trgm
 * extensions, sequences, and RLS policies are pg_dump-only and are NOT
 * captured here — restore requires a matching `prisma migrate deploy`.
 *
 * Prisma delegate keys = model name with first letter lowercased
 * (e.g. OAuthAccount → oAuthAccount, UTMTracking → uTMTracking).
 */
export const JSON_BACKUP_DELEGATES = [
  'user',
  'creatorRequest',
  'oAuthAccount',
  'apiKey',
  'follow',
  'game',
  'category',
  'mod',
  'workflowEntry',
  'modVersion',
  'endorsement',
  'modFile',
  'modFileLink',
  'modVideoGroup',
  'modVideo',
  'modTeamMember',
  'modContactLink',
  'modCustomTab',
  'series',
  'team',
  'teamFollow',
  'teamMembership',
  'teamContactLink',
  'teamCustomTab',
  'userAction',
  'tierRule',
  'tierHistory',
  'specialRole',
  'news',
  'newsView',
  'newsClick',
  'modComment',
  'modRequest',
  'auditLog',
  'siteSetting',
  'homepageAd',
  'adClick',
  'notification',
  'notificationPreference',
  'notificationLog',
  'notificationJob',
  'notificationTemplate',
  'ipBan',
  'userTrustScore',
  'report',
  'reportFraudSignal',
  'reportStatusHistory',
  'bookmark',
  'commentLike',
  'section',
  'downloadClick',
  'modView',
  'commentSectionClick',
  'scheduledJob',
  'modRating',
  'ticket',
  'ticketMessage',
  'ticketTag',
  'achievement',
  'teamAchievement',
  'teamPoints',
  'pointsTransaction',
  'savedSearch',
  'searchClick',
  'platformView',
  'uTMTracking',
  'brokenImage',
  'imageHealthLog',
  'session',
  'uploadAsset',
  'quotaPolicy',
  'quotaOverride',
  'uploadUsageDaily',
  'creatorStorage',
  'passwordResetToken',
] as const

async function createJsonBackup(filepath: string): Promise<void> {
  const client = db as unknown as Record<
    string,
    { findMany: (args?: unknown) => Promise<unknown[]> }
  >

  // users: keep the pre-existing field allowlist (excludes deprecated
  // password hash) to avoid leaking credentials into the JSON artifact.
  const results = await Promise.all(
    JSON_BACKUP_DELEGATES.map((delegate) => {
      const table = client[delegate]
      if (!table || typeof table.findMany !== 'function') {
        throw new Error(`[backup] JSON fallback: missing Prisma delegate '${delegate}'`)
      }
      if (delegate === 'user') {
        return table.findMany({
          select: { id: true, username: true, email: true, role: true, joinedAt: true },
        })
      }
      return table.findMany()
    }),
  )

  const tables: Record<string, number> = {}
  const data: Record<string, unknown[]> = {}
  JSON_BACKUP_DELEGATES.forEach((delegate, i) => {
    const rows = (results[i] ?? []) as unknown[]
    tables[delegate] = rows.length
    data[delegate] = rows
  })

  const payload = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    partial: true,
    caveat:
      'JSON fallback is data-only (partial). Schema, enums, indexes, pg_trgm, sequences, and RLS require pg_dump. Restore to a DB prepared with `prisma migrate deploy`.',
    tables,
    data,
    // Back-compat aliases for the pre-SA-3 5-table shape:
    // data.mods ← data.mod, data.users ← data.user, etc.
    legacyAliases: { mods: 'mod', users: 'user', games: 'game', teams: 'team', series: 'series' },
  }

  const json = JSON.stringify(payload, null, 2)
  const compressed = gzipSync(Buffer.from(json, 'utf-8'))
  const partial = `${filepath}.json.partial`

  try {
    writeFileSync(partial, compressed, { mode: 0o600 })
    chmodSync(partial, 0o600)
    renameSync(partial, filepath)
  } finally {
    try {
      if (existsSync(partial)) unlinkSync(partial)
    } catch {
      // Best-effort cleanup only.
    }
  }
}

/**
 * تنظيف النسخ القديمة حسب سياسة الاحتفاظ
 */
export async function cleanupOldBackups(): Promise<number> {
  if (!existsSync(/*turbopackIgnore: true*/ BACKUP_DIR)) return 0

  const files = readdirSync(/*turbopackIgnore: true*/ BACKUP_DIR)
    .filter((f) => f.startsWith('db-backup-'))
    .map((f) => ({
      name: f,
      path: join(/*turbopackIgnore: true*/ BACKUP_DIR, f),
      time: statSync(join(/*turbopackIgnore: true*/ BACKUP_DIR, f)).mtime,
    }))
    .sort((a, b) => b.time.getTime() - a.time.getTime())

  let deleted = 0
  const now = new Date()

  // Keep last MAX_DAILY daily backups
  const dailyCutoff = new Date(now.getTime() - MAX_DAILY * 24 * 60 * 60 * 1000)
  // Keep last MAX_WEEKLY weekly backups
  const weeklyCutoff = new Date(now.getTime() - MAX_WEEKLY * 7 * 24 * 60 * 60 * 1000)
  // Keep last MAX_MONTHLY monthly backups
  const monthlyCutoff = new Date(now.getTime() - MAX_MONTHLY * 30 * 24 * 60 * 60 * 1000)

  for (const file of files) {
    const shouldDelete =
      file.time < monthlyCutoff ||
      (file.time < weeklyCutoff && files.indexOf(file) > MAX_WEEKLY) ||
      (file.time < dailyCutoff && files.indexOf(file) > MAX_DAILY)

    if (shouldDelete) {
      try {
        unlinkSync(file.path)
        deleted++
      } catch (err) {
        console.error(`[backup] Failed to delete ${file.name}:`, err)
      }
    }
  }

  return deleted
}

/**
 * قائمة النسخ الاحتياطية المتاحة
 *
 * Derives listing status from the artifact itself so JSON-fallback
 * (partial) files are never relabeled 'completed' in the UI.
 */
function detectBackupStatus(filepath: string): 'completed' | 'partial' | 'failed' {
  try {
    const raw = readFileSync(filepath)
    const head = gunzipSync(raw).subarray(0, 2048).toString('utf-8')
    if (head.includes('"partial":true') || head.includes('"partial": true')) return 'partial'
  } catch {
    return 'failed'
  }
  return 'completed'
}

export function listBackups(): BackupInfo[] {
  if (!existsSync(/*turbopackIgnore: true*/ BACKUP_DIR)) return []

  return readdirSync(/*turbopackIgnore: true*/ BACKUP_DIR)
    .filter((f) => f.startsWith('db-backup-'))
    .map((f) => {
      const stat = statSync(join(/*turbopackIgnore: true*/ BACKUP_DIR, f))
      return {
        id: f.replace('db-backup-', '').replace('.sql.gz', ''),
        filename: f,
        size: stat.size,
        type: 'scheduled' as const,
        // pg_dump and JSON-fallback share the .sql.gz name: peek inside.
        // JSON fallback payloads carry "partial":true; a corrupt/unreadable
        // artifact is 'failed', never silently 'completed'.
        status: detectBackupStatus(join(/*turbopackIgnore: true*/ BACKUP_DIR, f)),
        createdAt: stat.mtime,
      }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * حذف نسخة احتياطية
 */
export function deleteBackup(filename: string): boolean {
  // Accept only a bare backup filename; never a path, traversal, or arbitrary file.
  if (
    !filename ||
    basename(filename) !== filename ||
    !filename.startsWith('db-backup-') ||
    filename.includes('..')
  ) {
    return false
  }

  const root = resolve(/*turbopackIgnore: true*/ BACKUP_DIR)
  const filepath = resolve(root, filename)
  if (!filepath.startsWith(root + sep) || !existsSync(/*turbopackIgnore: true*/ filepath)) {
    return false
  }

  try {
    unlinkSync(filepath)
    return true
  } catch {
    return false
  }
}

/**
 * حجم النسخ الاحتياطية الكلي
 */
export function getTotalBackupSize(): number {
  if (!existsSync(/*turbopackIgnore: true*/ BACKUP_DIR)) return 0

  return readdirSync(/*turbopackIgnore: true*/ BACKUP_DIR)
    .filter((f) => f.startsWith('db-backup-'))
    .reduce((total, f) => total + statSync(join(/*turbopackIgnore: true*/ BACKUP_DIR, f)).size, 0)
}
