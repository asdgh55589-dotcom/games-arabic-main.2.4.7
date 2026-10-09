/**
 * Phase 4 — Sparse fieldsets (`?fields=a,b,c`).
 *
 * Opt-in only: absent/invalid `fields` → undefined (caller returns everything,
 * identical to current behavior). MUST be translated to Prisma `select`
 * (never filter-after-fetch) for DB-level payload reduction.
 */

/** Parse `?fields=` against an allowlist → Prisma `select` (or undefined). */
export function parseSparseFields(
  fieldsParam: string | null,
  allowedFields: readonly string[],
): Record<string, boolean> | undefined {
  if (!fieldsParam) return undefined
  const allowed = new Set(allowedFields)
  const valid = fieldsParam
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && allowed.has(f))
  if (valid.length === 0) return undefined
  return Object.fromEntries(new Set(valid).values().map((f) => [f, true]))
}

/**
 * Post-fetch filter for non-Prisma payloads (already-serialized rows).
 * Prefer parseSparseFields + Prisma select; use this only when the data
 * doesn't come from a Prisma query.
 */
export function applySparseFields<T extends Record<string, unknown>>(
  data: T | T[],
  fields: Record<string, boolean> | undefined,
): T | T[] {
  if (!fields) return data
  const keys = Object.keys(fields)
  const filter = (obj: T): T => {
    const out: Record<string, unknown> = {}
    for (const key of keys) {
      if (key in obj) out[key] = obj[key]
    }
    return out as T
  }
  return Array.isArray(data) ? data.map(filter) : filter(data)
}
