// SSE client with reconnection logic (exponential backoff).

export interface RealtimeClientOptions {
  url?: string
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: unknown) => void
  onMessage?: (event: MessageEvent) => void
  onEvent?: (event: unknown) => void
  initialDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
  maxRetries?: number
}

export function computeBackoff(
  attempt: number,
  initialDelayMs = 1000,
  backoffFactor = 2,
  maxDelayMs = 30000,
): number {
  const exp = initialDelayMs * backoffFactor ** Math.max(0, attempt)
  return Math.min(maxDelayMs, Math.round(exp))
}

export class RealtimeClient {
  private url: string
  private options: RealtimeClientOptions
  private source: EventSource | null = null
  private attempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private _connected = false

  constructor(options: RealtimeClientOptions = {}) {
    this.url = options.url ?? '/api/realtime/stream'
    this.options = options
  }

  get isConnected(): boolean {
    return this._connected
  }

  connect(): void {
    this.stopped = false
    if (typeof EventSource === 'undefined') {
      // Non-browser environment: no-op but keep API.
      return
    }
    if (this.source) return
    try {
      this.source = new EventSource(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.source.onopen = () => {
      this._connected = true
      this.attempt = 0
      this.options.onOpen?.()
    }
    this.source.onmessage = (ev: MessageEvent) => {
      this.options.onMessage?.(ev)
      this.options.onEvent?.(safeParse(ev.data))
    }
    this.source.onerror = (err: unknown) => {
      this._connected = false
      this.options.onError?.(err)
      // EventSource auto-reconnects in browsers, but we implement our own backoff
      // by closing and scheduling a reconnect to respect maxDelay.
      try {
        this.source?.close()
      } catch {
        // ignore
      }
      this.source = null
      if (!this.stopped) this.scheduleReconnect()
      this.options.onClose?.()
    }
  }

  disconnect(): void {
    this.stopped = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (this.source) {
      try {
        this.source.close()
      } catch {
        // ignore
      }
      this.source = null
    }
    this._connected = false
    this.options.onClose?.()
  }

  reconnect(): void {
    this.disconnect()
    this.stopped = false
    this.attempt = 0
    this.connect()
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    const maxRetries = this.options.maxRetries ?? Infinity
    if (this.attempt >= maxRetries) return
    const delay = computeBackoff(
      this.attempt,
      this.options.initialDelayMs ?? 1000,
      this.options.backoffFactor ?? 2,
      this.options.maxDelayMs ?? 30000,
    )
    this.attempt += 1
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }
}

export function createRealtimeClient(options?: RealtimeClientOptions): RealtimeClient {
  return new RealtimeClient(options)
}

function safeParse(data: unknown): unknown {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}