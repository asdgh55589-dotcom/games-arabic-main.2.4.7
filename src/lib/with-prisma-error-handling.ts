import { NextResponse } from 'next/server'
import { handlePrismaError } from '@/lib/prisma-errors'
import { fail } from '@/lib/api-response'

type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

/**
 * Wraps a route handler with centralized Prisma error handling.
 * Catches PrismaClientKnownRequestError / InitializationError / UnknownRequestError
 * and returns a safe Arabic message + correct HTTP status.
 * Never leaks raw Prisma error messages to the client.
 */
export function withPrismaErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      const { message, status, code } = handlePrismaError(err)
      return fail(code, message, status)
    }
  }
}
