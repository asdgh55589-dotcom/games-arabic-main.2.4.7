// POST /api/ai/structure — structures pasted raw mod text into form
// fields via Gemini (PC platform only for now).
// Auth: creator studio roles. Rate limited per user. The Gemini key
// never leaves the server.

import type { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import {
  PC_RESPONSE_SCHEMA,
  PC_STRUCTURE_FIELDS,
  PC_STRUCTURE_MODEL,
  PC_SYSTEM_PROMPT,
} from '@/lib/ai/pc-structure-prompt'

const MAX_TEXT = 15000

export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  // 10 structurings/hour per user (AI quota guard).
  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `ai:structure:${user.id}`,
  })
  if (limited) return limited

  let body: { text?: unknown; platform?: unknown }
  try {
    body = await req.json()
  } catch {
    return validationFail('بيانات غير صالحة')
  }

  if (body.platform !== 'PC') {
    return validationFail('التعبئة الذكية متاحة حالياً لمنصة PC فقط')
  }
  const raw = typeof body.text === 'string' ? body.text.trim() : ''
  if (raw.length < 10) {
    return validationFail('النص قصير جداً — الصق بيانات التعريب كاملة')
  }
  if (raw.length > MAX_TEXT) {
    return validationFail('النص طويل جداً (الحد 15000 حرف)')
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return internalError('خدمة الذكاء الاصطناعي غير مهيأة')
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: PC_STRUCTURE_MODEL,
      systemInstruction: PC_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        // Strip readonly tuples so the type matches the SDK schema shape.
        responseSchema: JSON.parse(JSON.stringify(PC_RESPONSE_SCHEMA)),
      },
    })
    const result = await model.generateContent(raw)
    const parsed: unknown = JSON.parse(result.response.text())
    const record = (parsed ?? {}) as Record<string, unknown>
    const data: Record<string, string> = {}
    for (const f of PC_STRUCTURE_FIELDS) {
      data[f] = typeof record[f] === 'string' ? (record[f] as string) : ''
    }
    return ok(data)
  } catch {
    return internalError('فشل الاتصال بخدمة الذكاء الاصطناعي — حاول مجدداً')
  }
}
