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

const generator = new OpenApiGeneratorV3(registry.definitions)

export function getOpenApiSpec() {
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: 'Games Arabic API', version: '1.0.0' },
  })
}
