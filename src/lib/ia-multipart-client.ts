/**
 * IA SAFE-multipart BROWSER client (no secrets — only our own /api/ia/*
 * session endpoints; the LOW key never leaves the server).
 *
 * Flow: initiate → PUT 5MB parts (md5 per part, journal resume) →
 * complete (server polls metadata) / abort. Pause = stop after the
 * in-flight part; resume = re-read status, upload missing parts only.
 */
import { md5Hex } from './md5'

export const IA_PART_SIZE = 5 * 1024 * 1024
export const IA_MAX_PARTS = 1000

export interface PartPlan {
  partNumber: number
  offset: number
  length: number
}

/** Split totalBytes into ≤5MB parts (1-based part numbers). */
export function planParts(totalBytes: number, partSize = IA_PART_SIZE): { totalParts: number; parts: PartPlan[] } {
  const totalParts = Math.max(1, Math.ceil(totalBytes / partSize))
  const parts: PartPlan[] = []
  for (let n = 1; n <= totalParts; n++) {
    const offset = (n - 1) * partSize
    parts.push({ partNumber: n, offset, length: Math.min(partSize, totalBytes - offset) })
  }
  return { totalParts, parts }
}

export interface MultipartProgress {
  bytesUploaded: number
  bytesTotal: number
  partsDone: number
  totalParts: number
}

export interface MultipartController {
  /** Resolve when every part is stored (journal complete happens server-side via complete()). */
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  abort: () => Promise<void>
  sessionId: string
}

interface ControllerDeps {
  fetchFn?: typeof fetch
  onProgress?: (p: MultipartProgress) => void
}

/**
 * Drive one multipart session. `file` is sliced (never fully buffered);
 * each part is hashed with the vendored md5 and streamed to /api/ia/part.
 * Pause takes effect between parts; resume re-reads the journal so no
 * uploaded part is ever re-sent.
 */
export function createMultipartController(
  file: Blob,
  session: { sessionId: string; totalParts: number; partSize: number; partsDone: Record<string, string> },
  deps: ControllerDeps = {},
): MultipartController {
  const doFetch = deps.fetchFn ?? fetch
  let paused = false
  let aborted = false
  let bytesUploaded = uploadedBytes(session.partsDone, session.partSize, file.size)
  const emit = () => {
    deps.onProgress?.({
      bytesUploaded,
      bytesTotal: file.size,
      partsDone: Object.keys(session.partsDone).length,
      totalParts: session.totalParts,
    })
  }

  async function putPart(plan: PartPlan): Promise<void> {
    const chunk = new Uint8Array(await file.slice(plan.offset, plan.offset + plan.length).arrayBuffer())
    const md5 = md5Hex(chunk)
    const res = await doFetch('/api/ia/part', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-ia-session': session.sessionId,
        'x-ia-part': String(plan.partNumber),
        'x-ia-md5': md5,
      },
      body: chunk as BodyInit,
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => '')
      throw new Error(`part ${plan.partNumber} failed (${res.status}) ${msg}`.trim())
    }
    session.partsDone[plan.partNumber] = md5
    bytesUploaded += plan.length
    emit()
  }

  async function run(): Promise<void> {
    const { parts } = planParts(file.size, session.partSize)
    for (const plan of parts) {
      if (aborted) throw new Error('aborted')
      while (paused && !aborted) {
        await new Promise((r) => setTimeout(r, 200))
      }
      if (aborted) throw new Error('aborted')
      if (session.partsDone[plan.partNumber]) continue
      await putPart(plan)
    }
  }

  return {
    sessionId: session.sessionId,
    start: run,
    pause() {
      paused = true
    },
    async resume() {
      // Re-read the journal — another tab/retry may have stored parts.
      const res = await doFetch(`/api/ia/status?session=${encodeURIComponent(session.sessionId)}`)
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as { data?: { parts?: Record<string, string> } } | null
        if (json?.data?.parts) session.partsDone = json.data.parts
      }
      paused = false
      return run()
    },
    async abort() {
      aborted = true
      paused = false
      await doFetch('/api/ia/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      }).catch(() => undefined)
    },
  }
}

function uploadedBytes(partsDone: Record<string, string>, partSize: number, total: number): number {
  const n = Object.keys(partsDone).length
  return Math.min(total, n * partSize)
}
