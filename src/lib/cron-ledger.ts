/**
 * lib/cron-ledger.ts — Idempotency layer for cron jobs
 *
 * Prevents duplicate runs using a window key written on the claimed row.
 * Every call goes through the DB so concurrent invocations are safe via
 * the unique constraint on (type, windowKey) — the windowKey is always
 * persisted, and a completed OR in-progress row for the same window is
 * treated as a duplicate.
 */

import { db } from './db'

export interface ClaimResult {
  alreadyRan: boolean
  jobId: string | null
}

/**
 * Attempt to claim a run for the given job type + window key.
 * Returns { alreadyRan: true } when a completed OR an in-progress
 * (pending/running) row already exists for THIS window — concurrent ticks
 * in the same window are duplicates, not joiners — or
 * { alreadyRan: false, jobId } on first successful claim.
 * The windowKey is always persisted so the @@unique([type, windowKey])
 * constraint applies (Postgres treats NULLs as distinct, so a NULL
 * windowKey could never be rejected); unique-constraint violations from
 * a lost race are reported as duplicates.
 */
export async function claimRun(jobName: string, windowKey: string | null): Promise<ClaimResult> {
  try {
    // نطاق النافذة: النوع + النافذة معاً. بلا windowKey لا يميّز القيد
    // الفريد شيئاً، فنطابق على النوع وحده (السلوك القديم للمتصلين
    // الذين لا يمررون نافذة — لا متصل إنتاجي يفعل ذلك اليوم).
    const scope = windowKey == null ? { type: jobName } : { type: jobName, windowKey }

    // Check if a completed job already exists for THIS window
    const completed = await db.scheduledJob.findFirst({
      where: { ...scope, status: 'completed' },
      orderBy: { executedAt: 'desc' },
    })

    if (completed) {
      return { alreadyRan: true, jobId: null }
    }

    // A pending/running row for the same window means a concurrent tick
    // is already draining — skip instead of joining it (joining ran two
    // publishers in parallel over the same queue and double-posted).
    const inProgress = await db.scheduledJob.findFirst({
      where: {
        ...scope,
        status: { in: ['pending', 'running'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (inProgress) {
      return { alreadyRan: true, jobId: null }
    }

    const job = await db.scheduledJob.create({
      data: {
        type: jobName,
        windowKey,
        status: 'running',
        scheduledAt: new Date(),
      },
    })

    return { alreadyRan: false, jobId: job.id }
  } catch (err: any) {
    // Handle race conditions
    if (err?.code === 'P2002') {
      return { alreadyRan: true, jobId: null }
    }
    throw err
  }
}

/**
 * Mark a job as successfully completed.
 */
export async function completeRun(jobId: string): Promise<void> {
  await db.scheduledJob.update({
    where: { id: jobId },
    data: { status: 'completed', executedAt: new Date() },
  })
}

/**
 * Mark a job as failed.
 */
export async function failRun(jobId: string, error: unknown): Promise<void> {
  await db.scheduledJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    },
  })
}

/**
 * Check if a job type has missed more than 2× its expected interval.
 * Returns true when the last successful run is older than 2× intervalMs,
 * or when no completed run exists at all.
 */
export async function needsCatchUp(jobName: string, intervalMs: number): Promise<boolean> {
  const last = await db.scheduledJob.findFirst({
    where: { type: jobName, status: 'completed' },
    orderBy: { executedAt: 'desc' },
    select: { executedAt: true },
  })

  if (!last?.executedAt) return true
  return Date.now() - last.executedAt.getTime() > intervalMs * 2
}

/**
 * Generate an idempotency window key based on the cadence type.
 *
 * - daily   → "YYYY-MM-DD"
 * - weekly  → "YYYY-Www"   (ISO week)
 * - monthly → "YYYY-MM"
 */
export function windowKeyFor(type: 'daily' | 'weekly' | 'monthly', now?: Date): string {
  const d = now ?? new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  if (type === 'daily') return `${year}-${month}-${day}`
  if (type === 'monthly') return `${year}-${month}`

  // ISO week calculation
  const tmp = new Date(Date.UTC(year, d.getMonth(), d.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
