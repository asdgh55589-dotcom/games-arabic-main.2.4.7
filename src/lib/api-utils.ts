/**
 * Parse a positive integer from a query-param string, falling back to `defaultValue`.
 * Negative, NaN, or non-numeric values fall back to the default.
 */
export function parseIntParam(value: string | null, defaultValue: number): number {
  if (value === null || value === '') return defaultValue
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 0) return defaultValue
  return n
}

/**
 * Clamp `value` to the inclusive `[min, max]` range.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Serialize Prisma results to JSON-safe objects (Date → string).
 * This bridges the gap between Prisma's Date types and our API types that expect strings.
 */
export function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/**
 * Parse and clamp a pagination parameter.
 * Page is clamped to `[1, maxPage]`, limit to `[1, maxLimit]`.
 */
export function parsePagination(
  pageStr: string | null,
  limitStr: string | null,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
): { page: number; limit: number } {
  const page = parseIntParam(pageStr, defaults.page ?? 1)
  const limit = parseIntParam(limitStr, defaults.limit ?? 24)
  const maxLimit = defaults.maxLimit ?? 100
  return {
    page: clamp(page, 1, 10_000),
    limit: clamp(limit, 1, maxLimit),
  }
}

/** Whitelist of valid sort values for a given endpoint. Returns the first allowed value if invalid. */
export function pickSort<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  return fallback
}
