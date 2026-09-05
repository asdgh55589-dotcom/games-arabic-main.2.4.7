/**
 * API Response Helpers
 *
 * Standardized response format for all API routes.
 * Usage:
 *   return ok(data)                    // { data }
 *   return okPaginated(data, pagination) // { data, pagination }
 *   return fail('NOT_FOUND', 'msg', 404) // { error: { code, message } }
 *   return notFound()                   // convenience
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

export interface ApiResponseError {
  error: {
    code: string
    message: string
    details?: unknown
  }
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

/** Create a standardized error response */
export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json<ApiResponseError>({ error: { code, message, details } }, { status })
}

/** 404 — Resource not found */
export const notFound = (msg = 'Resource not found') => fail('NOT_FOUND', msg, 404)

/** 401 — Not authenticated */
export const unauthorized = (msg = 'Unauthorized') => fail('UNAUTHORIZED', msg, 401)

/** 403 — Insufficient permissions */
export const forbidden = (msg = 'Forbidden') => fail('FORBIDDEN', msg, 403)

/** 422 — Validation failed */
export const validationFail = (details?: unknown) =>
  fail('VALIDATION_ERROR', 'Invalid input', 422, details)

/** 429 — Rate limited */
export const rateLimited = (msg = 'طلبات كثيرة جداً، انتظر قليلاً وحاول مجدداً') =>
  fail('RATE_LIMITED', msg, 429)

/** 409 — Resource conflict */
export const conflict = (msg = 'Resource already exists') => fail('CONFLICT', msg, 409)

/** 500 — Internal server error */
export const internalError = (msg = 'Internal server error') => fail('INTERNAL_ERROR', msg, 500)
