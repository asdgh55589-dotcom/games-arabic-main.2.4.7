/**
 * Cloudinary — EXCLUSIVELY for user avatars/banners ("الصور الشخصية وخلفيات المستخدمين" فقط).
 *
 * This resolves the old contradiction: the previous comment claimed the opposite
 * ("مخصص لصور التعديلات فقط (cover, banner, screenshots)" with "الصور الشخصية
 * وخلفيات المستخدمين تبقى على Supabase Storage"). Canonical rule now:
 * mods (cover/banner/screenshots) → FreeImage, NEVER this module;
 * user avatars/banners → Cloudinary (this module). Mods must NEVER call this module.
 *
 * Exposed API (SA-1 codes against these EXACT signatures — keep them):
 * - uploadToCloudinary(buffer, { folder, transform?, publicId? }) → { url, publicId }
 * - deleteFromCloudinary(publicId) → { ok } (idempotent; 404/not-found → { ok: true })
 * - verifyCloudinaryConfig() → throws Arabic Error when CLOUDINARY_CLOUD_NAME /
 *   CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are unset
 * - isCloudinaryEnabled() → CLOUDINARY_ENABLED === 'true' && configured (default false, fail-closed)
 * - getCloudinaryUsage() → { usage, limit, percentUsed } (field names kept byte-compatible
 *   with src/lib/image-health-check.ts getHealthStatus()); on ANY error returns the
 *   UNAVAILABLE sentinel below — see "SA-3 SENTINEL CONTRACT".
 * - checkAvatarQuota(userId, bytes) → { ok, reasonAr? } (NOT wired into routes yet;
 *   routes are SA-1 scope — orchestrator follow-up must call it before upload)
 * - resetCloudinaryCircuitBreaker() → test seam to clear the module circuit breaker
 *
 * SA-3 SENTINEL CONTRACT (getCloudinaryUsage): on ANY failure (API error OR missing
 * config) this returns { usage: -1, limit: -1, percentUsed: -1 }. SA-3 MUST check
 * `usage.usage < 0 || usage.percentUsed < 0` and render 'غير متاح'. NEVER render the
 * negative values as bytes, and NEVER treat them as zeros (zeros would mask outages).
 *
 * QUOTA DECISION (owner decision, documented): quota-rank roles
 * (creator/publisher/moderator/admin/manager/owner) are checked via the existing
 * Phase-2 engine (checkUploadQuota; bytes counted by recordUploadUsage AFTER a
 * successful upload). Non-creators (member/unknown) get a 50MB lifetime cap
 * (AVATAR_NON_CREATOR_LIFETIME_BYTES) read from creatorStorage.totalBytes (0 when
 * the row is missing). Recording avatar bytes is a follow-up: recordUploadUsage
 * only accepts provider 'freeimage' | 'ia', so the orchestrator must decide how
 * avatar bytes are persisted before enforcement is fully effective.
 *
 * Reliability policy: upload_stream (buffer) with folder + transformation string +
 * invalidate and a 30s timeout; retry ONCE on transient failures (5xx/timeout/
 * network) and NEVER on 4xx/validation errors. Module circuit breaker: each failed
 * OPERATION (5xx/timeout/network only — 4xx never counts) is recorded once; 5 failures
 * within 60s open the circuit, which half-opens after 60s (next call is a trial).
 * reportError (Sentry, fail-open) fires ONCE per failed operation and ONLY for
 * unexpected classes (5xx/timeout/network) — never for 4xx/validation/misconfig.
 * Circuit-breaker counts one failure per failed OPERATION (a retried operation
 * counts once); 4xx never counts.
 * Usage polling never reports (warn log only) to avoid Sentry noise.
 * NEVER logged: full API keys/secrets, buffers/bytes (only masked key + byte counts).
 */

import { v2 as cloudinary } from 'cloudinary'

import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import { QUOTA_RANKS, checkUploadQuota } from '@/lib/quota'

