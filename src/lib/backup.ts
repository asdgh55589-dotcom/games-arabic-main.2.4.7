/**
 * lib/backup.ts — خدمة النسخ الاحتياطي التلقائي
 *
 * تدعم النسخ الاحتياطي للقاعدة البيانات والملفات مع سياسة الاحتفاظ.
 */

import { exec } from 'child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { gunzipSync, gzipSync } from 'zlib'
import { db } from './db'

const execAsync = promisify(exec)

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
}

/**
 * Classify a pg_dump stderr into a short reason bucket so operators can
 * tell auth vs connection vs permissions failures at a glance.
 * The full stderr is always propagated alongside the bucket.
 */
export function classifyPgDumpError(stderr: string): 'auth' | 'connection' | 'permissions' | 'unknown' {
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
 * تنفيذ نسخ احتياطي للقاعدة البيانات
 */
export async function createDatabaseBackup(): Promise<BackupInfo> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `db-backup-${timestamp}.sql.gz`
  const filepath = join(BACKUP_DIR, filename)

  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }

  const backup: BackupInfo = {
    id: timestamp,
    filename,
    size: 0,
    type: 'manual',
    status: 'pending',
    createdAt: new Date(),
  }

  try {
    // Use pg_dump for PostgreSQL; NEVER swallow its stderr and NEVER mark
    // a degraded result as 'completed' (SA-3 silent-downgrade trap).
    const dbUrl = process.env.DATABASE_URL
    if (dbUrl && dbUrl.includes('postgresql')) {
      let pgDumpFailed = false
      let pgDumpReason = ''
      try {
        // NOTE: no `2>/dev/null`, no `|| echo` — a pg_dump failure must reject
        // so we can classify the exact stderr below.
        const { stdout } = await execAsync(`pg_dump "${dbUrl}"`)

        if (stdout && stdout.trim().length > 0) {
          const compressed = gzipSync(Buffer.from(stdout, 'utf-8'))
          const { writeFileSync } = await import('fs')
          writeFileSync(filepath, compressed)
          backup.size = compressed.length
          backup.status = 'completed'
          return backup
        }
        pgDumpFailed = true
        pgDumpReason = 'pg_dump returned empty output'
      } catch (pgErr) {
        pgDumpFailed = true
        const stderr =
          (pgErr as { stderr?: unknown }).stderr != null
            ? String((pgErr as { stderr?: unknown }).stderr)
            : pgErr instanceof Error
              ? pgErr.message
              : String(pgErr)
        const bucket = classifyPgDumpError(stderr)
        pgDumpReason = `pg_dump failed (${bucket}): ${stderr}`
      }

      if (pgDumpFailed) {
        // JSON fallback is degraded by definition: data-only, no schema /
        // enums / indexes / pg_trgm / sequences / RLS — pg_dump-only caveat.
        console.warn(`[backup] ${pgDumpReason} — falling back to JSON (partial backup)`)
        await createJsonBackup(filepath)
        const { statSync } = await import('fs')
        backup.size = statSync(filepath).size
        backup.status = 'partial'
        backup.error = pgDumpReason
        return backup
      }
    } else {
      // No usable PostgreSQL URL — JSON fallback is the only option (partial).
      const reason = !dbUrl
        ? 'missing DATABASE_URL — JSON fallback (partial backup)'
        : 'non-postgresql DATABASE_URL — JSON fallback (partial backup)'
      console.warn(`[backup] ${reason}`)
      await createJsonBackup(filepath)
      const { statSync } = await import('fs')
      backup.size = statSync(filepath).size
      backup.status = 'partial'
      backup.error = reason
      return backup
    }
  } catch (err) {
    backup.status = 'failed'
    backup.error = err instanceof Error ? err.message : String(err)
    console.error('[backup] Database backup failed:', err)
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
  const client = db as unknown as Record<string, { findMany: (args?: unknown) => Promise<unknown[]> }>

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

  const { writeFileSync } = await import('fs')
  writeFileSync(filepath, compressed)
}

/**
 * تنظيف النسخ القديمة حسب سياسة الاحتفاظ
 */
export async function cleanupOldBackups(): Promise<number> {
  if (!existsSync(BACKUP_DIR)) return 0

  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('db-backup-'))
    .map((f) => ({
      name: f,
      path: join(BACKUP_DIR, f),
      time: statSync(join(BACKUP_DIR, f)).mtime,
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
function detectBackupStatus(filepath: string): 'completed' | 'partial' {
  try {
    const raw = readFileSync(filepath)
    const head = gunzipSync(raw).subarray(0, 2048).toString('utf-8')
    if (head.includes('"partial":true') || head.includes('"partial": true')) return 'partial'
  } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort backup operation
    }
  return 'completed'
}

export function listBackups(): BackupInfo[] {
  if (!existsSync(BACKUP_DIR)) return []

  return readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('db-backup-'))
    .map((f) => {
      const stat = statSync(join(BACKUP_DIR, f))
      return {
        id: f.replace('db-backup-', '').replace('.sql.gz', ''),
        filename: f,
        size: stat.size,
        type: 'scheduled' as const,
        // pg_dump and JSON-fallback share the .sql.gz name: peek inside.
        // JSON fallback payloads carry "partial":true; anything else (or
        // any read failure on legacy files) stays 'completed'.
        status: detectBackupStatus(join(BACKUP_DIR, f)),
        createdAt: stat.mtime,
      }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * حذف نسخة احتياطية
 */
export function deleteBackup(filename: string): boolean {
  const filepath = join(BACKUP_DIR, filename)
  if (!existsSync(filepath)) return false

  try {
    const { unlinkSync } = require('fs')
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
  if (!existsSync(BACKUP_DIR)) return 0

  return readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('db-backup-'))
    .reduce((total, f) => total + statSync(join(BACKUP_DIR, f)).size, 0)
}
