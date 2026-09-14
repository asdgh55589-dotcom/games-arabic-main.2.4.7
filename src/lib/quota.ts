import { db } from '@/lib/db'

/**
 * Phase 2 quota engine — owner-controlled upload limits.
 *
 * Precedence: QuotaOverride (per-user, NULL = inherit) > QuotaPolicy
 * (per-rank) > BUILTIN_QUOTAS below. Daily counters key on UTC date
 * (YYYY-MM-DD) so the daily quota resets with no cron.
 */

export interface QuotaLimits {
  uploadsPerDay: number
  maxFileBytes: number
  totalBytes: number
  source: 'override' | 'policy' | 'builtin'
}

const GB = 1024 ** 3

export const QUOTA_RANKS = [
  'creator',
  'publisher',
  'moderator',
  'admin',
  'manager',
  'owner',
] as const

/** Built-in defaults — used only when no policy row exists yet. */
export const BUILTIN_QUOTAS: Record<string, Omit<QuotaLimits, 'source'>> = {
  creator: { uploadsPerDay: 10, maxFileBytes: 2 * GB, totalBytes: 20 * GB },
  publisher: { uploadsPerDay: 10, maxFileBytes: 2 * GB, totalBytes: 20 * GB },
  moderator: { uploadsPerDay: 100, maxFileBytes: 2 * GB, totalBytes: 100 * GB },
  admin: { uploadsPerDay: 100, maxFileBytes: 2 * GB, totalBytes: 100 * GB },
  manager: { uploadsPerDay: 100, maxFileBytes: 2 * GB, totalBytes: 100 * GB },
  owner: { uploadsPerDay: 1000, maxFileBytes: 2 * GB, totalBytes: 1000 * GB },
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** 2GB / 512MB / 900KB — Latin units (standard in Arabic UI). */
export function formatQuotaBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n >= GB) return `${trimNum(n / GB)}GB`
  if (n >= 1024 ** 2) return `${trimNum(n / 1024 ** 2)}MB`
  if (n >= 1024) return `${trimNum(n / 1024)}KB`
  return `${n}B`
}

function trimNum(n: number): string {
  return Number(n.toFixed(1)).toString()
}

export async function getEffectiveQuota(
  userId: string,
  rank: string,
): Promise<QuotaLimits> {
  const builtin = BUILTIN_QUOTAS[rank] ?? BUILTIN_QUOTAS.creator
  const [override, policy] = await Promise.all([
    db.quotaOverride.findUnique({ where: { userId } }),
    db.quotaPolicy.findUnique({ where: { rank } }),
  ])
  const pick = (field: 'uploadsPerDay' | 'maxFileBytes' | 'totalBytes'): number => {
    const o = override?.[field]
    if (o !== null && o !== undefined) return Number(o)
    const p = policy?.[field]
    if (p !== null && p !== undefined) return Number(p)
    return builtin[field]
  }
  return {
    uploadsPerDay: pick('uploadsPerDay'),
    maxFileBytes: pick('maxFileBytes'),
    totalBytes: pick('totalBytes'),
    source: override ? 'override' : policy ? 'policy' : 'builtin',
  }
}

export interface QuotaCheck {
  allowed: boolean
  /** Arabic deny reason (present when !allowed). */
  reason?: string
  quota: QuotaLimits
  usedToday: number
  usedBytesToday: number
  usedTotalBytes: number
}

export async function checkUploadQuota(
  userId: string,
  rank: string,
  bytes: number,
): Promise<QuotaCheck> {
  const quota = await getEffectiveQuota(userId, rank)
  const [daily, storage] = await Promise.all([
    db.uploadUsageDaily.findUnique({
      where: { userId_date: { userId, date: todayKey() } },
    }),
    db.creatorStorage.findUnique({ where: { userId } }),
  ])
  const usedToday = daily?.count ?? 0
  const usedBytesToday = Number(daily?.bytes ?? 0)
  const usedTotalBytes = Number(storage?.totalBytes ?? 0)

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { allowed: false, reason: 'حجم الملف غير صالح', quota, usedToday, usedBytesToday, usedTotalBytes }
  }
  if (bytes > quota.maxFileBytes) {
    return {
      allowed: false,
      reason: `حجم الملف يتجاوز الحد الأقصى (${formatQuotaBytes(quota.maxFileBytes)} لكل ملف)`,
      quota, usedToday, usedBytesToday, usedTotalBytes,
    }
  }
  if (usedToday + 1 > quota.uploadsPerDay) {
    return {
      allowed: false,
      reason: `تجاوزت حد الرفع اليومي (${quota.uploadsPerDay} يومياً) — حاول غداً`,
      quota, usedToday, usedBytesToday, usedTotalBytes,
    }
  }
  if (usedTotalBytes + bytes > quota.totalBytes) {
    return {
      allowed: false,
      reason: `تجاوزت مساحتك التخزينية (${formatQuotaBytes(quota.totalBytes)}) — احذف ملفات قديمة أو تواصل مع الإدارة`,
      quota, usedToday, usedBytesToday, usedTotalBytes,
    }
  }
  return { allowed: true, quota, usedToday, usedBytesToday, usedTotalBytes }
}

export interface RecordUploadInput {
  userId: string
  modId?: string | null
  kind: 'image' | 'file'
  provider: 'freeimage' | 'ia'
  originalUrl: string
  wrappedUrl?: string | null
  storageKey?: string | null
  bytes: number
  mime?: string | null
  checksum?: string | null
}

/**
 * Atomically: bump daily counter + lifetime storage + write audit row.
 * Call ONLY after checkUploadQuota allowed the upload (re-check inside
 * adapters right before recording to shrink the check/record race).
 */
export async function recordUploadUsage(input: RecordUploadInput) {
  const date = todayKey()
  const bytes = BigInt(Math.max(0, Math.floor(input.bytes)))
  return db.$transaction([
    db.uploadUsageDaily.upsert({
      where: { userId_date: { userId: input.userId, date } },
      create: { userId: input.userId, date, count: 1, bytes },
      update: { count: { increment: 1 }, bytes: { increment: bytes } },
    }),
    db.creatorStorage.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, totalBytes: bytes, filesCount: 1 },
      update: { totalBytes: { increment: bytes }, filesCount: { increment: 1 } },
    }),
    db.uploadAsset.create({
      data: {
        userId: input.userId,
        modId: input.modId ?? null,
        kind: input.kind,
        provider: input.provider,
        originalUrl: input.originalUrl,
        wrappedUrl: input.wrappedUrl ?? null,
        storageKey: input.storageKey ?? null,
        bytes,
        mime: input.mime ?? null,
        checksum: input.checksum ?? null,
      },
    }),
  ])
}