const FREE_LIMIT_BYTES = 25 * 1024 ** 3 // 25GB free tier (matches previous constant)
const UPLOAD_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 2 // initial try + ONE retry
const CB_THRESHOLD = 5 // failures …
const CB_WINDOW_MS = 60_000 // … within 60s …
const CB_HALF_OPEN_MS = 60_000 // … half-open after 60s

/** Owner decision: lifetime avatar/banner cap for non-creator (member) users. */
export const AVATAR_NON_CREATOR_LIFETIME_BYTES = 50 * 1024 * 1024 // 50MB

/** Arabic user-facing messages per failure class. */
export const CLOUDINARY_AR_MESSAGES = {
  auth: 'خطأ في إعدادات الخدمة، تواصل مع الدعم',
  notFound: 'الملف غير موجود',
  tooLarge: 'حجم الملف يتجاوز الحد الأقصى',
  rateLimited: 'تم تجاوز الحد المسموح، حاول لاحقًا',
  timeout: 'انتهت مهلة الاتصال، حاول مرة أخرى',
  network: 'تعذر الاتصال بالخدمة، تحقق من الإنترنت',
  fallback: 'حدث خطأ أثناء الرفع، حاول مرة أخرى',
  notConfigured:
    'Cloudinary غير مُكوَّن — أضف CLOUDINARY_CLOUD_NAME و CLOUDINARY_API_KEY و CLOUDINARY_API_SECRET في البيئة ثم أعد التشغيل',
  invalidImage: 'بيانات الصورة غير صالحة — أعد المحاولة',
  invalidFolder: 'مجلد الرفع غير محدد',
  invalidPublicId: 'المعرف غير صالح',
} as const

export interface CloudinaryUploadOpts {
  folder: string
  transform?: string
  publicId?: string
}

export interface AvatarQuotaCheck {
  ok: boolean
  reasonAr?: string
}

export interface CloudinaryUsageSnapshot {
  usage: number
  limit: number
  percentUsed: number
}

// ---------------------------------------------------------------------------
// Config (lazy: env is read at call time, never at import time)
// ---------------------------------------------------------------------------

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  )
}

export function verifyCloudinaryConfig(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error(CLOUDINARY_AR_MESSAGES.notConfigured)
  }
}

/** Fail-closed: false unless explicitly enabled AND configured. */
export function isCloudinaryEnabled(): boolean {
  return process.env.CLOUDINARY_ENABLED === 'true' && isCloudinaryConfigured()
}

/** Verify credentials then (re)apply them to the SDK with the 30s timeout. */
function ensureCloudinary(): void {
  verifyCloudinaryConfig()
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: UPLOAD_TIMEOUT_MS,
  })
}

/** first4…last2 — the only key form that may ever reach logs/reports. */
function maskedApiKey(): string {
  const key = process.env.CLOUDINARY_API_KEY ?? ''
  if (key.length <= 6) return '***'
  return `${key.slice(0, 4)}…${key.slice(-2)}`
}

// ---------------------------------------------------------------------------
// Failure classification → Arabic (single dispatcher, no scattered conditionals)
// ---------------------------------------------------------------------------

type FailureClass =
  | 'auth'
  | 'notFound'
  | 'tooLarge'
  | 'rateLimited'
  | 'timeout'
  | 'network'
  | 'server'
  | 'client'

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || 'Error'
  if (typeof err === 'string') return err
  if (err !== null && typeof err === 'object') {
    const m = (err as Record<string, unknown>).message
    if (typeof m === 'string' && m) return m
    try {
      return JSON.stringify(err) ?? 'unknown error'
    } catch {
      return 'unknown error'
    }
  }
  return 'unknown error'
}

function httpCodeOf(err: unknown): number | undefined {
  if (err !== null && typeof err === 'object') {
    const rec = err as Record<string, unknown>
    for (const field of ['http_code', 'status', 'statusCode']) {
      const v = rec[field]
      if (typeof v === 'number' && Number.isFinite(v)) return v
      if (typeof v === 'string' && /^\d{3}$/.test(v)) return Number(v)
    }
  }
  return undefined
}

