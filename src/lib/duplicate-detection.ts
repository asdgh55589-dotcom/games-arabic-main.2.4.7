import { db } from './db'

export interface DuplicateCheck {
  gameId: string
  teamId?: string
  title: string
  titleAr: string
  fileHash?: string
  excludeModId?: string
}

export interface DuplicateMatch {
  modId: string
  modTitle: string
  matchType: 'exact' | 'similar_name' | 'file_hash'
  similarity: number
}

export interface DuplicateResult {
  isDuplicate: boolean
  confidence: number
  matches: DuplicateMatch[]
}

// ===== Arabic Text Normalization =====

const TASHKEEL_REGEX =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g
const ALEF_VARIANTS = /[أإآ]/g
const YA_VARIANTS = /[ى]/g
const DAMMA = /ـ/g

export function normalizeArabic(text: string): string {
  return text
    .trim()
    .replace(TASHKEEL_REGEX, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(YA_VARIANTS, 'ي')
    .replace(DAMMA, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// ===== Levenshtein Distance =====

function levenshteinDistance(a: string, b: string): number {
  const lenA = a.length
  const lenB = b.length

  if (lenA === 0) return lenB
  if (lenB === 0) return lenA

  const matrix: number[][] = Array.from({ length: lenA + 1 }, () =>
    Array.from({ length: lenB + 1 }, () => 0),
  )

  for (let i = 0; i <= lenA; i++) matrix[i][0] = i
  for (let j = 0; j <= lenB; j++) matrix[0][j] = j

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[lenA][lenB]
}

function calculateSimilarity(a: string, b: string): number {
  const dist = levenshteinDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 100
  return Math.round((1 - dist / maxLen) * 100)
}

// ===== Simple Hash (no crypto dependency) =====

export function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// ===== Duplicate Detection =====

export async function checkForDuplicates(check: DuplicateCheck): Promise<DuplicateResult> {
  const matches: DuplicateMatch[] = []
  const normalizedTitle = normalizeArabic(check.title)
  const normalizedTitleAr = normalizeArabic(check.titleAr)

  // 1. Exact match: same game + same team + same title
  const exactMatches = await db.mod.findMany({
    where: {
      gameId: check.gameId,
      ...(check.teamId ? { teamId: check.teamId } : {}),
      ...(check.excludeModId ? { id: { not: check.excludeModId } } : {}),
    },
    select: { id: true, name: true, arabicTitle: true },
  })

  for (const mod of exactMatches) {
    const modNormalized = normalizeArabic(mod.name)
    const modArNormalized = normalizeArabic(mod.arabicTitle || '')

    if (
      modNormalized === normalizedTitle ||
      (modArNormalized && modArNormalized === normalizedTitleAr)
    ) {
      matches.push({
        modId: mod.id,
        modTitle: mod.name,
        matchType: 'exact',
        similarity: 100,
      })
    }
  }

  // 2. Name similarity: Levenshtein > 80%
  const similarMods = await db.mod.findMany({
    where: {
      gameId: check.gameId,
      ...(check.excludeModId ? { id: { not: check.excludeModId } } : {}),
    },
    select: { id: true, name: true, arabicTitle: true },
  })

  for (const mod of similarMods) {
    const alreadyMatched = matches.some((m) => m.modId === mod.id)
    if (alreadyMatched) continue

    const modNormalized = normalizeArabic(mod.name)
    const modArNormalized = normalizeArabic(mod.arabicTitle || '')

    const nameSimilarity = calculateSimilarity(normalizedTitle, modNormalized)
    const arSimilarity = modArNormalized
      ? calculateSimilarity(normalizedTitleAr, modArNormalized)
      : 0

    const bestSimilarity = Math.max(nameSimilarity, arSimilarity)

    if (bestSimilarity > 80) {
      matches.push({
        modId: mod.id,
        modTitle: mod.name,
        matchType: 'similar_name',
        similarity: bestSimilarity,
      })
    }
  }

  // 3. File hash match (if provided)
  if (check.fileHash) {
    const hashMatches = await db.mod.findMany({
      where: {
        files: {
          some: {
            description: { contains: check.fileHash },
          },
        },
        ...(check.excludeModId ? { id: { not: check.excludeModId } } : {}),
      },
      select: { id: true, name: true },
    })

    for (const mod of hashMatches) {
      const alreadyMatched = matches.some((m) => m.modId === mod.id)
      if (alreadyMatched) continue

      matches.push({
        modId: mod.id,
        modTitle: mod.name,
        matchType: 'file_hash',
        similarity: 100,
      })
    }
  }

  // Calculate overall confidence
  const maxConfidence = matches.length > 0 ? Math.max(...matches.map((m) => m.similarity)) : 0

  return {
    isDuplicate: matches.length > 0,
    confidence: maxConfidence,
    matches: matches.sort((a, b) => b.similarity - a.similarity),
  }
}
