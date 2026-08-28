/**
 * Structured logger — lightweight wrapper around console for production observability.
 * Usage: logger.info('message', { meta }), logger.warn(...), logger.error(...)
 * In future, swap implementation to pino/winston or forward to external service.
 */
export const logger = {
  info: (msg: string, meta?: unknown) => {
    if (meta !== undefined) console.log(`[INFO] ${msg}`, meta)
    else console.log(`[INFO] ${msg}`)
  },
  warn: (msg: string, meta?: unknown) => {
    if (meta !== undefined) console.warn(`[WARN] ${msg}`, meta)
    else console.warn(`[WARN] ${msg}`)
  },
  error: (msg: string, meta?: unknown) => {
    if (meta !== undefined) console.error(`[ERROR] ${msg}`, meta)
    else console.error(`[ERROR] ${msg}`)
  },
}