function isNotFoundMessage(msg: string): boolean {
  return /not[-\s]?found|no such|does not exist/i.test(msg)
}

function classifyFailure(err: unknown): FailureClass {
  const code = httpCodeOf(err)
  if (code === 401 || code === 403) return 'auth'
  if (code === 404) return 'notFound'
  if (code === 413) return 'tooLarge'
  if (code === 429) return 'rateLimited'
  if (code !== undefined && code >= 500) return 'server'
  if (code !== undefined && code >= 400) return 'client'
  const msg = messageOf(err)
  if (isNotFoundMessage(msg)) return 'notFound'
  if (/timed?\s*out|timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(msg)) return 'timeout'
  if (/ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|EPIPE|ENETUNREACH|socket hang up|network/i.test(msg))
    return 'network'
  return 'client'
}

/** Retryable = transient only (5xx/timeout/network). 4xx/validation never retry. */
function isRetryable(cls: FailureClass): boolean {
  return cls === 'server' || cls === 'timeout' || cls === 'network'
}

/** Unexpected = Sentry-worthy (5xx/timeout/network only). */
function isReportable(cls: FailureClass): boolean {
  return isRetryable(cls)
}

function toArabic(cls: FailureClass): string {
  switch (cls) {
    case 'auth':
      return CLOUDINARY_AR_MESSAGES.auth
    case 'notFound':
      return CLOUDINARY_AR_MESSAGES.notFound
    case 'tooLarge':
      return CLOUDINARY_AR_MESSAGES.tooLarge
    case 'rateLimited':
      return CLOUDINARY_AR_MESSAGES.rateLimited
    case 'timeout':
      return CLOUDINARY_AR_MESSAGES.timeout
    case 'network':
      return CLOUDINARY_AR_MESSAGES.network
    case 'server':
    case 'client':
    default:
      return CLOUDINARY_AR_MESSAGES.fallback
  }
}

// ---------------------------------------------------------------------------
// Module circuit breaker (5 transient fails/60s → open; half-open after 60s)
// ---------------------------------------------------------------------------

let cbFailures: number[] = []
let cbOpenUntil = 0

function pruneFailures(now: number): void {
  cbFailures = cbFailures.filter((t) => now - t < CB_WINDOW_MS)
}

function isCircuitOpen(): boolean {
  const now = Date.now()
  if (cbOpenUntil > 0) {
    if (now < cbOpenUntil) return true
    cbOpenUntil = 0 // half-open: allow one trial
    return false
  }
  pruneFailures(now)
  return cbFailures.length >= CB_THRESHOLD
}

function recordFailure(): void {
  const now = Date.now()
  pruneFailures(now)
  cbFailures.push(now)
  if (cbFailures.length >= CB_THRESHOLD) {
    cbOpenUntil = now + CB_HALF_OPEN_MS
  }
}

function recordSuccess(): void {
  cbFailures = []
  cbOpenUntil = 0
}

/** Test seam: clear the module circuit breaker. */
export function resetCloudinaryCircuitBreaker(): void {
  cbFailures = []
  cbOpenUntil = 0
}

// ---------------------------------------------------------------------------
// Upload (avatars/banners ONLY — mods must use FreeImage)
// ---------------------------------------------------------------------------

