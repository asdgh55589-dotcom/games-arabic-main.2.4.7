import { execFile } from 'child_process'
import crypto from 'crypto'
import {
  chmodSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { type NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { promisify } from 'util'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun, failRun } from '@/lib/cron-ledger'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

const execFileAsync = promisify(execFile)
const PG_DUMP_BIN = process.env.PG_DUMP_BIN || 'pg_dump'
const PG_RESTORE_BIN = process.env.PG_RESTORE_BIN || 'pg_restore'

const BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), 'backups')
const WEEKLY_DIR = join(BACKUP_DIR, 'weekly')
const RETENTION_COUNT = Number(process.env.BACKUP_RETENTION_COUNT || 4)

function isPooledUrl(url: string): boolean {
  try {
    const host = decodeURIComponent(new URL(url).hostname).replace(/\.$/, '').toLowerCase()
    return host.includes('-pooler')
  } catch {
    return /-pooler/i.test(url)
  }
}

function resolveDirectDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim()
  if (!direct) {
    throw new Error(
      'DIRECT_URL غير مُكوَّن — pg_dump يتطلب اتصالًا مباشرًا (غير مجمّع). أضف DIRECT_URL من Neon Console ثم أعد المحاولة.',
    )
  }
  if (isPooledUrl(direct)) {
    throw new Error(
      'DIRECT_URL يشير إلى نقطة مجمّعة (-pooler). استخدم Connection string المباشر (بدون -pooler) من Neon Console.',
    )
  }
  if (!/^postgres(ql)?:\/\//i.test(direct)) {
    throw new Error('DIRECT_URL يجب أن يكون رابط postgresql:// صالحًا.')
  }
  return direct
}

export function redactSecrets(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]')
    .replace(/(password\s*=\s*)[^\s&;]+/gi, '$1[redacted]')
}

function describeBackupError(error: unknown): string {
  const message = redactSecrets(error instanceof Error ? error.message : String(error))
  if (/pg_dump.*(not found|no such file)|command not found|ENOENT/i.test(message)) {
    return `pg_dump غير متاح. ثبّت PostgreSQL 17 client tools أو استخدم صورة postgres:17 ثم أعد المحاولة. (${message})`
  }
  return message
}

function sha256File(filepath: string): Promise<string> {
  return new Promise((resolveHash, rejectHash) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filepath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolveHash(hash.digest('hex')))
    stream.on('error', rejectHash)
  })
}

function ensureWeeklyDir(): void {
  if (!existsSync(WEEKLY_DIR)) {
    mkdirSync(WEEKLY_DIR, { recursive: true, mode: 0o700 })
  }
  try {
    chmodSync(WEEKLY_DIR, 0o700)
  } catch {
    // Best effort on platforms that do not implement POSIX modes.
  }
}

function pruneWeeklyBackups(): string[] {
  if (!Number.isFinite(RETENTION_COUNT) || RETENTION_COUNT < 1) return []

  const dumps = readdirSync(WEEKLY_DIR)
    .filter((name) => /^db-.+\.dump$/.test(name))
    .map((name) => {
      const path = join(WEEKLY_DIR, name)
      return { name, path, mtime: statSync(path).mtime.getTime() }
    })
    .sort((a, b) => b.mtime - a.mtime)

  const removed: string[] = []
  for (const old of dumps.slice(RETENTION_COUNT)) {
    try {
      unlinkSync(old.path)
      const manifestName = old.name.replace(/\.dump$/, '.manifest.json')
      const manifestPath = join(WEEKLY_DIR, manifestName)
      if (existsSync(manifestPath)) unlinkSync(manifestPath)
      removed.push(old.name)
    } catch (err) {
      logger.warn('[weekly-backup] تعذّر حذف نسخة قديمة:', err)
    }
  }
  return removed
}

interface UploadResult {
  uploaded: boolean
  url?: string
  skipped?: string
  error?: string
}

async function uploadWeeklyBackup(
  filepath: string,
  filename: string,
  manifestPath: string,
  manifestFilename: string,
): Promise<UploadResult> {
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
    const reason = `S3/R2 upload skipped — missing ${missing.join(', ')} (local dump kept)`
    logger.warn(`[weekly-backup] ${reason}`)
    return { uploaded: false, skipped: reason }
  }

  const prefix = process.env.BACKUP_S3_KEY?.trim()
  const objectKey = [prefix, 'weekly', filename].filter(Boolean).join('/').replace(/\/+$/, '')
  const manifestKey = [prefix, 'weekly', manifestFilename]
    .filter(Boolean)
    .join('/')
    .replace(/\/+$/, '')
  const url = `${endpoint.replace(/\/+$/, '')}/${bucket}/${objectKey}`

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
        Key: objectKey,
        Body: createReadStream(filepath),
        ContentLength: statSync(filepath).size,
        ContentType: 'application/octet-stream',
      }),
    )
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: manifestKey,
        Body: createReadStream(manifestPath),
        ContentLength: statSync(manifestPath).size,
        ContentType: 'application/json',
      }),
    )
    logger.info(`[weekly-backup] uploaded to S3/R2: ${url}`)
    return { uploaded: true, url }
  } catch (err) {
    const reason = redactSecrets(err instanceof Error ? err.message : String(err))
    logger.error('[weekly-backup] فشل الرفع إلى S3:', reason)
    return { uploaded: false, error: reason }
  }
}

