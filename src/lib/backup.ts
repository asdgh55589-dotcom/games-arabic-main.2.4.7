/**
 * lib/backup.ts — خدمة النسخ الاحتياطي التلقائي
 *
 * تدعم النسخ الاحتياطي للقاعدة البيانات والملفات مع سياسة الاحتفاظ.
 */

import { db } from './db'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

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
  status: 'pending' | 'completed' | 'failed'
  createdAt: Date
  error?: string
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
    // Use pg_dump if available, otherwise use Prisma
    const dbUrl = process.env.DATABASE_URL
    if (dbUrl && dbUrl.includes('postgresql')) {
      // PostgreSQL dump
      const { stdout } = await execAsync(
        `pg_dump "${dbUrl}" 2>/dev/null || echo "pg_dump not available"`
      )

      if (stdout && !stdout.includes('not available')) {
        const compressed = gzipSync(Buffer.from(stdout, 'utf-8'))
        const { writeFileSync } = await import('fs')
        writeFileSync(filepath, compressed)
        backup.size = compressed.length
        backup.status = 'completed'
      } else {
        // Fallback: export key tables as JSON
        await createJsonBackup(filepath)
        const { statSync } = await import('fs')
        backup.size = statSync(filepath).size
        backup.status = 'completed'
      }
    } else {
      // Fallback: JSON backup
      await createJsonBackup(filepath)
      const { statSync } = await import('fs')
      backup.size = statSync(filepath).size
      backup.status = 'completed'
    }
  } catch (err) {
    backup.status = 'failed'
    backup.error = err instanceof Error ? err.message : String(err)
    console.error('[backup] Database backup failed:', err)
  }

  return backup
}

/**
 * نسخ احتياطي بصيغة JSON (fallback)
 */
async function createJsonBackup(filepath: string): Promise<void> {
  const [mods, users, games, teams, series] = await Promise.all([
    db.mod.findMany({ include: { game: true, teamRelation: true } }),
    db.user.findMany({ select: { id: true, username: true, email: true, role: true, joinedAt: true } }),
    db.game.findMany(),
    db.team.findMany(),
    db.series.findMany(),
  ])

  const data = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    tables: {
      mods: mods.length,
      users: users.length,
      games: games.length,
      teams: teams.length,
      series: series.length,
    },
    data: { mods, users, games, teams, series },
  }

  const json = JSON.stringify(data, null, 2)
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
      (file.time < monthlyCutoff) ||
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
 */
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
        status: 'completed' as const,
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