function uploadOnce(
  buffer: Buffer,
  opts: CloudinaryUploadOpts,
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      const err = new Error(
        `Cloudinary upload timed out after ${UPLOAD_TIMEOUT_MS}ms`,
      ) as Error & { code?: string }
      err.code = 'ETIMEDOUT'
      reject(err)
    }, UPLOAD_TIMEOUT_MS)
    if (typeof (timer as unknown as { unref?: unknown }).unref === 'function') {
      ;(timer as unknown as { unref: () => void }).unref()
    }

    let stream: { end: (data: Buffer) => void }
    try {
      stream = cloudinary.uploader.upload_stream(
        {
          folder: opts.folder,
          public_id: opts.publicId,
          resource_type: 'image',
          transformation: opts.transform,
          invalidate: true,
          timeout: UPLOAD_TIMEOUT_MS,
        },
        (error, result) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          if (error) {
            reject(error)
          } else if (result?.secure_url || result?.url) {
            resolve({
              url: result.secure_url ?? result.url,
              publicId: result.public_id,
            })
          } else {
            reject(new Error(CLOUDINARY_AR_MESSAGES.fallback))
          }
        },
      )
    } catch (err) {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(err)
      }
      return
    }
    try {
      stream.end(buffer)
    } catch (err) {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(err)
      }
    }
  })
}

export async function uploadToCloudinary(
  buffer: Buffer,
  opts: CloudinaryUploadOpts,
): Promise<{ url: string; publicId: string }> {
  const start = Date.now()
  // Fail fast on server misconfiguration (Arabic), before touching the SDK.
  ensureCloudinary()
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(CLOUDINARY_AR_MESSAGES.invalidImage)
  }
  if (!opts || typeof opts.folder !== 'string' || !opts.folder) {
    throw new Error(CLOUDINARY_AR_MESSAGES.invalidFolder)
  }
  if (isCircuitOpen()) {
    logger.warn(
      { op: 'upload', folder: opts.folder, apiKey: maskedApiKey() },
      'cloudinary circuit open — short-circuit',
    )
    throw new Error(CLOUDINARY_AR_MESSAGES.rateLimited)
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await uploadOnce(buffer, opts)
      recordSuccess()
      logger.info(
        {
          op: 'upload',
          folder: opts.folder,
          latencyMs: Date.now() - start,
          attempt,
          bytes: buffer.length,
          apiKey: maskedApiKey(),
        },
        'cloudinary upload ok',
      )
      return res
    } catch (err) {
      const cls = classifyFailure(err)
      if (!isRetryable(cls)) {
        logger.warn(
          {
            op: 'upload',
            folder: opts.folder,
            latencyMs: Date.now() - start,
            attempt,
            class: cls,
            apiKey: maskedApiKey(),
          },
          'cloudinary upload rejected',
        )
        throw new Error(toArabic(cls))
      }
      if (attempt >= MAX_ATTEMPTS) {
        recordFailure() // one count per failed OPERATION (retried attempts count once)
        logger.error(
          {
            op: 'upload',
            folder: opts.folder,
            latencyMs: Date.now() - start,
            attempts: attempt,
            class: cls,
            apiKey: maskedApiKey(),
          },
          'cloudinary upload failed',
        )
        reportError(err, { route: 'cloudinary', action: 'upload' })
        throw new Error(toArabic(cls))
      }
      logger.warn(
        {
          op: 'upload',
          folder: opts.folder,
          attempt,
          class: cls,
          apiKey: maskedApiKey(),
        },
        'cloudinary upload transient failure — retrying once',
      )
    }
  }
  throw new Error(CLOUDINARY_AR_MESSAGES.fallback)
}

// ---------------------------------------------------------------------------
// Delete (idempotent: 404/not-found → { ok: true })
// ---------------------------------------------------------------------------

