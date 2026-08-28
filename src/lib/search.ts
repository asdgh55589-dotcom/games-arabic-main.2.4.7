import { db } from './db'
import { normalizeArabic } from './duplicate-detection'

export type SearchEntityType = 'mod' | 'game' | 'team' | 'user' | 'all'

export interface SearchFilters {
  type?: SearchEntityType
  platform?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

export interface SearchResult {
  id: string
  type: 'mod' | 'game' | 'team' | 'user'
  title: string
  subtitle: string
  url: string
  highlight: string
  metadata: Record<string, any>
  relevance: number
}

export interface SearchResponse {
  results: SearchResult[]
  counts: Record<string, number>
  total: number
}

function calculateRelevance(text: string, query: string): number {
  const normalizedText = normalizeArabic(text)
  const normalizedQuery = normalizeArabic(query)

  if (normalizedText === normalizedQuery) return 100
  if (normalizedText.startsWith(normalizedQuery)) return 90
  if (normalizedText.includes(normalizedQuery)) return 70

  // Check for partial word matches
  const queryWords = normalizedQuery.split(' ').filter(Boolean)
  const matchedWords = queryWords.filter((w) => normalizedText.includes(w))
  if (matchedWords.length === queryWords.length) return 80
  if (matchedWords.length > 0) return 50

  return 0
}

function highlightText(text: string, query: string): string {
  if (!text || !query) return text
  const normalizedQuery = normalizeArabic(query)
  const normalizedText = normalizeArabic(text)

  const idx = normalizedText.indexOf(normalizedQuery)
  if (idx === -1) return text.slice(0, 100)

  const start = Math.max(0, idx - 30)
  const end = Math.min(text.length, idx + normalizedQuery.length + 30)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'

  return snippet
}

export async function search(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const results: SearchResult[] = []
  const counts: Record<string, number> = { mod: 0, game: 0, team: 0, user: 0 }

  if (!query || query.trim().length < 2) {
    return { results: [], counts, total: 0 }
  }

  const searchType = filters.type || 'all'
  const normalizedQuery = normalizeArabic(query)

  // Search Mods
  if (searchType === 'all' || searchType === 'mod') {
    const mods = await db.mod.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { arabicTitle: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
          { tags: { contains: query, mode: 'insensitive' } },
        ],
        ...(filters.status ? { workflowStatus: filters.status } : {}),
        ...(filters.platform
          ? { game: { platform: filters.platform } }
          : {}),
      },
      include: {
        game: { select: { name: true, platform: true } },
        teamRelation: { select: { name: true } },
      },
      take: 20,
    })

    for (const mod of mods) {
      const title = mod.name
      const subtitle = `${mod.game?.name || ''} ${mod.teamRelation?.name ? '• ' + mod.teamRelation.name : ''}`
      const relevance = calculateRelevance(title, query)
      if (relevance > 0) {
        results.push({
          id: mod.id,
          type: 'mod',
          title: mod.arabicTitle || mod.name,
          subtitle,
          url: `/mods/${mod.slug}`,
          highlight: highlightText(mod.description || mod.summary || mod.name, query),
          metadata: {
            status: mod.workflowStatus,
            downloads: mod.downloads,
            rating: mod.rating,
            platform: mod.game?.platform,
          },
          relevance,
        })
        counts.mod++
      }
    }
  }

  // Search Games
  if (searchType === 'all' || searchType === 'game') {
    const games = await db.game.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
        ...(filters.platform ? { platform: filters.platform } : {}),
      },
      take: 20,
    })

    for (const game of games) {
      const relevance = calculateRelevance(game.name, query)
      if (relevance > 0) {
        results.push({
          id: game.id,
          type: 'game',
          title: game.name,
          subtitle: `${game.platform} • ${game.category}`,
          url: `/games/${game.slug}`,
          highlight: highlightText(game.description, query),
          metadata: {
            platform: game.platform,
            modCount: game.modCount,
            totalDownloads: game.totalDownloads,
          },
          relevance,
        })
        counts.game++
      }
    }
  }

  // Search Teams
  if (searchType === 'all' || searchType === 'team') {
    const teams = await db.team.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    })

    for (const team of teams) {
      const relevance = calculateRelevance(team.name, query)
      if (relevance > 0) {
        results.push({
          id: team.id,
          type: 'team',
          title: team.name,
          subtitle: `${team.modCount} تعريب`,
          url: `/teams/${team.slug}`,
          highlight: highlightText(team.description, query),
          metadata: {
            modCount: team.modCount,
            isOfficial: team.isOfficial,
          },
          relevance,
        })
        counts.team++
      }
    }
  }

  // Search Users
  if (searchType === 'all' || searchType === 'user') {
    const users = await db.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { bio: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        avatarUrl: true,
        role: true,
      },
      take: 20,
    })

    for (const user of users) {
      const relevance = calculateRelevance(user.username, query)
      if (relevance > 0) {
        results.push({
          id: user.id,
          type: 'user',
          title: user.username,
          subtitle: user.email,
          url: `/users/${user.username}`,
          highlight: highlightText(user.bio || '', query),
          metadata: {
            role: user.role,
          },
          relevance,
        })
        counts.user++
      }
    }
  }

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance)

  return {
    results,
    counts,
    total: results.length,
  }
}
