import { forbidden, internalError, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { getImageWorkerDomain, isImageWorkerConfigured } from '@/lib/image-worker'

export interface WorkerHealthResponse {
  ok: boolean
  cache: 'available' | 'unavailable' | 'unconfigured'
  configured: boolean
}

async function probeWorker(domain: string): Promise<WorkerHealthResponse> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`https://${domain}/__health`, { signal: controller.signal })
    clearTimeout(timeout)
    if (res.ok) {
      return { ok: true, cache: 'available', configured: true }
    }
    return { ok: false, cache: 'unavailable', configured: true }
  } catch {
    return { ok: false, cache: 'unavailable', configured: true }
  }
}

export async function GET() {
  try {
    await requireModerator()

    if (!isImageWorkerConfigured()) {
      return ok({ ok: false, cache: 'unconfigured', configured: false } satisfies WorkerHealthResponse)
    }

    const domain = getImageWorkerDomain()
    const result = await probeWorker(domain)
    return ok(result)
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return forbidden('ليس لديك صلاحية عرض حالة العامل')
    }
    console.error('[WorkerHealth] فشل:', error)
    return internalError('فشل التحقق من حالة العامل')
  }
}
