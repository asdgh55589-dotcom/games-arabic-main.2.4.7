import { type NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * مُوثّق موحّد لجميع مسارات cron.
 *
 * يتحقق من رأس Authorization: Bearer <CRON_SECRET> باستخدام
 * مقارنة آمنة ضد هجمات التوقيت (timing-safe compare).
 *
 * @returns null إذا كان التحقق ناجحًا، أو NextResponse خطأ إذا فشل.
 */
export async function requireCronAuth(req: NextRequest): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET غير مُكوَّن على الخادم' },
      { status: 501 },
    )
  }

  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'غير مصرّح — رمز التحقق مفقود' },
      { status: 401 },
    )
  }

  const token = authHeader.slice(7) // Remove 'Bearer '

  const expectedBuf = Buffer.from(secret, 'utf8')
  const tokenBuf = Buffer.from(token, 'utf8')

  // Ensure buffers are same length for timingSafeEqual; pad shorter one
  if (expectedBuf.length !== tokenBuf.length) {
    // Create a copy of expectedBuf padded to the longer length
    // but compare anyway to keep timing consistent
    const maxLen = Math.max(expectedBuf.length, tokenBuf.length)
    const paddedExpected = Buffer.alloc(maxLen, 0)
    const paddedToken = Buffer.alloc(maxLen, 0)
    expectedBuf.copy(paddedExpected)
    tokenBuf.copy(paddedToken)
    const match = crypto.timingSafeEqual(paddedExpected, paddedToken)
    if (!match) {
      return NextResponse.json(
        { error: 'غير مصرّح — رمز التحقق غير صالح' },
        { status: 401 },
      )
    }
    // Lengths differ → not a match even though timingSafeEqual passed
    // (different lengths padded with zeros would compare equal)
    return NextResponse.json(
      { error: 'غير مصرّح — رمز التحقق غير صالح' },
      { status: 401 },
    )
  }

  const match = crypto.timingSafeEqual(expectedBuf, tokenBuf)

  if (!match) {
    return NextResponse.json(
      { error: 'غير مصرّح — رمز التحقق غير صالح' },
      { status: 401 },
    )
  }

  return null // ناجح — لا يوجد خطأ
}
