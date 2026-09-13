/**
 * lib/scheduler.ts — خدمة الجدولة والمهام المؤجلة
 *
 * نسخة Phase 7: أُزيل جسيم polling (startScheduler / stopScheduler /
 * processPendingJobs).  المهام الآن تُستدعى مباشرة عبر API routes
 * أو cron external scheduler مع طبقة idempotency (cron-ledger.ts).
 */

import { db } from './db'
import { logger } from './logger'
import { sendToChannel } from './telegram-bot'
import { formatPost, getDefaultTemplate } from './telegram-templates'

/**
 * @deprecated Phase 7 — polling removed. Use API-route-triggered execution
 * with cron-ledger claimRun/completeRun for idempotency.
 */
export function startScheduler(): void {
  logger.warn('[scheduler] startScheduler is deprecated in Phase 7 — no-op')
}

/**
 * @deprecated Phase 7 — polling removed.
 */
export function stopScheduler(): void {
  logger.warn('[scheduler] stopScheduler is deprecated in Phase 7 — no-op')
}

/**
 * تنفيذ مهمة واحدة
 */
export async function executeJob(jobId: string): Promise<void> {
  const job = await db.scheduledJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'pending') return

  // Mark as running
  await db.scheduledJob.update({
    where: { id: jobId },
    data: { status: 'running' },
  })

  try {
    switch (job.type) {
      case 'telegram_post':
        await executeTelegramPost(job)
        break
      case 'notification':
        await executeNotification(job)
        break
      case 'cleanup':
        await executeCleanup(job)
        break
      case 'backup':
        logger.warn(`[scheduler] Backup job ${jobId} is a no-op in Phase 7`)
        break
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }

    // Mark as completed
    await db.scheduledJob.update({
      where: { id: jobId },
      data: { status: 'completed', executedAt: new Date() },
    })

    logger.info(`[scheduler] Job ${jobId} completed successfully`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error(`[scheduler] Job ${jobId} failed: ${errorMsg}`)

    const newRetries = job.retries + 1
    const newStatus = newRetries >= job.maxRetries ? 'failed' : 'pending'

    await db.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: newStatus,
        error: errorMsg,
        retries: newRetries,
        ...(newStatus === 'pending' ? { scheduledAt: new Date(Date.now() + 5 * 60_000) } : {}),
      },
    })
  }
}

/**
 * تنفيذ منشور Telegram
 */
async function executeTelegramPost(job: {
  id: string
  modId: string | null
  payload: any
}): Promise<void> {
  if (!job.modId) throw new Error('No modId for telegram_post job')

  const mod = await db.mod.findUnique({
    where: { id: job.modId },
    include: {
      game: { select: { name: true, platform: true } },
      teamRelation: { select: { name: true } },
      files: {
        select: { links: { select: { url: true }, take: 1 } },
        take: 1,
      },
    },
  })

  if (!mod) throw new Error(`Mod not found: ${job.modId}`)

  const downloadUrl = mod.files[0]?.links[0]?.url || ''
  const postContent = job.payload?.post || (await generatePostContent(mod, downloadUrl))

  const result = await sendToChannel(postContent, mod.thumbnailUrl || undefined)

  if (!result.ok) {
    throw new Error(`Telegram API error: ${result.description}`)
  }

  // Update mod
  await db.mod.update({
    where: { id: job.modId },
    data: {
      scheduledSent: true,
      scheduledSentAt: new Date(),
    },
  })
}

/**
 * تنفيذ إشعار
 */
async function executeNotification(job: { id: string; payload: any }): Promise<void> {
  // Placeholder for notification execution
  logger.info(`[scheduler] Executing notification job ${job.id}`)
}

/**
 * تنفيذ مهمة تنظيف
 */
async function executeCleanup(job: { id: string; payload: any }): Promise<void> {
  // Clean up old files, temp data, etc.
  logger.info(`[scheduler] Executing cleanup job ${job.id}`)
}

/**
 * توليد محتوى المنشور
 */
async function generatePostContent(mod: any, downloadUrl: string): Promise<string> {
  const { content } = formatPost(
    {
      name: mod.name,
      arabicTitle: mod.arabicTitle || undefined,
      version: mod.version,
      description: mod.description || undefined,
      summary: mod.summary || undefined,
      fileSize: mod.fileSize || undefined,
      game: mod.game,
      teamRelation: mod.teamRelation,
      files: [{ downloadUrl }],
    },
    getDefaultTemplate(),
  )
  return content
}

/**
 * إنشاء مهمة جدولة
 */
export async function createScheduledJob(params: {
  type: string
  modId?: string
  scheduledAt: Date
  payload?: Record<string, any>
}): Promise<string> {
  const job = await db.scheduledJob.create({
    data: {
      type: params.type,
      modId: params.modId,
      scheduledAt: params.scheduledAt,
      payload: params.payload || {},
    },
  })
  return job.id
}

/**
 * إلغاء مهمة
 */
export async function cancelScheduledJob(jobId: string): Promise<boolean> {
  const job = await db.scheduledJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'pending') return false

  await db.scheduledJob.update({
    where: { id: jobId },
    data: { status: 'failed', error: 'Cancelled by user' },
  })
  return true
}
