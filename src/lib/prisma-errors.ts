import { Prisma } from '@prisma/client'
import { reportError } from '@/lib/error-reporting'

export interface PrismaErrorResult {
  message: string
  status: number
  code: string
}

export interface HandlePrismaErrorOptions {
  /**
   * Route-specific Arabic fallback used when the error is NOT a recognised
   * Prisma error. Keeps pre-existing, deliberately-worded messages (e.g.
   * 'فشل تعديل التعليق') instead of collapsing every path to one generic
   * string. Prisma errors always use their precise translation.
   */
  fallbackMessage?: string
}

const GENERIC_500 = 'حدث خطأ داخلي في الخادم'

/**
 * Central translator for Prisma errors → safe Arabic messages + HTTP status.
 * Never leaks raw Prisma messages (which may expose DB internals) to clients.
 * Unknown errors are logged (reportError → Sentry) and surfaced as a generic 500
 * (or the caller-provided Arabic fallback).
 */
export function handlePrismaError(
  error: unknown,
  options: HandlePrismaErrorOptions = {},
): PrismaErrorResult {
  const fallback = options.fallbackMessage ?? GENERIC_500
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return { message: 'هذه البيانات مسجلة بالفعل', status: 409, code: 'P2002' }
      case 'P2025':
        return { message: 'العنصر المطلوب غير موجود', status: 404, code: 'P2025' }
      case 'P2003':
        return { message: 'لا يمكن إتمام العملية لارتباطها بعناصر أخرى', status: 400, code: 'P2003' }
      case 'P1001':
      case 'P1017':
        reportError(error, { route: 'prisma', action: `conn:${error.code}` })
        return { message: 'تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقاً', status: 503, code: error.code }
      default:
        reportError(error, { route: 'prisma', action: `known:${error.code}` })
        return { message: fallback, status: 500, code: error.code }
    }
  }

  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    code === 'P1001' ||
    code === 'P1017'
  ) {
    reportError(error, { route: 'prisma', action: 'init' })
    return { message: 'تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقاً', status: 503, code: 'P1001' }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    reportError(error, { route: 'prisma', action: 'unknown' })
    return { message: fallback, status: 500, code: 'P_UNKNOWN' }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { message: 'بيانات غير صالحة', status: 400, code: 'P_VALIDATION' }
  }

  reportError(error, { route: 'prisma', action: 'unhandled' })
  return { message: fallback, status: 500, code: 'P_INTERNAL' }
}
