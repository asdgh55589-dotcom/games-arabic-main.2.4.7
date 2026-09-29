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
  debug: (msgOrObj: string | LogMeta, meta?: unknown) => {
    const [obj, msg] = normalizeArgs(msgOrObj, meta)
    if (process.env.LOG_LEVEL === 'debug') {
      if (obj !== undefined) console.debug(`[DEBUG] ${msg}`, obj)
      else console.debug(`[DEBUG] ${msg}`)
    }
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
      debug: wrap(nodeLogger.debug.bind(nodeLogger), consoleFallback.debug),
      child: (bindings: Record<string, unknown>) => {
        const child = nodeLogger!.child(bindings)
        return {
          info: wrap(child.info.bind(child), (m, meta) =>
            consoleFallback.info(m, { ...(bindings as object), ...((meta as object) ?? {}) }),
          ),
          warn: wrap(child.warn.bind(child), (m, meta) =>
            consoleFallback.warn(m, { ...(bindings as object), ...((meta as object) ?? {}) }),
          ),
          error: wrap(child.error.bind(child), (m, meta) =>
            consoleFallback.error(m, { ...(bindings as object), ...((meta as object) ?? {}) }),
          ),
          debug: wrap(child.debug.bind(child), (m, meta) =>
            consoleFallback.debug(m, { ...(bindings as object), ...((meta as object) ?? {}) }),
          ),
        }
      },
    }
  : {
      ...consoleFallback,
      child: (bindings: Record<string, unknown>) => ({
        info: (m: string | LogMeta, meta?: unknown) =>
          consoleFallback.info(m, { ...bindings, ...((meta as object) ?? {}) }),
        warn: (m: string | LogMeta, meta?: unknown) =>
          consoleFallback.warn(m, { ...bindings, ...((meta as object) ?? {}) }),
        error: (m: string | LogMeta, meta?: unknown) =>
          consoleFallback.error(m, { ...bindings, ...((meta as object) ?? {}) }),
        debug: (m: string | LogMeta, meta?: unknown) =>
          consoleFallback.debug(m, { ...bindings, ...((meta as object) ?? {}) }),
      }),
    }

export type RequestLogger = ReturnType<typeof logger.child>

/**
 * Create a child logger carrying request context (requestId + route).
 * Phase 2 observability: every API route log line must include both.
 */
export function createRequestLogger(
  requestId: string,
  route: string,
  extra?: Record<string, unknown>,
): RequestLogger {
  return logger.child({ requestId, route, ...extra })
}

interface ParsedFrame {
  file: string
  line: string
  function: string
}

/** Extract file/line/function from the first user-land stack frame. */
function parseStackFrame(stack: string): ParsedFrame {
  const lines = stack.split('\n').slice(1)
  for (const line of lines) {
    // "at fn (file:line:col)" or "at file:line:col"
    const m = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):\d+\)?$/)
    if (!m) continue
    const file = m[2]
    if (file.includes('node_modules') || file.startsWith('node:')) continue
    return { file, line: m[3], function: (m[1] ?? '<anonymous>').trim() }
  }
  return { file: 'unknown', line: 'unknown', function: 'unknown' }
}

/**
 * ERROR logging with file/line/function context.
 * Stack traces stay server-side; callers must still return generic client messages.
 */
export function logError(
  error: unknown,
  context: {
    requestId?: string
    route?: string
    userId?: string
    extra?: Record<string, unknown>
  } = {},
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  const frame = err.stack ? parseStackFrame(err.stack) : { file: 'unknown', line: 'unknown', function: 'unknown' }
  logger.error(
    {
      err: {
        message: err.message,
        // Full stack only in dev — prod keeps message + frame (Sentry gets the stack via reportError)
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
        ...frame,
      },
      ...(context.requestId ? { requestId: context.requestId } : {}),
      ...(context.route ? { route: context.route } : {}),
      ...(context.userId ? { userId: context.userId } : {}),
      ...context.extra,
    },
    err.message,
  )
}