/**
 * نسخ احتياطي أسبوعي للقاعدة البيانات.
 * يُنفَّذ مرة واحدة أسبوعيًا عبر cron.
 */
export async function GET(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  // ISO week key: YYYY-Www
  const now = new Date()
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil(
    ((now.getTime() - yearStart.getTime()) / 86_400_000 + yearStart.getUTCDay() + 1) / 7,
  )
  const windowKey = `${now.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`

  const claimed = await claimRun('weekly-backup', windowKey)
  if (claimed.alreadyRan) {
    return NextResponse.json({ ok: true, skipped: 'duplicate' })
  }

  const jobId = claimed.jobId

  try {
    ensureWeeklyDir()

    const dbUrl = resolveDirectDatabaseUrl()
    const stamp = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
    const filename = `db-${stamp}.dump`
    const filepath = join(WEEKLY_DIR, filename)
    const partialPath = `${filepath}.partial`
    const manifestFilename = `db-${stamp}.manifest.json`
    const manifestPath = join(WEEKLY_DIR, manifestFilename)
    const manifestPartialPath = `${manifestPath}.partial`

    try {
      // execFile (not a shell) + --file keeps credentials out of the shell and
      // avoids buffering the entire dump in a JS string.
      await execFileAsync(
        PG_DUMP_BIN,
        [
          '--format=custom',
          '--no-owner',
          '--no-privileges',
          '--no-tablespaces',
          '--schema=public',
          `--file=${partialPath}`,
          dbUrl,
        ],
        { timeout: 300_000, maxBuffer: 1024 * 1024 },
      )

      if (!existsSync(partialPath) || statSync(partialPath).size === 0) {
        throw new Error('pg_dump produced an empty file — backup aborted')
      }

      // A dump that pg_restore cannot list is corrupt; never publish it.
      await execFileAsync(PG_RESTORE_BIN, ['-l', partialPath], {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      })

      const sha256 = await sha256File(partialPath)
      const size = statSync(partialPath).size
      chmodSync(partialPath, 0o600)
      renameSync(partialPath, filepath)

      const manifest = {
        timestamp: new Date().toISOString(),
        filename,
        size,
        sha256,
        format: 'pg_dump custom',
        toc_verified: true,
      }
      writeFileSync(manifestPartialPath, JSON.stringify(manifest, null, 2), { mode: 0o600 })
      chmodSync(manifestPartialPath, 0o600)
      renameSync(manifestPartialPath, manifestPath)

      const upload = await uploadWeeklyBackup(filepath, filename, manifestPath, manifestFilename)

      if (upload.error) {
        // Keep the local dump, but do not close the weekly window as successful.
        // Do not prune older backups after a failed upload — local retention
        // must not shrink because the new dump was not safely archived.
        throw new Error(`S3/R2 upload failed: ${upload.error}`)
      }

      const removedOld = pruneWeeklyBackups()

      if (jobId) await completeRun(jobId)
      return NextResponse.json({ ok: true, manifest, upload, removedOld })
    } finally {
      for (const leftover of [partialPath, manifestPartialPath]) {
        try {
          if (existsSync(leftover)) unlinkSync(leftover)
        } catch {
          // Best-effort cleanup only.
        }
      }
    }
  } catch (error) {
    const detail = describeBackupError(error)
    logger.error('[weekly-backup] فشل النسخ الاحتياطي:', detail)
    reportError(new Error(detail), { route: 'GET /api/cron/weekly-backup', action: 'pg_dump' })
    // تحرير النافذة: بلا failRun يبقى الصف running ويحجب كل ticks الأسبوع.
    // (المطالبة التالية تزيح الصف الفاشل وتعيد المحاولة.)
    if (jobId) {
      try {
        await failRun(jobId, new Error(detail))
      } catch {
        // لا نُسقط رد الخطأ الأصلي بسبب فشل السجل
      }
    }
    return NextResponse.json({ error: 'فشل النسخ الاحتياطي', detail }, { status: 500 })
  }
}
