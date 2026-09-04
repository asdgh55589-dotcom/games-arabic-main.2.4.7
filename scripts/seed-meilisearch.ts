// Bulk seed Meilisearch indexes from Prisma (no-op if MEILISEARCH_HOST empty)
import { isMeiliEnabled } from '@/lib/meilisearch/client'
import {
  seedGamesIndex,
  seedModsIndex,
  seedTeamsIndex,
  seedUsersIndex,
} from '@/lib/meilisearch/indexer'
import { setupIndexes } from '@/lib/meilisearch/indexes'

async function main() {
  if (!isMeiliEnabled()) {
    console.log('[meili:seed] Meilisearch not configured — skipping (Prisma fallback active)')
    return
  }
  await setupIndexes()
  const mods = (await seedModsIndex()) ?? 0
  const games = (await seedGamesIndex()) ?? 0
  const teams = (await seedTeamsIndex()) ?? 0
  const users = (await seedUsersIndex()) ?? 0
  console.log(`[meili:seed] done — mods:${mods} games:${games} teams:${teams} users:${users}`)
}

main().catch((err) => {
  console.error('[meili:seed] failed:', err)
  process.exit(1)
})
