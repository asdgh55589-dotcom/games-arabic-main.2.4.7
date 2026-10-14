/**
 * templates-api — طبقة جلب لقوالب الإشعارات (تبويب P3) في صفحة قوالب تليجرام.
 *
 * هذه المسارات موجودة فعلاً في الأساس (`/api/admin/templates/*` — دورة حياة P3)،
 * لذا لا حاجة لمخزن محلي هنا: الفشل يظهر كخطأ عربي في الواجهة.
 */

import { SocialApiError } from '../posts/social-api'

export interface NotificationTemplate {
  id: string
  type: string
  channel: string
  titleTemplate: string
  bodyTemplate: string
  richBodyTemplate?: string | null
  parseMode?: string | null
  variables: string[]
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export interface TemplateIssue {
  field?: string
  code?: string
  message: string
  severity?: string
}

export interface TemplateValidationResult {
  ok: boolean
  issues: TemplateIssue[]
  metrics?: { renderedLength?: number; chunks?: number; withinLimit?: boolean }
  channel?: string
  sampleVariables?: Record<string, unknown>
}

export interface TemplatePreviewResult {
  title: string
  body: string
  html?: string
  sampleVariables: Record<string, unknown>
  matrix?: unknown
}

export interface TemplateVersion {
  version: number
  titleTemplate: string
  bodyTemplate: string
  richBodyTemplate?: string | null
  parseMode?: string | null
  isActive: boolean
  createdAt?: string
  changeNote?: string | null
}

export interface TemplateAuditEvent {
  id?: string
  action: string
  userId?: string | null
  username?: string | null
  details?: string | null
  createdAt: string
}

const FALLBACK_AR = 'تعذّر إتمام العملية'

function isJson(res: Response): boolean {
  return (res.headers.get('content-type') || '').includes('application/json')
}

function messageOf(json: any, status: number): string {
  const raw = typeof json?.error?.message === 'string' ? json.error.message.trim() : ''
  if (raw && /[\u0600-\u06FF]/.test(raw)) return raw
  if (status === 401) return 'سجّل الدخول أولاً'
  if (status === 403) return 'غير مصرح — إدارة القوالب للمديرين فقط'
  if (status === 404) return 'القالب غير موجود'
  if (status === 409) return 'تعارض — يوجد قالب بنفس التركيبة بالفعل'
  if (status === 422) return 'بيانات غير صالحة — راجع الحقول المدخلة'
  if (status === 500 || status === 502 || status === 503)
    return 'حدث خطأ في الخادم — أعد المحاولة لاحقاً'
  return FALLBACK_AR
}

async function call(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<{ res: Response; json: any }> {
  let res: Response
  try {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }
    let body = init?.body
    if (init?.json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(init.json)
    }
    res = await fetch(path, { ...init, headers, body, cache: 'no-store' })
  } catch {
    throw new SocialApiError(0, 'تعذّر الاتصال بالخادم — تحقق من اتصالك')
  }
  let json: any = null
  if (isJson(res)) {
    try {
      json = await res.json()
    } catch {
      json = null
    }
  }
  return { res, json }
}

async function okCall<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { res, json } = await call(path, init)
  if (!res.ok)
    throw new SocialApiError(res.status, messageOf(json, res.status), json?.error?.details)
  return (json?.data ?? json ?? null) as T
}

/** قائمة قوالب إشعارات تليجرام (`GET /api/admin/templates?channel=telegram`). */
export async function listTelegramTemplates(): Promise<NotificationTemplate[]> {
  const { res, json } = await call('/api/admin/templates?channel=telegram&limit=200')
  if (!res.ok) throw new SocialApiError(res.status, messageOf(json, res.status))
  const d = json?.data
  if (Array.isArray(d)) return d as NotificationTemplate[]
  if (Array.isArray(d?.templates)) return d.templates as NotificationTemplate[]
  return []
}

/** تحقق المحتوى — 422 يعود كنتائج مشاكل عربية لا كاستثناء (§إجراءات #3). */
export async function validateTemplate(
  id: string,
  overrides?: Record<string, unknown>,
): Promise<TemplateValidationResult> {
  const { res, json } = await call(`/api/admin/templates/${encodeURIComponent(id)}/validate`, {
    method: 'POST',
    json: overrides ?? {},
  })
  if (res.ok) return (json?.data ?? { ok: true, issues: [] }) as TemplateValidationResult
  const details = json?.error?.details as { issues?: TemplateIssue[]; metrics?: any } | undefined
  if (details?.issues) {
    return {
      ok: false,
      issues: details.issues,
      ...(details.metrics ? { metrics: details.metrics } : {}),
    }
  }
  throw new SocialApiError(res.status, messageOf(json, res.status), details)
}

export async function previewTemplate(
  id: string,
  variables?: Record<string, unknown>,
): Promise<TemplatePreviewResult> {
  return okCall<TemplatePreviewResult>(`/api/admin/templates/${encodeURIComponent(id)}/preview`, {
    method: 'POST',
    json: variables ? { variables } : {},
  })
}

export async function cloneTemplate(
  id: string,
  payload?: Record<string, unknown>,
): Promise<NotificationTemplate> {
  return okCall<NotificationTemplate>(`/api/admin/templates/${encodeURIComponent(id)}/clone`, {
    method: 'POST',
    json: payload ?? {},
  })
}

export async function publishTemplate(
  id: string,
  changeNote?: string,
): Promise<NotificationTemplate> {
  return okCall<NotificationTemplate>(`/api/admin/templates/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    json: changeNote ? { changeNote } : {},
  })
}

export async function testSendTemplate(
  id: string,
  destinationId: string,
): Promise<{ delivered?: boolean; messageId?: number | null }> {
  return okCall(`/api/admin/templates/${encodeURIComponent(id)}/test-send`, {
    method: 'POST',
    json: { destinationId },
  })
}

export async function listTemplateVersions(id: string): Promise<TemplateVersion[]> {
  const data = await okCall<{ versions?: TemplateVersion[] }>(
    `/api/admin/templates/${encodeURIComponent(id)}/versions`,
  )
  return Array.isArray(data?.versions) ? data.versions : []
}

export async function rollbackTemplate(id: string, version: number): Promise<unknown> {
  return okCall(`/api/admin/templates/${encodeURIComponent(id)}/rollback`, {
    method: 'POST',
    json: { version },
  })
}

export async function listTemplateAudit(id: string): Promise<TemplateAuditEvent[]> {
  const data = await okCall<{ events?: TemplateAuditEvent[] }>(
    `/api/admin/templates/${encodeURIComponent(id)}/audit`,
  )
  return Array.isArray(data?.events) ? data.events : []
}
