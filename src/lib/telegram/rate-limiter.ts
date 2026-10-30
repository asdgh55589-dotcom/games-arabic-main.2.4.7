/**
 * lib/telegram/rate-limiter.ts — In-memory rate limiter for Telegram sends.
 */

interface WindowCounter {
  count: number
  resetAt: number
}

interface ChatState {
  sec: WindowCounter
  min: WindowCounter
}

const chatStates = new Map<string, ChatState>()
let globalSec: WindowCounter = { count: 0, resetAt: 0 }

const SEC_MS = 1000
const MIN_MS = 60_000

const PER_CHAT_SEC_LIMIT = 1
const PER_CHAT_MIN_LIMIT = 20
const GLOBAL_SEC_LIMIT = 30

function now(): number {
  return Date.now()
}

function freshWindow(windowMs: number, t: number): WindowCounter {
  return { count: 0, resetAt: t + windowMs }
}

function ensureChat(chatId: string, t: number): ChatState {
  let state = chatStates.get(chatId)
  if (!state) {
    state = {
      sec: freshWindow(SEC_MS, t),
      min: freshWindow(MIN_MS, t),
    }
    chatStates.set(chatId, state)
  }
  return state
}

export function checkRateLimit(chatId: string): { allowed: boolean; retryAfter?: number } {
  try {
    const t = now()
    const key = String(chatId)
    const state = ensureChat(key, t)

    // reset expired windows
    if (t >= state.sec.resetAt) {
      state.sec = freshWindow(SEC_MS, t)
    }
    if (t >= state.min.resetAt) {
      state.min = freshWindow(MIN_MS, t)
    }
    if (t >= globalSec.resetAt) {
      globalSec = freshWindow(SEC_MS, t)
    }

    // check limits
    const retries: number[] = []
    if (state.sec.count >= PER_CHAT_SEC_LIMIT) {
      retries.push(state.sec.resetAt - t)
    }
    if (state.min.count >= PER_CHAT_MIN_LIMIT) {
      retries.push(state.min.resetAt - t)
    }
    if (globalSec.count >= GLOBAL_SEC_LIMIT) {
      retries.push(globalSec.resetAt - t)
    }

    if (retries.length > 0) {
      const waitMs = Math.max(...retries)
      const retryAfter = Math.max(1, Math.ceil(waitMs / 1000))
      return { allowed: false, retryAfter }
    }

    // increment
    state.sec.count++
    state.min.count++
    globalSec.count++
    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}

export function resetRateLimitState(): void {
  chatStates.clear()
  globalSec = { count: 0, resetAt: 0 }
}
