import { type NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun } from '@/lib/cron-ledger'
import { reportError } from '@/lib/error-reporting'

const execAsync = promisify(exec)

const BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), 'backups')
const WEEKLY_DIR = join(BACKUP_DIR, 'weekly')

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
    // Ensure backup directory exists
    if (!existsSync(WEEKLY_DIR)) {
      mkdirSync(WEEKLY_DIR, { recursive: true })
    }

    const dbUrl = process.env.DATABASE_URL || process.env.AIVEN_DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL غير مُكوَّن — لا يمكن إنشاء نسخة احتياطية')
    }

    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
    const filename = `db-${dateStr}.dump`
    const filepath = join(WEEKLY_DIR, filename)

    // Run pg_dump
    await execAsync(
      `pg_dump "$DB_URL" --format=custom --no-owner --no-privileges --schema=public -f "${filepath}"`,
      {
        env: { ...process.env, DB_URL: dbUrl },
        timeout: 300_000, // 5 minutes
      },
    )

    // Compute file size and SHA-256
    const stat = statSync(filepath)
    const fileBuffer = readFileSync(filepath)
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')

    // Create manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      filename,
      size: stat.size,
      sha256,
    }

    const manifestPath = join(WEEKLY_DIR, `${dateStr}-manifest.json`)
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

    // Upload to S3 if configured
    if (process.env.BACKUP_S3_ENDPOINT) {
      try {
        const s3Endpoint = process.env.BACKUP_S3_ENDPOINT
        const s3Bucket = process.env.BACKUP_S3_BUCKET || 'backups'
        const s3AccessKey = process.env.BACKUP_S3_ACCESS_KEY || ''
        const s3SecretKey = process.env.BACKUP_S3_SECRET_KEY || ''

        await execAsync(
          `curl -s -X PUT "${s3Endpoint}/${s3Bucket}/weekly/${filename}" ` +
            `-H "Content-Type: application/octet-stream" ` +
            `--data-binary @"${filepath}" ` +
            `-u "${s3AccessKey}:${s3SecretKey}"`,
          { timeout: 120_000 },
        )
      } catch (uploadErr) {
        console.error('[weekly-backup] فشل الرفع إلى S3:', uploadErr)
        // Continue — local backup succeeded
      }
    }

    if (jobId) await completeRun(jobId)
    return NextResponse.json({ ok: true, manifest })
  } catch (error) {
    console.error('[weekly-backup] فشل النسخ الاحتياطي:', error)
    reportError(error, { route: 'GET /api/cron/weekly-backup', action: 'pg_dump' })
    return NextResponse.json({ error: 'فشل النسخ الاحتياطي' }, { status: 500 })
  }
}
