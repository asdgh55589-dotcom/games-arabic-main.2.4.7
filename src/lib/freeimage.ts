import { createHash } from 'node:crypto'
import { logger } from './logger'

/**
 * FreeImage.host server relay (SERVER-ONLY — the API key never leaves here).
 * FreeImage is a chevereto-compatible image API: binary `source` field +
 * key/action/format fields. Response shapes vary by version, so the parser
 * tries every known URL location (unit-tested with fixtures, no network).
 */

const FREEIMAGE_ENDPOINT = 'https://freeimage.host/api/1/upload'

// ── Circuit breaker ──────────────────────────────────────────
const CB_FAILURE_THRESHOLD = 5
const CB_WINDOW_MS = 60_000
const CB_OPEN_DURATION_MS = 60_000

let cbFailureTimestamps: number[] = []
let cbOpenUntil = 0

export function isCircuitOpen(): boolean {
  if (Date.now() < cbOpenUntil) return true
  return false
}

function recordFailure(): void {
  const now = Date.now()
  cbFailureTimestamps.push(now)
  cbFailureTimestamps = cbFailureTimestamps.filter((t) => now - t < CB_WINDOW_MS)
  if (cbFailureTimestamps.length >= CB_FAILURE_THRESHOLD) {
    cbOpenUntil = now + CB_OPEN_DURATION_MS
    cbFailureTimestamps = []
  }
}

function resetCircuit(): void {
  cbFailureTimestamps = []
  cbOpenUntil = 0
}

/** Reset circuit breaker state — exported for tests only. */
export function __resetCircuitForTests(): void {
  resetCircuit()
}

// ── Arabic error map ─────────────────────────────────────────
function freeImageArabicError(status: number, isTimeout = false): string {
  if (isTimeout) return 'FREEIMAGE: انتهت المهلة'
  switch (status) {
    case 401:
    case 403:
      return 'FREEIMAGE: مفتاح API غير صالح'
    case 413:
      return 'FREEIMAGE: الملف يتجاوز الحد الأقصى'
    case 429:
      return 'FREEIMAGE: تم تجاوز حد الطلبات'
    default:
      return `FREEIMAGE: فشل الرفع (${status})`
  }
}

function freeImageNetworkError(): string {
  return 'FREEIMAGE: خطأ في الشبكة'
}

export function getFreeImageKey(): string {
  return (process.env.FREEIMAGE_API_KEY || '').trim()
}

export function isFreeImageConfigured(): boolean {
  return getFreeImageKey().length > 0
}

export interface FreeImageResult {
  /** Best full-size URL. */
  url: string
  thumbUrl: string | null
  /** Provider-side deletion URL (stored, never exposed to browser). */
  deleteUrl: string | null
  sha256: string
}

interface FreeImageImagePayload {
  url?: unknown
  display_url?: unknown
  delete_url?: unknown
  thumb?: { url?: unknown }
  medium?: { url?: unknown }
}

function firstString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return null
}

/** Pure parser — exported for unit tests (mocked fetch, no network). */
export function parseFreeImageResponse(json: unknown): { url: string; thumbUrl: string | null; deleteUrl: string | null } {
  const root = (json ?? {}) as { image?: FreeImageImagePayload; url?: unknown; display_url?: unknown }
  const img = root.image ?? {}
  const url = firstString(img.url, img.display_url, img.medium?.url, img.thumb?.url, root.url, root.display_url)
  if (!url) throw new Error('FreeImage returned no image URL')
  return {
    url,
    thumbUrl: firstString(img.thumb?.url) ?? null,
    deleteUrl: typeof img.delete_url === 'string' && img.delete_url ? img.delete_url : null,
  }
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function uploadToFreeImage(
  buffer: Buffer,
  mime: string,
  filename = 'image.jpg',
  timeoutMs = 60_000,
  title?: string,
): Promise<FreeImageResult> {
  const key = getFreeImageKey()
  if (!key) throw new Error('FreeImage غير مُكوَّن — FREEIMAGE_API_KEY مفقود')

  if (isCircuitOpen()) {
    throw new Error('FREEIMAGE: تم تعطيل الخدمة مؤقتاً — حاول لاحقاً')
  }

  const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '****'
  logger.info({ keyPrefix: masked }, 'FreeImage upload starting')

  const form = new FormData()
  form.append('key', key)
  form.append('action', 'upload')
  form.append('format', 'json')
  form.append('source', new Blob([new Uint8Array(buffer)], { type: mime }), filename)
  // عنوان الصورة (تسمية تلقائية من النموذج — مثال: t.me/PS_PC_AR-Name-1)
  if (title && title.trim()) {
    form.append('title', title.trim().slice(0, 200))
  }

  const doFetch = async () => {
    const res = await fetch(FREEIMAGE_ENDPOINT, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = await res.json().catch(() => null)
    return { res, json }
  }

  try {
    const { res, json } = await doFetch()
    if (!res.ok) {
      // Only retry on 5xx (never 4xx — 401/403/413/429 are permanent)
      if (res.status >= 500) {
        recordFailure()
        logger.warn({ status: res.status }, 'FreeImage 5xx — retrying once')
        try {
          const retry = await doFetch()
          if (!retry.res.ok) {
            recordFailure()
            throw new Error(freeImageArabicError(retry.res.status))
          }
          resetCircuit()
          const parsed = parseFreeImageResponse(retry.json)
          return { ...parsed, sha256: sha256Hex(buffer) }
        } catch (retryErr) {
          if (retryErr instanceof Error && retryErr.message.startsWith('FREEIMAGE:')) throw retryErr
          recordFailure()
          throw new Error(freeImageNetworkError())
        }
      }
      recordFailure()
      throw new Error(freeImageArabicError(res.status))
    }
    resetCircuit()
    const parsed = parseFreeImageResponse(json)
    return { ...parsed, sha256: sha256Hex(buffer) }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('FREEIMAGE:')) throw err
    // Timeout or network error
    const isTimeout = (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError' || err.message.includes('timeout') || err.message.includes('aborted')))
    if (isTimeout) {
      recordFailure()
      throw new Error(freeImageArabicError(0, true))
    }
    recordFailure()
    throw new Error(freeImageNetworkError())
  }
}