export async function deleteFromCloudinary(publicId: string): Promise<{ ok: boolean }> {
  const start = Date.now()
  if (!publicId || typeof publicId !== 'string') {
    throw new Error(CLOUDINARY_AR_MESSAGES.invalidPublicId)
  }
  // Delete is cleanup: when unconfigured there is nothing to delete — succeed
  // without touching the SDK (fail-open) instead of breaking the request flow.
  if (!isCloudinaryConfigured()) {
    logger.info({ op: 'delete', unconfigured: true }, 'cloudinary delete skipped — unconfigured')
    return { ok: true }
  }
  ensureCloudinary()
  if (isCircuitOpen()) {
    logger.warn({ op: 'delete', apiKey: maskedApiKey() }, 'cloudinary circuit open — short-circuit')
    throw new Error(CLOUDINARY_AR_MESSAGES.rateLimited)
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await cloudinary.uploader.destroy(publicId, { invalidate: true })
      recordSuccess()
      logger.info(
        { op: 'delete', latencyMs: Date.now() - start, attempt, apiKey: maskedApiKey() },
        'cloudinary delete ok',
      )
      return { ok: true }
    } catch (err) {
      const cls = classifyFailure(err)
      if (cls === 'notFound') return { ok: true } // idempotent
      if (!isRetryable(cls)) {
        logger.warn(
          {
            op: 'delete',
            latencyMs: Date.now() - start,
            attempt,
            class: cls,
            apiKey: maskedApiKey(),
          },
          'cloudinary delete rejected',
        )
        throw new Error(toArabic(cls))
      }
      if (attempt >= MAX_ATTEMPTS) {
        recordFailure() // one count per failed OPERATION (retried attempts count once)
        logger.error(
          {
            op: 'delete',
            latencyMs: Date.now() - start,
            attempts: attempt,
            class: cls,
            apiKey: maskedApiKey(),
          },
          'cloudinary delete failed',
        )
        reportError(err, { route: 'cloudinary', action: 'delete' })
        throw new Error(toArabic(cls))
      }
      logger.warn(
        { op: 'delete', attempt, class: cls, apiKey: maskedApiKey() },
        'cloudinary delete transient failure — retrying once',
      )
    }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Usage (real Admin API; sentinel on ANY error — see SA-3 contract above)
// ---------------------------------------------------------------------------

export async function getCloudinaryUsage(): Promise<CloudinaryUsageSnapshot> {
  const UNAVAILABLE: CloudinaryUsageSnapshot = { usage: -1, limit: -1, percentUsed: -1 }
  try {
    ensureCloudinary()
    const info = await cloudinary.api.usage()
    const used =
      typeof info?.storage?.usage === 'number' && Number.isFinite(info.storage.usage)
        ? info.storage.usage
        : 0
    return {
      usage: used,
      limit: FREE_LIMIT_BYTES,
      percentUsed: (used / FREE_LIMIT_BYTES) * 100,
    }
  } catch {
    // Deliberately NOT zeros and NOT reported: zeros would mask outages in the
    // health UI, and usage polling must not spam Sentry (warn log only).
    logger.warn({ op: 'usage', apiKey: maskedApiKey() }, 'cloudinary usage unavailable')
    return UNAVAILABLE
  }
}

// ---------------------------------------------------------------------------
// Avatar quota helper (exported + tested; NOT wired into routes — SA-1 scope)
// ---------------------------------------------------------------------------

export async function checkAvatarQuota(userId: string, bytes: number): Promise<AvatarQuotaCheck> {
  if (!userId || !Number.isFinite(bytes) || bytes <= 0) {
    return { ok: false, reasonAr: 'حجم الملف غير صالح' }
  }
  const user = await db.user
    .findUnique({ where: { id: userId }, select: { role: true } })
    .catch(() => null)
  const role = (user as { role?: string } | null)?.role ?? 'member'

  if ((QUOTA_RANKS as readonly string[]).includes(role)) {
    const check = await checkUploadQuota(userId, role, bytes)
    if (!check.allowed) {
      return { ok: false, reasonAr: check.reason ?? 'تجاوزت حد الرفع المسموح' }
    }
    return { ok: true }
  }

  // Non-creators (member/unknown): 50MB lifetime cap — owner decision.
  const storage = await db.creatorStorage.findUnique({ where: { userId } }).catch(() => null)
  const used = Number((storage as { totalBytes?: unknown } | null)?.totalBytes ?? 0)
  if (used + bytes > AVATAR_NON_CREATOR_LIFETIME_BYTES) {
    return {
      ok: false,
      reasonAr: 'تجاوزت حد صور الحساب (50MB) — احذف صوراً قديمة أو تواصل مع الإدارة',
    }
  }
  return { ok: true }
}

export { cloudinary }
