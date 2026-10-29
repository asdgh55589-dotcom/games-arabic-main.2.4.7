// Client-side channel management. A "channel" is a logical stream of
// real-time events scoped to a single user.

export function channelName(userId: string | null | undefined): string {
  return userId ? `user:${userId}` : 'user:anonymous'
}

export interface RealtimeChannelOptions {
  userId?: string | null
  url?: string
}

export class RealtimeChannel {
  private userId: string | null
  private url: string
  private listeners = new Map<string, Set<(e: unknown) => void>>()

  constructor(options: RealtimeChannelOptions = {}) {
    this.userId = options.userId ?? null
    this.url = options.url ?? '/api/realtime/stream'
  }

  get name(): string {
    return channelName(this.userId)
  }

  get endpoint(): string {
    return this.url
  }

  setUserId(userId: string | null): void {
    this.userId = userId
  }

  on(event: string, cb: (e: unknown) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb)
    return () => this.off(event, cb)
  }

  off(event: string, cb: (e: unknown) => void): void {
    this.listeners.get(event)?.delete(cb)
  }

  emit(event: string, payload: unknown): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const cb of Array.from(set)) {
      try {
        cb(payload)
      } catch {
        // best-effort
      }
    }
  }

  listenerCount(event?: string): number {
    if (event) return this.listeners.get(event)?.size ?? 0
    let total = 0
    for (const set of this.listeners.values()) total += set.size
    return total
  }
}

export function createChannel(options?: RealtimeChannelOptions): RealtimeChannel {
  return new RealtimeChannel(options)
}

export function getChannel(userId: string | null | undefined, url?: string): RealtimeChannel {
  return new RealtimeChannel({ userId, url })
}