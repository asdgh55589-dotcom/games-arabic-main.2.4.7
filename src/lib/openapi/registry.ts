import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  ChangePasswordSchema,
  CreateCommentSchema,
  CreateModSchema,
  CreateReportSchema,
  LoginSchema,
} from '@/lib/schemas'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  summary: 'Staff login',
  request: {
    body: { content: { 'application/json': { schema: LoginSchema } } },
  },
  responses: {
    200: { description: 'Success' },
    401: { description: 'Invalid credentials' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/change-password',
  summary: 'Change password',
  request: {
    body: { content: { 'application/json': { schema: ChangePasswordSchema } } },
  },
  responses: {
    200: { description: 'Success' },
    401: { description: 'Unauthorized' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/mods',
  summary: 'Create mod',
  request: {
    body: { content: { 'application/json': { schema: CreateModSchema } } },
  },
  responses: {
    201: { description: 'Created' },
    400: { description: 'Validation error' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/comments',
  summary: 'Create comment',
  request: {
    body: { content: { 'application/json': { schema: CreateCommentSchema } } },
  },
  responses: {
    201: { description: 'Created' },
    400: { description: 'Validation error' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/reports',
  summary: 'Create report',
  request: {
    body: { content: { 'application/json': { schema: CreateReportSchema } } },
  },
  responses: {
    201: { description: 'Created' },
    400: { description: 'Validation error' },
  },
})

// Phase 4: expanded coverage — public read endpoints (+ Phase 4 params).
// T1 batch (Phase 2): full query schemas for the heavy reads.
const PaginationQueryShape = {
  page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 24 }),
}

const ModsListQuerySchema = z
  .object({
    ...PaginationQueryShape,
    search: z.string().optional().openapi({ example: 'تعريب' }),
    sort: z
      .enum(['downloads', 'newest', 'rating', 'endorsements', 'tier'])
      .optional()
      .openapi({ example: 'downloads' }),
    platform: z.string().optional().openapi({ example: 'PC' }),
    translationType: z.enum(['official', 'unofficial']).optional(),
    translationTeam: z.string().optional(),
    featured: z.enum(['true', 'false']).optional(),
    trending: z.enum(['true', 'false']).optional(),
    latest: z.enum(['true', 'false']).optional(),
    minTier: z.coerce.number().int().min(1).max(5).optional().openapi({ example: 2 }),
    fields: z.string().optional().openapi({
      description: 'Sparse fieldset (comma-separated allowlisted fields)',
      example: 'name,slug',
    }),
    _links: z
      .enum(['true'])
      .optional()
      .openapi({ description: 'Include HATEOAS _links (or Accept: application/hal+json)' }),
  })
  .openapi('ModsListQuery')

registry.registerPath({
  method: 'get',
  path: '/api/mods',
  summary: 'List published mods (paginated, ETag + sparse + HATEOAS)',
  request: { query: ModsListQuerySchema },
  responses: {
    200: { description: 'Paginated mods ({ data, pagination })' },
    304: { description: 'Not modified (If-None-Match)' },
    400: { description: 'Invalid query (RFC 7807 problem)' },
  },
})

const GamesListQuerySchema = z
  .object({
    ...PaginationQueryShape,
    search: z.string().optional(),
    sort: z.enum(['popular', 'newest', 'name']).optional().openapi({ example: 'popular' }),
    featured: z.enum(['true', 'false']).optional(),
    category: z.string().optional().openapi({ example: 'rpg' }),
    platform: z.string().optional().openapi({ example: 'PC' }),
  })
  .openapi('GamesListQuery')

registry.registerPath({
  method: 'get',
  path: '/api/games',
  summary: 'List games (paginated)',
  request: { query: GamesListQuerySchema },
  responses: {
    200: { description: 'Games list ({ data, pagination })' },
    304: { description: 'Not modified (If-None-Match)' },
    400: { description: 'Invalid query (RFC 7807 problem)' },
  },
})

const SearchQuerySchema = z
  .object({
    q: z.string().min(1).openapi({ example: 'تعريب' }),
    type: z.enum(['all', 'mods', 'games', 'teams', 'users']).optional().openapi({ example: 'all' }),
    page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(50).optional().openapi({ example: 8 }),
    platform: z.string().optional(),
    gameId: z.string().optional(),
    author: z.string().optional(),
    minTier: z.coerce.number().int().min(0).max(5).optional(),
  })
  .openapi('SearchQuery')

registry.registerPath({
  method: 'get',
  path: '/api/search',
  summary: 'Multi-entity search (mods/games/teams/users)',
  request: { query: SearchQuerySchema },
  responses: {
    200: { description: 'Search results ({ data })' },
    400: { description: 'Missing/invalid q (RFC 7807 problem)' },
  },
})

const NewsQuerySchema = z
  .object({
    type: z.enum(['ticker', 'featured']).optional().openapi({ example: 'ticker' }),
    limit: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 20 }),
  })
  .openapi('NewsQuery')

registry.registerPath({
  method: 'get',
  path: '/api/news',
  summary: 'Active news ticker/featured (ETag, max-age=30)',
  request: { query: NewsQuerySchema },
  responses: {
    200: { description: 'News list ({ data: { news } })' },
    304: { description: 'Not modified (If-None-Match)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/series',
  summary: 'List all series (ETag, max-age=300)',
  request: { query: z.object({ ...PaginationQueryShape }).openapi('SeriesQuery') },
  responses: {
    200: { description: 'Series list ({ data })' },
    304: { description: 'Not modified (If-None-Match)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/teams',
  summary: 'List translation teams (ETag, max-age=300)',
  request: { query: z.object({ ...PaginationQueryShape }).openapi('TeamsQuery') },
  responses: {
    200: { description: 'Teams list ({ data })' },
    304: { description: 'Not modified (If-None-Match)' },
  },
})

// ---- Phase 2 batch T1+T2: heavy reads + public lists (new paths) ----
const GameModsQuerySchema = z
  .object({
    ...PaginationQueryShape,
    sort: z
      .enum(['downloads', 'newest', 'rating', 'endorsements'])
      .optional()
      .openapi({ example: 'downloads' }),
    category: z.string().optional(),
    search: z.string().optional(),
    featured: z.enum(['true', 'false']).optional(),
  })
  .openapi('GameModsQuery')

registry.registerPath({
  method: 'get',
  path: '/api/games/{slug}/mods',
  summary: 'List published mods of one game (server Redis cache 60s + ETag)',
  request: {
    params: z.object({ slug: z.string().openapi({ example: 'cyberpunk-2077' }) }),
    query: GameModsQuerySchema,
  },
  responses: {
    200: { description: 'Paginated game mods ({ data, pagination })' },
    304: { description: 'Not modified (If-None-Match)' },
    400: { description: 'Invalid query (RFC 7807 problem)' },
    404: { description: 'Game not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/games/{slug}',
  summary: 'Single game with categories',
  request: { params: z.object({ slug: z.string().openapi({ example: 'cyberpunk-2077' }) }) },
  responses: {
    200: { description: 'Game detail' },
    404: { description: 'Game not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/games/{slug}/categories',
  summary: 'Categories of one game',
  request: { params: z.object({ slug: z.string().openapi({ example: 'cyberpunk-2077' }) }) },
  responses: {
    200: { description: 'Category list' },
    404: { description: 'Game not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/search/trending',
  summary: 'Trending search queries',
  responses: { 200: { description: 'Trending queries ({ data })' } },
})

registry.registerPath({
  method: 'post',
  path: '/api/search/track',
  summary: 'Track a search query (best-effort analytics)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ query: z.string().min(2).max(200).openapi({ example: 'تعريب' }) }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Tracking result ({ tracked })' },
    400: { description: 'Invalid body (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/home',
  summary: 'Aggregated homepage data',
  responses: { 200: { description: 'Homepage sections ({ data })' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/sections',
  summary: 'Active homepage sections',
  responses: { 200: { description: 'Section list' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/users/{username}/full-profile',
  summary: 'Full public profile (user + stats + recent mods)',
  request: {
    params: z.object({ username: z.string().openapi({ example: 'translator-ahmed' }) }),
    query: z
      .object({ limit: z.coerce.number().int().min(1).max(10).optional().openapi({ example: 10 }) })
      .openapi('FullProfileQuery'),
  },
  responses: {
    200: { description: 'Full profile' },
    404: { description: 'User not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/users/{username}/profile',
  summary: 'Public profile card',
  request: { params: z.object({ username: z.string().openapi({ example: 'translator-ahmed' }) }) },
  responses: {
    200: { description: 'Profile card' },
    404: { description: 'User not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/categories',
  summary: 'List all categories',
  responses: { 200: { description: 'Category list' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/stats',
  summary: 'Aggregate site-wide stats (cached 60s)',
  responses: { 200: { description: 'Site stats (games, mods, downloads, endorsements, users)' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/leaderboard/creators',
  summary: 'Top creators by published mods + downloads',
  request: { query: z.object({ ...PaginationQueryShape }).openapi('LeaderboardQuery') },
  responses: { 200: { description: 'Creator ranking ({ data })' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/ads',
  summary: 'Visible homepage ads',
  responses: { 200: { description: 'Ads ({ ads })' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/settings/bootstrap',
  summary: 'Authenticated settings bootstrap (requires session)',
  responses: {
    200: { description: 'User settings + bootstrap data' },
    401: { description: 'Unauthorized' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/mod-requests',
  summary: 'List public mod requests (open + accepted + completed, top 50)',
  responses: { 200: { description: 'Requests ({ requests })' } },
})
registry.registerPath({
  method: 'get',
  path: '/api/mods/{slug}',
  summary: 'Mod detail with neighbors (ETag)',
  request: { params: z.object({ slug: z.string().openapi({ example: 'mod-slug' }) }) },
  responses: {
    200: { description: 'Mod detail' },
    304: { description: 'Not modified (If-None-Match)' },
    404: { description: 'Not found (RFC 7807 problem)' },
  },
})

// ---- Phase 2 batch T3+T4: user reads + creator reads + misc (new paths) ----
// Note: no top-level GET /api/comments exists (only /api/comments/[id] PATCH/DELETE),
// so it is intentionally NOT documented — the batch documents real routes instead.
const UsernameParam = z.object({ username: z.string().openapi({ example: 'translator-ahmed' }) })

registry.registerPath({
  method: 'get',
  path: '/api/users/{username}/activity',
  summary: 'Recent user activity (comments, mods, edits, endorsements)',
  request: {
    params: UsernameParam,
    query: z
      .object({ limit: z.coerce.number().int().min(1).max(50).optional().openapi({ example: 20 }) })
      .openapi('UserActivityQuery'),
  },
  responses: {
    200: { description: 'Activity feed' },
    404: { description: 'User not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/users/{username}/badges',
  summary: 'User badges',
  request: { params: UsernameParam },
  responses: {
    200: { description: 'Badge list ({ badges })' },
    404: { description: 'User not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/users/{username}/level',
  summary: 'User level + tier config + history',
  request: { params: UsernameParam },
  responses: {
    200: { description: 'Level detail' },
    404: { description: 'User not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/users/{username}/tier-progress',
  summary: 'User tier progress',
  request: { params: UsernameParam },
  responses: {
    200: { description: 'Tier progress' },
    404: { description: 'User not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/bookmarks',
  summary: 'Own bookmarks (requires session)',
  responses: {
    200: { description: 'Bookmark list' },
    401: { description: 'Unauthorized' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/bookmarks/check',
  summary: 'Check if a mod is bookmarked (false when anonymous)',
  request: {
    query: z
      .object({ modId: z.string().openapi({ example: 'mod_123' }) })
      .openapi('BookmarkCheckQuery'),
  },
  responses: {
    200: { description: 'Check result ({ bookmarked })' },
    400: { description: 'Missing modId (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/notifications',
  summary: 'Own notifications, paginated (requires session)',
  request: {
    query: z
      .object({
        ...PaginationQueryShape,
        type: z.string().optional(),
        read: z.enum(['true', 'false']).optional(),
      })
      .openapi('NotificationsQuery'),
  },
  responses: {
    200: { description: 'Notification list' },
    401: { description: 'Unauthorized' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/notifications/unread-count',
  summary: 'Unread notification count (0 when anonymous, cached 60s)',
  responses: { 200: { description: 'Count ({ count })' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/notifications/preferences',
  summary: 'Own notification preferences (requires session)',
  responses: {
    200: { description: 'Preferences' },
    401: { description: 'Unauthorized' },
  },
})

const CreatorModsQuerySchema = z
  .object({
    q: z.string().optional(),
    sort: z.string().optional().openapi({ example: 'createdAt' }),
    order: z.enum(['asc', 'desc']).optional().openapi({ example: 'desc' }),
    page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(50).optional().openapi({ example: 20 }),
  })
  .openapi('CreatorModsQuery')

registry.registerPath({
  method: 'get',
  path: '/api/creator/mods',
  summary: 'Own mods for the studio (requires creator role)',
  request: { query: CreatorModsQuerySchema },
  responses: {
    200: { description: 'Own mods, paginated' },
    401: { description: 'Unauthorized' },
    403: { description: 'Creator role required' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/creator/stats',
  summary: 'Studio dashboard stats (requires creator role)',
  responses: {
    200: { description: 'Studio stats' },
    401: { description: 'Unauthorized' },
    403: { description: 'Creator role required' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/creator/analytics',
  summary: 'Studio analytics history (requires creator role)',
  request: {
    query: z
      .object({
        range: z.coerce.number().int().min(1).max(365).optional().openapi({ example: 30 }),
      })
      .openapi('CreatorAnalyticsQuery'),
  },
  responses: {
    200: { description: 'Analytics history' },
    401: { description: 'Unauthorized' },
    403: { description: 'Creator role required' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/creator/comments',
  summary: 'Comments on own mods (requires creator role)',
  request: { query: z.object({ ...PaginationQueryShape }).openapi('CreatorCommentsQuery') },
  responses: {
    200: { description: 'Comment list' },
    401: { description: 'Unauthorized' },
    403: { description: 'Creator role required' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/creator/files',
  summary: 'Own uploaded files (requires creator role)',
  request: {
    query: z
      .object({
        ...PaginationQueryShape,
        provider: z.string().optional(),
        type: z.string().optional(),
        search: z.string().optional(),
        modId: z.string().optional(),
      })
      .openapi('CreatorFilesQuery'),
  },
  responses: {
    200: { description: 'File list' },
    401: { description: 'Unauthorized' },
    403: { description: 'Creator role required' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/creator/team/stats',
  summary: 'Translation-team stats (requires creator role)',
  responses: {
    200: { description: 'Team stats' },
    401: { description: 'Unauthorized' },
    403: { description: 'Creator role required' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/creator/requests',
  summary: 'Mod requests relevant to the creator (requires creator role)',
  request: { query: z.object({ ...PaginationQueryShape }).openapi('CreatorRequestsQuery') },
  responses: {
    200: { description: 'Request list' },
    401: { description: 'Unauthorized' },
    403: { description: 'Creator role required' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  summary: 'Current session user (cached 60s server-side, private no-store)',
  responses: {
    200: { description: 'Session user' },
    401: { description: 'Unauthorized' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Liveness probe (dependency-free, no rate-limit headers by design)',
  responses: { 200: { description: 'Liveness ({ status, time })' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/teams/{slug}',
  summary: 'Single translation team with stats',
  request: { params: z.object({ slug: z.string().openapi({ example: 'arabic-team' }) }) },
  responses: {
    200: { description: 'Team detail' },
    404: { description: 'Team not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/series/mods',
  summary: 'Mods of one series (paginated)',
  request: {
    query: z
      .object({
        ...PaginationQueryShape,
        series: z.string().openapi({ example: 'final-fantasy' }),
        search: z.string().optional(),
        sort: z.enum(['downloads', 'newest', 'rating', 'endorsements']).optional(),
        translationType: z.enum(['official', 'unofficial']).optional(),
      })
      .openapi('SeriesModsQuery'),
  },
  responses: {
    200: { description: 'Paginated series mods' },
    400: { description: 'Invalid query (RFC 7807 problem)' },
    404: { description: 'Series not found (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/mod-requests/search',
  summary: 'Quick search over open mod requests (top 5)',
  request: {
    query: z
      .object({ q: z.string().min(2).openapi({ example: 'elden' }) })
      .openapi('ModRequestSearchQuery'),
  },
  responses: {
    200: { description: 'Matching requests ({ requests })' },
    400: { description: 'Query too short (RFC 7807 problem)' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/download-settings',
  summary: 'Public download trust settings (PUT is admin-only)',
  responses: { 200: { description: 'Trust settings ({ services, warningMessage })' } },
})

const generator = new OpenApiGeneratorV3(registry.definitions)

export function getOpenApiSpec() {
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: 'Games Arabic API', version: '1.0.0' },
  })
}
