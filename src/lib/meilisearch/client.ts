import { Meilisearch } from 'meilisearch'

const host = process.env.MEILISEARCH_HOST
const key = process.env.MEILISEARCH_MASTER_KEY

export const meili = host && key ? new Meilisearch({ host, apiKey: key }) : null // null = fallback to Prisma

export function isMeiliEnabled(): boolean {
  return meili !== null
}

// Health check with timeout
export async function meiliHealth(): Promise<boolean> {
  if (!meili) return false
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2000)
    // meilisearch client has no signal param on health(); race it instead
    await Promise.race([
      meili.health().finally(() => clearTimeout(t)),
      new Promise<never>((_, reject) => {
        ctrl.signal.addEventListener('abort', () => reject(new Error('timeout')))
      }),
    ])
    return true
  } catch {
    return false
  }
}
