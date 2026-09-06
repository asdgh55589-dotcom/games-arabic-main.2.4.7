import { createHash } from 'node:crypto'

/**
 * FreeImage.host server relay (SERVER-ONLY — the API key never leaves here).
 * FreeImage is a chevereto-compatible image API: binary `source` field +
 * key/action/format fields. Response shapes vary by version, so the parser
 * tries every known URL location (unit-tested with fixtures, no network).
 */

const FREEIMAGE_ENDPOINT = 'https://freeimage.host/api/1/upload'

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
): Promise<FreeImageResult> {
  const key = getFreeImageKey()
  if (!key) throw new Error('FreeImage غير مُكوَّن — FREEIMAGE_API_KEY مفقود')

  const form = new FormData()
  form.append('key', key)
  form.append('action', 'upload')
  form.append('format', 'json')
  form.append('source', new Blob([new Uint8Array(buffer)], { type: mime }), filename)

  const res = await fetch(FREEIMAGE_ENDPOINT, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      (json as { status_txt?: unknown; error?: { message?: unknown } } | null)?.status_txt ??
      (json as { error?: { message?: unknown } } | null)?.error?.message
    throw new Error(typeof msg === 'string' && msg ? `FreeImage: ${msg}` : `FreeImage upload failed (${res.status})`)
  }
  const parsed = parseFreeImageResponse(json)
  return { ...parsed, sha256: sha256Hex(buffer) }
}
