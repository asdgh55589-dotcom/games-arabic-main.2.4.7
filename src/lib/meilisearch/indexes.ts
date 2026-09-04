import { meili } from './client'

export interface IndexDef {
  uid: string
  primaryKey: string
  searchableAttributes: string[]
  filterableAttributes: string[]
  sortableAttributes: string[]
  rankingRules: string[]
  typoTolerance?: { enabled: boolean; minWordSizeForTypos: { oneTypo: number; twoTypos: number } }
}

// NOTE: attribute names below match the denormalized documents built in
// indexer.ts (platform/tier/authorName are flattened from relations —
// Mod itself has no direct platform/tier columns).
export const modsIndex: IndexDef = {
  uid: 'mods',
  primaryKey: 'id',
  searchableAttributes: ['arabicTitle', 'name', 'summary', 'tags', 'series', 'authorName'],
  filterableAttributes: ['platform', 'gameId', 'authorId', 'tier', 'workflowStatus'],
  sortableAttributes: ['downloads', 'createdAt', 'updatedAt'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness', 'downloads:desc'],
  typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
}

// Game has no arabicName column — searchable: name, tagline, category, platform
export const gamesIndex: IndexDef = {
  uid: 'games',
  primaryKey: 'id',
  searchableAttributes: ['name', 'tagline', 'category', 'platform'],
  filterableAttributes: ['platform', 'category', 'featured'],
  sortableAttributes: ['modCount', 'totalDownloads', 'createdAt'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness', 'totalDownloads:desc'],
  typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
}

// Team has no leaderName column — searchable: name, description
export const teamsIndex: IndexDef = {
  uid: 'teams',
  primaryKey: 'id',
  searchableAttributes: ['name', 'description'],
  filterableAttributes: ['isOfficial', 'isFeatured'],
  sortableAttributes: ['modCount', 'createdAt'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness', 'modCount:desc'],
  typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
}

export const usersIndex: IndexDef = {
  uid: 'users',
  primaryKey: 'id',
  searchableAttributes: ['username', 'displayName'],
  filterableAttributes: ['role', 'tier'],
  sortableAttributes: ['createdAt'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
  typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
}

// Setup function (idempotent)
export async function setupIndexes() {
  if (!meili) return
  for (const idx of [modsIndex, gamesIndex, teamsIndex, usersIndex]) {
    await meili.createIndex(idx.uid, { primaryKey: idx.primaryKey }).catch(() => {})
    const index = meili.index(idx.uid)
    await index.updateSearchableAttributes(idx.searchableAttributes)
    await index.updateFilterableAttributes(idx.filterableAttributes)
    await index.updateSortableAttributes(idx.sortableAttributes)
    await index.updateRankingRules(idx.rankingRules)
    if (idx.typoTolerance) await index.updateTypoTolerance(idx.typoTolerance)
  }
}
