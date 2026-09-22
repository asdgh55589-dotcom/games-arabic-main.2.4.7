// POST /api/ai/structure — AI text tools (PC platform).
// mode 'structure': pasted raw mod text → the 8 PC form fields.
// mode 'polish': any pasted text → improved text (no fields).
// Auth: creator studio roles. Rate limited per user. The Gemini key
// never leaves the server.

import type { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import {
  buildResponseSchema,
  buildStructurePrompt,
  PC_STRUCTURE_FIELDS,
  PC_STRUCTURE_MODEL,
  PLATFORM_STRUCTURE_FIELDS,
  STRUCTURE_PLATFORMS,
} from '@/lib/ai/pc-structure-prompt'
import {
  POLISH_MODEL,
  POLISH_RESPONSE_SCHEMA,
  POLISH_SYSTEM_PROMPT,
} from '@/lib/ai/polish-prompt'

const MAX_TEXT = 15000

export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  // 10 AI calls/hour per user (quota guard).
  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `ai:usage:${user.id}`,
  })
  if (limited) return limited

  let body: { text?: unknown; platform?: unknown; mode?: unknown }
  try {
    body = await req.json()
  } catch {
    return validationFail('بيانات غير صالحة')
  }

  const mode = body.mode === 'polish' ? 'polish' : 'structure'
  const platformKey = typeof body.platform === 'string' ? body.platform : ''
  if (mode === 'structure' && !STRUCTURE_PLATFORMS.includes(platformKey)) {
    return validationFail('اختر منصة صالحة أولاً')
  }
  const raw = typeof body.text === 'string' ? body.text.trim() : ''
  if (raw.length < 10) {
    return validationFail('النص قصير جداً — الصق النص كاملاً أولاً')
  }
  if (raw.length > MAX_TEXT) {
    return validationFail('النص طويل جداً (الحد 15000 حرف)')
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return internalError('خدمة الذكاء الاصطناعي غير مهيأة')
  }

  const systemPrompt =
    mode === 'polish' ? POLISH_SYSTEM_PROMPT : buildStructurePrompt(platformKey)
  const responseSchema =
    mode === 'polish' ? POLISH_RESPONSE_SCHEMA : buildResponseSchema(platformKey)
  const modelName = mode === 'polish' ? POLISH_MODEL : PC_STRUCTURE_MODEL
  const fields: readonly string[] =
    mode === 'polish'
      ? ['text']
      : (PLATFORM_STRUCTURE_FIELDS[platformKey] ?? PC_STRUCTURE_FIELDS)

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        // Strip readonly tuples so the type matches the SDK schema shape.
        responseSchema: JSON.parse(JSON.stringify(responseSchema)),
      },
    })
    const result = await model.generateContent(raw)
    const parsed: unknown = JSON.parse(result.response.text())
    const record = (parsed ?? {}) as Record<string, unknown>
    const data: Record<string, string> = {}
    for (const f of fields) {
      data[f] = typeof record[f] === 'string' ? (record[f] as string) : ''
    }
    return ok(data)
  } catch {
    return internalError('فشل الاتصال بخدمة الذكاء الاصطناعي — حاول مجدداً')
  }
}
