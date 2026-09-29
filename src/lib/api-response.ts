/**
 * API Response Helpers
 *
 * Standardized response format for all API routes.
 * Usage:
 *   return ok(data)                    // { data }
 *   return okPaginated(data, pagination) // { data, pagination }
 *   return fail('NOT_FOUND', 'msg', 404) // { error: {...}, problem: {...} }
 *   return notFound()                   // convenience
 *
 * Error contract (STRICT — Phase 1 error foundation):
 *   Every error response carries BOTH:
 *   - `error`:   legacy envelope (code/message/details) + requestId + timestamp.
 *                Shape is backward compatible — clients reading error.message
 *                or error.code keep working.
 *   - `problem`: RFC 7807 problem details (additive, new field).
 *
 * Security: NEVER pass raw err.message into fail()/internalError() on 500s.
 * Log server-side (logger/reportError), return a generic message to clients.
 */

import { NextResponse } from 'next/server'

// ===== Types =====

export interface ApiResponseSuccess<T> {
  data: T
}

export interface ApiResponsePaginated<T> {
  data: T
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/** RFC 7807 — Problem Details for HTTP APIs (additive layer). */
export interface ProblemDetails {
  type: string // URI reference, e.g. "/errors/validation-failed"
  title: string // Short, human-readable summary
  status: number // HTTP status code (mirrors the response status)
  detail: string // Detailed explanation (safe for production)
  instance?: string // Specific occurrence — usually the request path
}

export interface ApiResponseError {
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
    timestamp?: string
  }
  problem?: ProblemDetails
}

// ===== Success Helpers =====

/** Wrap a single resource in { data } */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json<ApiResponseSuccess<T>>({ data }, init)
}

/** Wrap a paginated list in { data, pagination } */
export function okPaginated<T>(
  data: T,
  pagination: { page: number; limit: number; total: number; totalPages: number },
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json<ApiResponsePaginated<T>>({ data, pagination }, init)
}

/** Wrap a paginated list with extra metadata */
export function okPaginatedWithMeta<T>(
  data: T,
  pagination: { page: number; limit: number; total: number; totalPages: number },
  meta: Record<string, unknown>,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json({ data, pagination, meta }, init)
}

// ===== Error Helpers =====

/**
 * Edge + Node safe request ID. Prefers Web Crypto (available in Edge and
 * Node 19+), falls back to a timestamped random ID.
 */
function getRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `req-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  }
}

/**
 * Build RFC 7807 problem details from an internal error code.
 * `type` is derived deterministically: VALIDATION_ERROR → /errors/validation-error
 */
export function buildProblem(
  code: string,
  title: string,
  status: number,
  detail: string,
  instance?: string,
): ProblemDetails {
  const slug =
    code
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'error'
  const problem: ProblemDetails = {
    type: `/errors/${slug}`,
    title,
    status,
    detail,
  }
  if (instance) problem.instance = instance
  return problem
}

/** Create a standardized error response ({ error } + RFC 7807 { problem }). */
export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
  requestId?: string,
  instance?: string,
): NextResponse {
  const rid = requestId ?? getRequestId()
  return NextResponse.json<ApiResponseError>(
    {
      error: {
        code,
        message,
        details,
        requestId: rid,
        timestamp: new Date().toISOString(),
      },
      problem: buildProblem(code, message, status, message, instance),
    },
    { status },
  )
}

/** 404 — Resource not found */
export const notFound = (msg = 'Resource not found', instance?: string) =>
  fail('NOT_FOUND', msg, 404, undefined, undefined, instance)

/** 401 — Not authenticated */
export const unauthorized = (msg = 'Unauthorized', instance?: string) =>
  fail('UNAUTHORIZED', msg, 401, undefined, undefined, instance)

/** 403 — Insufficient permissions */
export const forbidden = (msg = 'Forbidden', instance?: string) =>
  fail('FORBIDDEN', msg, 403, undefined, undefined, instance)

/** 422 — Validation failed (ALWAYS 422, never 400 for validation errors) */
export const validationFail = (details?: unknown, instance?: string) =>
  fail('VALIDATION_ERROR', 'Invalid input', 422, details, undefined, instance)

/** 429 — Rate limited. ALWAYS includes Retry-After (default 60s). */
export const rateLimited = (
  msg = 'طلبات كثيرة جداً، انتظر قليلاً وحاول مجدداً',
  retryAfterSeconds = 60,
  instance?: string,
) => {
  const res = fail('RATE_LIMITED', msg, 429, undefined, undefined, instance)
  res.headers.set('Retry-After', String(Math.max(1, Math.floor(retryAfterSeconds))))
  return res
}

/** 429 — Account temporarily locked after repeated failures (Phase 4A). */
export function accountLocked(
  message: string,
  retryAfterSeconds: number,
  instance?: string,
): NextResponse {
  const res = fail('ACCOUNT_LOCKED', message, 429, undefined, undefined, instance)
  res.headers.set('Retry-After', String(Math.max(1, Math.floor(retryAfterSeconds))))
  return res
}

/** 409 — Resource conflict */
export const conflict = (msg = 'Resource already exists', instance?: string) =>
  fail('CONFLICT', msg, 409, undefined, undefined, instance)

/**
 * 500 — Internal server error.
 * NEVER pass raw err.message here — pass a curated safe message (or nothing)
 * and log the real error server-side with logger/reportError.
 */
export const internalError = (msg = 'Internal server error', requestId?: string, instance?: string) =>
  fail('INTERNAL_ERROR', msg, 500, undefined, requestId, instance)
