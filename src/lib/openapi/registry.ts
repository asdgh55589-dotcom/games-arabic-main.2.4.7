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
const ModsListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 24 }),
    fields: z
      .string()
      .optional()
      .openapi({ description: 'Sparse fieldset (comma-separated allowlisted fields)', example: 'name,slug' }),
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
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/games',
  summary: 'List games',
  request: { params: z.object({}) },
  responses: { 200: { description: 'Games list ({ data })' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/search',
  summary: 'Multi-entity search (mods/games/teams/users)',
  request: { params: z.object({}) },
  responses: { 200: { description: 'Search results' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/series',
  summary: 'List series',
  request: { params: z.object({}) },
  responses: { 200: { description: 'Series list' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/teams',
  summary: 'List teams',
  request: { params: z.object({}) },
  responses: { 200: { description: 'Teams list' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/news',
  summary: 'Active news ticker/featured',
  request: { params: z.object({}) },
  responses: { 200: { description: 'News list' } },
})

registry.registerPath({
  method: 'get',
  path: '/api/mods/{slug}',
  summary: 'Mod detail with neighbors',
  request: { params: z.object({ slug: z.string().openapi({ example: 'mod-slug' }) }) },
  responses: {
    200: { description: 'Mod detail' },
    404: { description: 'Not found (RFC 7807 problem)' },
  },
})

const generator = new OpenApiGeneratorV3(registry.definitions)

export function getOpenApiSpec() {
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: 'Games Arabic API', version: '1.0.0' },
  })
}
