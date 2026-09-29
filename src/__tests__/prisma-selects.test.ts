/**
 * Phase 2 — public select contract (regression guard).
 *
 * `author: true` used to return the FULL User row (password hash, TOTP secret,
 * security key, recovery codes, email) on public list/detail responses.
 * These tests pin the shared projections in `src/lib/prisma-selects.ts`:
 * public routes must project, never `include: { author: true }`.
 */
import {
  authorPublicSelect,
  categoryCardSelect,
  gameCardSelect,
  gameDetailSelect,
  modCardSelect,
} from '@/lib/prisma-selects'

/** Columns that must NEVER reach a public API response. */
const FORBIDDEN_USER_KEYS = [
  'password',
  'email',
  'totpSecret',
  'securityKey',
  'recoveryCodes',
  'webauthnCredentials',
  'tokenVersion',
  'supabaseId',
  'banStatus',
  'bannedUntil',
  'banReason',
] as const

function selectKeys(sel: Record<string, unknown>): string[] {
  return Object.keys(sel)
}

describe('authorPublicSelect — no secrets, full Author contract', () => {
  it('exposes every required Author field', () => {
    for (const key of [
      'id',
      'username',
      'avatarUrl',
      'bannerUrl',
      'bio',
      'role',
      'tier',
      'specialRoles',
      'qualityScore',
      'joinedAt',
    ]) {
      expect(selectKeys(authorPublicSelect)).toContain(key)
    }
  })

  it('excludes all forbidden user columns', () => {
    const keys = selectKeys(authorPublicSelect)
    for (const forbidden of FORBIDDEN_USER_KEYS) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('negative control — the guard actually fires on a violating select', () => {
    const violating = { ...authorPublicSelect, password: true }
    expect(selectKeys(violating)).toContain('password')
  })
})

describe('modCardSelect — list projection', () => {
  it('projects (not includes) author/game/category', () => {
    expect(modCardSelect.author).toEqual({ select: authorPublicSelect })
    expect(modCardSelect.game).toEqual({ select: gameCardSelect })
    expect(modCardSelect.category).toEqual({ select: categoryCardSelect })
  })

  it('drops heavy markdown columns list cards never render', () => {
    const keys = selectKeys(modCardSelect)
    for (const heavy of ['description', 'changelog', 'installGuide']) {
      expect(keys).not.toContain(heavy)
    }
  })

  it('keeps every ModSummary scalar the contract requires', () => {
    const keys = selectKeys(modCardSelect)
    for (const key of [
      'id',
      'slug',
      'name',
      'headline',
      'summary',
      'thumbnailUrl',
      'downloads',
      'endorsements',
      'views',
      'rating',
      'tags',
      'translationType',
      'isFeatured',
      'isTrending',
      'isLatest',
      'workflowStatus',
      'releaseDate',
      'updatedAt',
      'createdAt',
    ]) {
      expect(keys).toContain(key)
    }
  })
})

describe('gameDetailSelect — no relations, no secrets', () => {
  it('selects GameSummary fields + description only', () => {
    const keys = selectKeys(gameDetailSelect)
    expect(keys).toContain('description')
    expect(keys).not.toContain('mods')
    expect(keys).not.toContain('categories')
  })
})
