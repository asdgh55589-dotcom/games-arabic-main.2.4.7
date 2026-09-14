/**
 * Pure envelope helpers for the Uppy XHR flow (dependency-free so they are
 * unit-testable under jest; Uppy v6 ships ESM-only and cannot load in this
 * repo's CommonJS jest setup — live Uppy behavior was verified with node:
 *   ar cancel → "الغاء" / en cancel → "Cancel",
 *   restrictions + XHRUpload endpoint opts stored correctly.
 *
 * Our API envelope: success { data: {...} } / failure { error: { message } }.
 */

/** Extracted data object from a success responseText ({} when unusable). */
export function parseUppySuccessEnvelope(responseText: string): Record<string, unknown> {
  try {
    const json = JSON.parse(responseText) as {
      data?: unknown
    }
    const data = json && typeof json === 'object' ? json.data : undefined
    return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Arabic server reason from a failed XHR ('' when absent/unparseable). */
export function parseUppyErrorEnvelope(xhr: unknown): string {
  try {
    const text = (xhr as { responseText?: unknown })?.responseText
    if (typeof text !== 'string' || !text) return ''
    const json = JSON.parse(text) as { error?: { message?: unknown } }
    const msg = json?.error?.message
    return typeof msg === 'string' && msg ? msg : ''
  } catch {
    return ''
  }
}

/** Pick the stored URL: edge-wrapped first, then original (https only). */
export function pickStoredUrl(data: Record<string, unknown>): string {
  const wrapped = typeof data.wrappedUrl === 'string' ? data.wrappedUrl : ''
  const original = typeof data.originalUrl === 'string' ? data.originalUrl : typeof data.url === 'string' ? data.url : ''
  const url = wrapped || original
  return url.startsWith('https://') ? url : ''
}
