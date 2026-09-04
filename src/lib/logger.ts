import pino from 'pino'

const isEdgeRuntime =
  typeof (globalThis as unknown as Record<string, unknown>).EdgeRuntime !== 'undefined' ||
  process.env.NEXT_RUNTIME === 'edge'

type LogMeta = Record<string, unknown> | unknown

function normalizeArgs(arg1: string | LogMeta, arg2?: unknown): [object | undefined, string] {
  if (typeof arg1 === 'string') {
    return [arg2 !== undefined ? { meta: arg2 } : undefined, arg1]
  }
  return [arg1 as object, typeof arg2 === 'string' ? arg2 : 'log']
}

// Console fallback for Edge runtime (pino uses Node streams/workers unavailable in Edge)
const consoleFallback = {
  info: (msgOrObj: string | LogMeta, meta?: unknown) => {
    const [obj, msg] = normalizeArgs(msgOrObj, meta)
    if (obj !== undefined) console.log(`[INFO] ${msg}`, obj)
    else console.log(`[INFO] ${msg}`)
  },
  warn: (msgOrObj: string | LogMeta, meta?: unknown) => {
    const [obj, msg] = normalizeArgs(msgOrObj, meta)
    if (obj !== undefined) console.warn(`[WARN] ${msg}`, obj)
    else console.warn(`[WARN] ${msg}`)
  },
  error: (msgOrObj: string | LogMeta, meta?: unknown) => {
    const [obj, msg] = normalizeArgs(msgOrObj, meta)
    if (obj !== undefined) console.error(`[ERROR] ${msg}`, obj)
    else console.error(`[ERROR] ${msg}`)
  },
}

function createNodeLogger() {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  })
}

const nodeLogger = isEdgeRuntime ? null : createNodeLogger()

function wrap(
  fn: (obj: object, msg: string) => void,
  fallbackFn: (msgOrObj: string | LogMeta, meta?: unknown) => void,
) {
  return (msgOrObj: string | LogMeta, meta?: unknown) => {
    if (!nodeLogger) {
      fallbackFn(msgOrObj, meta)
      return
    }
    const [obj, msg] = normalizeArgs(msgOrObj, meta)
    if (obj !== undefined) fn.call(nodeLogger, obj, msg)
    else (fn as unknown as (msg: string) => void).call(nodeLogger, msg)
  }
}

export const logger = nodeLogger
  ? {
      info: wrap(nodeLogger.info.bind(nodeLogger), consoleFallback.info),
      warn: wrap(nodeLogger.warn.bind(nodeLogger), consoleFallback.warn),
      error: wrap(nodeLogger.error.bind(nodeLogger), consoleFallback.error),
    }
  : consoleFallback
