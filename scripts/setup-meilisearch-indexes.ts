// Idempotent Meilisearch index setup (no-op if MEILISEARCH_HOST empty)
import { isMeiliEnabled } from '@/lib/meilisearch/client'
import { setupIndexes } from '@/lib/meilisearch/indexes'

async function main() {
  if (!isMeiliEnabled()) {
    console.log('[meili:setup] Meilisearch not configured — skipping')
    return
  }
  await setupIndexes()
  console.log('[meili:setup] indexes ready: mods, games, teams, users')
}

main().catch((err) => {
  console.error('[meili:setup] failed:', err)
  process.exit(1)
})
