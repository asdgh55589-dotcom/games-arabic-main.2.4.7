/**
 * social-api — طبقة جلب مُكتوبة محلياً لصفحات W3 (المنشورات + قوالب المنشورات + الوجهات).
 *
 * لماذا طبقة محلية بدل `src/hooks/use-social.ts`؟
 *   W2 يملك `use-social.ts` و W1 يملك `/api/admin/social/*` — كلاهما لم يصلا بعد في هذه
 *   نقطة البناء. الأشكال هنا مطابقة حرفياً لـ §4 من الخطة، وعند وصول W2 تُستبدل طبقة
 *   الاستدعاء فقط (نفس الأنواع) دون تغيير الواجهة.
 *
 * قاعدة «لا ننتظر» (never block):
 *   - مسار غير موجود (404 غير JSON ← Next لم يبني route.js بعد) → سقوط لمخزن محلي
 *     بنفس الأشكال، فيبقى التحرير/العرض/الجدولة تعمل من أول ضغطة.
 *   - خطأ حقيقي من الـ API (409/422/403/JSON) → يُرمى `SocialApiError` برسالة عربية
 *     ليعرضه الصف كخطأ، لا يُبتلع ولا يُحوَّل إلى نجاح.
 */

import type { PostIssue } from './post-logic'
import {
  buildCaption,
  CAPTION_LIMIT,
  canPublish,
  checkScheduleInput,
  TEXT_LIMIT,
  validatePostFields,
} from './post-logic'

export type { PostIssue } from './post-logic'
export { canManage } from './post-logic'

// ===== الأنواع (§4) =====

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'canceled'

export interface SocialPost {
  id: string
  platform: string
  status: string
  title: string | null
  body: string
  parseMode: string | null
  mediaUrl: string | null
  mediaType: string | null
  destinationId: string | null
  templateId: string | null
  scheduledFor: string | null
  publishedAt: string | null
  externalId: string | null
  attempts: number
  maxAttempts: number
  lastError: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  destination?: { id: string; chatId: string; title: string | null } | null
  template?: { id: string; name: string } | null
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paged<T> {
  data: T[]
  pagination: Pagination
}

export interface PostFilters {
  platform?: string
  status?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface PostWritePayload {
  title?: string | null
  body: string
  parseMode?: string | null
  mediaUrl?: string | null
  destinationId?: string | null
  templateId?: string | null
  platform?: string
}

export interface PostValidateResult {
  ok: boolean
  issues: PostIssue[]
  metrics: { renderedLength: number; chunks: number; withinLimit: boolean }
}

export interface PostPreviewResult {
  text: string
  parseMode: string | null
  photo?: { url: string; caption: string; captionWithinLimit: boolean }
  chunks: number
}

export interface SocialPostTemplate {
  id: string
  platform: string
  name: string
  title: string | null
  body: string
  parseMode: string | null
  mediaUrl: string | null
  variables: string[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface TelegramDestination {
  id: string
  chatId: string
  title: string | null
  chatType: string | null
  status: string
  verificationStatus: string
  readiness?: { ready: boolean; reason?: string }
}

// ===== الأخطاء =====

const AR_RE = /[\u0600-\u06FF]/

const FALLBACK_AR: Record<number, string> = {
  401: 'سجّل الدخول أولاً',
  403: 'غير مصرح — هذه العملية للمديرين فقط',
  404: 'العنصر غير موجود',
  409: 'تعارض — لا يمكن تنفيذ هذا الإجراء على الحالة الحالية',
  422: 'بيانات غير صالحة — راجع الحقول المدخلة',
  429: 'طلبات كثيرة جداً — انتظر قليلاً',
  500: 'خطأ في الخادم — حاول مرة أخرى',
  502: 'تعذّر الوصول إلى تليجرام — حاول لاحقاً',
}

/** خطأ مُعاد من الـ API — يحمل الحالة والتفاصيل ليعرضها الصفحة. */
export class SocialApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'SocialApiError'
    this.status = status
    this.details = details
  }
}

function localize(raw: unknown, status: number): string {
  const msg = typeof raw === 'string' ? raw.trim() : ''
  if (msg && AR_RE.test(msg)) return msg
  if (msg && msg !== 'Invalid input' && msg !== 'Internal server error') return msg
  return FALLBACK_AR[status] ?? 'تعذّر إتمام العملية'
}

function isJson(res: Response): boolean {
  return (res.headers.get('content-type') || '').includes('application/json')
}

/** 404 بلا JSON = مسار Next غير موجود بعد (W1 لم يسلّم) → نسقط للمخزن المحلي. */
function routeMissing(res: Response): boolean {
  return res.status === 404 && !isJson(res)
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function errorFrom(json: any, status: number): SocialApiError {
  const msg = localize(json?.error?.message ?? json?.problem?.detail, status)
  return new SocialApiError(status, msg, json?.error?.details)
}

function extractList<T>(json: any, keys: string[]): T[] {
  const d = json?.data
  if (Array.isArray(d)) return d as T[]
  if (d && Array.isArray(d.posts)) return d.posts as T[]
  if (d && Array.isArray(d.templates)) return d.templates as T[]
  if (d && Array.isArray(d.destinations)) return d.destinations as T[]
  for (const k of keys) {
    if (Array.isArray(json?.[k])) return json[k] as T[]
    if (json?.data && Array.isArray(json.data[k])) return json.data[k] as T[]
  }
  return []
}

function extractPagination(json: any): Pagination {
  const p = json?.pagination ?? json?.data?.pagination
  if (p && typeof p === 'object') {
    return {
      page: Number(p.page) || 1,
      limit: Number(p.limit) || 20,
      total: Number(p.total) || 0,
      totalPages: Number(p.totalPages) || 1,
    }
  }
  return { page: 1, limit: 20, total: 0, totalPages: 1 }
}

function mockPaged<T>(items: T[]): Paged<T> {
  return {
    data: items,
    pagination: { page: 1, limit: items.length || 1, total: items.length, totalPages: 1 },
  }
}

// ===== المخزن المحلي (يُستخدم فقط حين يغيب مسار W1) =====

const nowIso = (): string => new Date().toISOString()
const uid = (prefix: string): string => `${prefix}-local-${Math.random().toString(36).slice(2, 9)}`

const DESTINATIONS: TelegramDestination[] = [
  {
    id: 'dest-channel',
    chatId: '@arabic_games_channel',
    title: 'قناة التعريبات العربية',
    chatType: 'channel',
    status: 'active',
    verificationStatus: 'verified',
    readiness: { ready: true },
  },
  {
    id: 'dest-group',
    chatId: '-1001234567890',
    title: 'مجموعة فريق الترجمة',
    chatType: 'group',
    status: 'active',
    verificationStatus: 'verified',
    readiness: { ready: true },
  },
]

function seedPosts(): SocialPost[] {
  const base = (over: Partial<SocialPost>): SocialPost => ({
    id: uid('post'),
    platform: 'telegram',
    status: 'draft',
    title: null,
    body: '',
    parseMode: 'HTML',
    mediaUrl: null,
    mediaType: null,
    destinationId: null,
    templateId: null,
    scheduledFor: null,
    publishedAt: null,
    externalId: null,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    createdById: 'admin-1',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    destination: null,
    template: null,
    ...over,
  })
  return [
    base({
      id: 'post-published-1',
      status: 'published',
      title: 'تحديث جديد للعبة المفضلة',
      body: '<b>إشعار:</b> صدر تحديث جديد يضيف دعماً كاملاً للغة العربية 🎉',
      destinationId: 'dest-channel',
      destination: DESTINATIONS[0],
      publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
      externalId: 'tg-1001',
    }),
    base({
      id: 'post-scheduled-1',
      status: 'scheduled',
      title: 'تذكير بموعد الإطلاق',
      body: 'يقترب موعد الإطلاق — تابعونا لتصلكم التفاصيل أولاً بأول.',
      destinationId: 'dest-channel',
      destination: DESTINATIONS[0],
      scheduledFor: new Date(Date.now() + 7_200_000).toISOString(),
    }),
    base({
      id: 'post-draft-1',
      status: 'draft',
      title: 'مسودة: مقارنة نسخة الجوال',
      body: 'مسودة المقال تحت التحرير…',
      parseMode: null,
    }),
    base({
      id: 'post-failed-1',
      status: 'failed',
      title: 'منشور فشل إرساله',
      body: 'أُرسل مرتين وفشل مرتين — يحتاج مراجعة الوجهة.',
      destinationId: 'dest-group',
      destination: DESTINATIONS[1],
      attempts: 3,
      lastError: 'Bad Request: chat not found',
    }),
    base({
      id: 'post-canceled-1',
      status: 'canceled',
      title: 'منشور ملغى',
      body: 'أُلغي بعد إعادة الجدولة.',
    }),
  ]
}

let mockPosts: SocialPost[] = seedPosts()
let mockTemplates: SocialPostTemplate[] = [
  {
    id: 'pt-welcome',
    platform: 'telegram',
    name: 'ترحيب بالمجتمع',
    title: 'أهلاً بكم 👋',
    body: '<b>مرحباً بكم في مجتمع التعريب العربي!</b>\nانضموا إلينا للحصول على آخر الأخبار.',
    parseMode: 'HTML',
    mediaUrl: null,
    variables: [],
    isDefault: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'pt-update',
    platform: 'telegram',
    name: 'إشعار تحديث',
    title: 'تحديث جديد',
    body: 'صدر تحديث جديد — راجع التفاصيل عبر الرابط.',
    parseMode: null,
    mediaUrl: null,
    variables: ['gameTitle'],
    isDefault: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
]

/** إعادة ضبط المخزن المحلي (للاختبارات فقط). */
export function resetSocialMocks(): void {
  mockPosts = seedPosts()
  mockTemplates = [
    {
      id: 'pt-welcome',
      platform: 'telegram',
      name: 'ترحيب بالمجتمع',
      title: 'أهلاً بكم 👋',
      body: '<b>مرحباً بكم في مجتمع التعريب العربي!</b>',
      parseMode: 'HTML',
      mediaUrl: null,
      variables: [],
      isDefault: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ]
}

// ===== أدوات الاستعلام =====

async function request(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<{ kind: 'api'; res: Response; json: any } | { kind: 'missing' }> {
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
    return { kind: 'missing' }
  }
  if (routeMissing(res)) return { kind: 'missing' }
  return { kind: 'api', res, json: await readJson(res) }
}

/** قراءة قائمة: نجاح API، أو مسار غائب → مخزن محلي مُفلتر. */
async function readCollection<T>(
  path: string,
  mockFallback: () => T[],
  keys: string[],
): Promise<Paged<T>> {
  const out = await request(path)
  if (out.kind === 'missing') return mockPaged(mockFallback())
  if (!out.res.ok) throw errorFrom(out.json, out.res.status)
  const data = extractList<T>(out.json, keys)
  const pagination = extractPagination(out.json)
  if (pagination.total === 0 && data.length > 0) {
    pagination.total = data.length
    pagination.totalPages = Math.max(1, pagination.totalPages)
  }
  return { data, pagination }
}

/** قراءة عنصر واحد: مسار غائب → المخزن المحلي؛ غير موجود → 404 عربي. */
async function readOne<T>(path: string, id: string, mockFind: () => T | undefined): Promise<T> {
  const out = await request(path)
  if (out.kind === 'missing') {
    const found = mockFind()
    if (!found) throw new SocialApiError(404, FALLBACK_AR[404])
    return found
  }
  if (!out.res.ok) throw errorFrom(out.json, out.res.status)
  const d = out.json?.data
  const item = (d?.post ?? d ?? out.json) as T
  if (!item || typeof item !== 'object') throw new SocialApiError(404, FALLBACK_AR[404])
  return item
}

/** كتابة: نجاح API، أو مسار غائب → تنفيذ المنطق نفسه على المخزن المحلي. */
async function mutate<T>(
  path: string,
  init: RequestInit & { json?: unknown },
  local: () => T,
): Promise<T> {
  const out = await request(path, init)
  if (out.kind === 'missing') return local()
  if (!out.res.ok) throw errorFrom(out.json, out.res.status)
  const d = out.json?.data
  if (d === undefined || d === null) return local()
  return d as T
}

// ===== المنشورات =====

function matchesFilters(p: SocialPost, f: PostFilters): boolean {
  if (f.status && p.status !== f.status) return false
  if (f.platform && p.platform !== f.platform) return false
  if (f.from) {
    const t = new Date(p.createdAt).getTime()
    if (!Number.isNaN(t) && t < new Date(f.from).getTime()) return false
  }
  if (f.to) {
    const t = new Date(p.createdAt).getTime()
    if (!Number.isNaN(t) && t > new Date(f.to).getTime() + 86_399_999) return false
  }
  return true
}

export function buildPostQuery(f: PostFilters): string {
  const qs = new URLSearchParams()
  if (f.status) qs.set('status', f.status)
  if (f.platform) qs.set('platform', f.platform)
  if (f.from) qs.set('from', f.from)
  if (f.to) qs.set('to', f.to)
  if (f.page) qs.set('page', String(f.page))
  if (f.limit) qs.set('limit', String(f.limit))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listPosts(filters: PostFilters = {}): Promise<Paged<SocialPost>> {
  return readCollection(
    `/api/admin/social/posts${buildPostQuery(filters)}`,
    () => mockPosts.filter((p) => matchesFilters(p, filters)),
    ['posts', 'items'],
  )
}

export async function getPost(id: string): Promise<SocialPost> {
  return readOne(`/api/admin/social/posts/${encodeURIComponent(id)}`, id, () =>
    mockPosts.find((p) => p.id === id),
  )
}

function localFind(id: string): SocialPost {
  const p = mockPosts.find((x) => x.id === id)
  if (!p) throw new SocialApiError(404, FALLBACK_AR[404])
  return p
}

export async function createPost(payload: PostWritePayload): Promise<SocialPost> {
  return mutate(
    '/api/admin/social/posts',
    { method: 'POST', json: { platform: 'telegram', ...payload } },
    () => {
      const post: SocialPost = {
        id: uid('post'),
        platform: payload.platform ?? 'telegram',
        status: 'draft',
        title: payload.title ?? null,
        body: payload.body,
        parseMode: payload.parseMode ?? 'HTML',
        mediaUrl: payload.mediaUrl ?? null,
        mediaType: payload.mediaUrl ? 'photo' : null,
        destinationId: payload.destinationId ?? null,
        templateId: payload.templateId ?? null,
        scheduledFor: null,
        publishedAt: null,
        externalId: null,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        createdById: 'local-admin',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        destination: DESTINATIONS.find((d) => d.id === payload.destinationId) ?? null,
        template: null,
      }
      mockPosts.unshift(post)
      return post
    },
  )
}

export async function updatePost(
  id: string,
  payload: Partial<PostWritePayload>,
): Promise<SocialPost> {
  return mutate(
    `/api/admin/social/posts/${encodeURIComponent(id)}`,
    { method: 'PATCH', json: payload },
    () => {
      const post = localFind(id)
      if (post.status === 'published') {
        throw new SocialApiError(409, 'لا يمكن تعديل منشور منشور بالفعل — أنشئ منشوراً جديداً')
      }
      const next: SocialPost = {
        ...post,
        title: payload.title !== undefined ? payload.title : post.title,
        body: payload.body ?? post.body,
        parseMode: payload.parseMode !== undefined ? payload.parseMode : post.parseMode,
        mediaUrl: payload.mediaUrl !== undefined ? payload.mediaUrl : post.mediaUrl,
        mediaType:
          payload.mediaUrl !== undefined ? (payload.mediaUrl ? 'photo' : null) : post.mediaType,
        destinationId:
          payload.destinationId !== undefined ? payload.destinationId : post.destinationId,
        updatedAt: nowIso(),
      }
      next.destination =
        DESTINATIONS.find((d) => d.id === next.destinationId) ?? post.destination ?? null
      mockPosts = mockPosts.map((p) => (p.id === id ? next : p))
      return next
    },
  )
}

export async function deletePost(id: string): Promise<void> {
  await mutate(`/api/admin/social/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }, () => {
    const post = localFind(id)
    if (post.status === 'published') {
      throw new SocialApiError(409, 'لا يمكن حذف منشور منشور بالفعل')
    }
    mockPosts = mockPosts.filter((p) => p.id !== id)
    return null
  })
}

export async function publishPost(id: string): Promise<SocialPost> {
  return mutate(
    `/api/admin/social/posts/${encodeURIComponent(id)}/publish`,
    { method: 'POST', json: {} },
    () => {
      const post = localFind(id)
      if (post.status === 'published' || post.externalId) return post
      const check = canPublish({ body: post.body, title: post.title, mediaUrl: post.mediaUrl })
      if (!check.allowed) throw new SocialApiError(422, check.reason || FALLBACK_AR[422])
      const next: SocialPost = {
        ...post,
        status: 'published',
        publishedAt: nowIso(),
        externalId: `tg-local-${Math.floor(Math.random() * 1e6)}`,
        attempts: post.attempts + 1,
        lastError: null,
        updatedAt: nowIso(),
      }
      mockPosts = mockPosts.map((p) => (p.id === id ? next : p))
      return next
    },
  )
}

export async function schedulePost(id: string, scheduledFor: string): Promise<SocialPost> {
  const check = checkScheduleInput(scheduledFor)
  if (!check.ok) throw new SocialApiError(422, check.message || FALLBACK_AR[422])
  return mutate(
    `/api/admin/social/posts/${encodeURIComponent(id)}/schedule`,
    { method: 'POST', json: { scheduledFor } },
    () => {
      const post = localFind(id)
      if (post.status === 'published') {
        throw new SocialApiError(409, 'لا يمكن جدولة منشور منشور بالفعل')
      }
      const next: SocialPost = {
        ...post,
        status: 'scheduled',
        scheduledFor: new Date(scheduledFor).toISOString(),
        updatedAt: nowIso(),
      }
      mockPosts = mockPosts.map((p) => (p.id === id ? next : p))
      return next
    },
  )
}

export async function cancelPost(id: string): Promise<SocialPost> {
  return mutate(
    `/api/admin/social/posts/${encodeURIComponent(id)}/cancel`,
    { method: 'POST', json: {} },
    () => {
      const post = localFind(id)
      if (post.status === 'published') {
        throw new SocialApiError(409, 'لا يمكن إلغاء منشور منشور بالفعل')
      }
      const next: SocialPost = {
        ...post,
        status: 'canceled',
        scheduledFor: null,
        updatedAt: nowIso(),
      }
      mockPosts = mockPosts.map((p) => (p.id === id ? next : p))
      return next
    },
  )
}

/** حقول المحرّر الحالية — تُرسل كتجاوزات، وتُستخدم حين يغيب مسار W1. */
export interface EditorFields {
  title?: string | null
  body: string
  parseMode?: string | null
  mediaUrl?: string | null
}

function chunksOf(text: string): number {
  if (!text) return 1
  return Math.max(1, Math.ceil(text.length / TEXT_LIMIT))
}

export async function validatePost(
  id: string | null,
  fields: EditorFields,
): Promise<PostValidateResult> {
  if (id) {
    const out = await request(`/api/admin/social/posts/${encodeURIComponent(id)}/validate`, {
      method: 'POST',
      json: fields,
    })
    if (out.kind === 'api') {
      if (out.res.ok) return out.json?.data as PostValidateResult
      const details = out.json?.error?.details as { issues?: PostIssue[] } | undefined
      if (details?.issues) {
        return {
          ok: false,
          issues: details.issues,
          metrics: (details as { metrics?: PostValidateResult['metrics'] }).metrics ?? {
            renderedLength: buildCaption(fields.title, fields.body).length,
            chunks: chunksOf(buildCaption(fields.title, fields.body)),
            withinLimit: false,
          },
        }
      }
      // 422 بلا تفاصيل حقول → نُظهر رسالة الخطأ كمسألة واحدة
      const err = errorFrom(out.json, out.res.status)
      return {
        ok: false,
        issues: [{ field: 'body', code: 'invalid', message: err.message }],
        metrics: {
          renderedLength: buildCaption(fields.title, fields.body).length,
          chunks: chunksOf(buildCaption(fields.title, fields.body)),
          withinLimit: false,
        },
      }
    }
  }
  return validatePostFields(fields)
}

export async function previewPost(
  id: string | null,
  fields: EditorFields,
): Promise<PostPreviewResult> {
  if (id) {
    const out = await request(`/api/admin/social/posts/${encodeURIComponent(id)}/preview`, {
      method: 'POST',
      json: fields,
    })
    if (out.kind === 'api' && out.res.ok) return out.json?.data as PostPreviewResult
  }
  const text = buildCaption(fields.title, fields.body)
  const photo = fields.mediaUrl
    ? {
        url: fields.mediaUrl,
        caption: text,
        captionWithinLimit: text.length <= CAPTION_LIMIT,
      }
    : undefined
  const result: PostPreviewResult = {
    text,
    parseMode: fields.parseMode ?? null,
    chunks: chunksOf(text),
  }
  if (photo) result.photo = photo
  return result
}

// ===== قوالب المنشورات =====

export async function listPostTemplates(): Promise<SocialPostTemplate[]> {
  const paged = await readCollection<SocialPostTemplate>(
    '/api/admin/social/post-templates',
    () => [...mockTemplates],
    ['templates', 'items'],
  )
  return paged.data
}

export interface PostTemplatePayload {
  name: string
  title?: string | null
  body: string
  parseMode?: string | null
  mediaUrl?: string | null
  isDefault?: boolean
}

export async function createPostTemplate(
  payload: PostTemplatePayload,
): Promise<SocialPostTemplate> {
  return mutate(
    '/api/admin/social/post-templates',
    { method: 'POST', json: { platform: 'telegram', ...payload } },
    () => {
      const t: SocialPostTemplate = {
        id: uid('pt'),
        platform: 'telegram',
        name: payload.name,
        title: payload.title ?? null,
        body: payload.body,
        parseMode: payload.parseMode ?? 'HTML',
        mediaUrl: payload.mediaUrl ?? null,
        variables: [],
        isDefault: payload.isDefault ?? false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      mockTemplates.unshift(t)
      return t
    },
  )
}

export async function updatePostTemplate(
  id: string,
  payload: Partial<PostTemplatePayload>,
): Promise<SocialPostTemplate> {
  return mutate(
    `/api/admin/social/post-templates/${encodeURIComponent(id)}`,
    { method: 'PATCH', json: payload },
    () => {
      const t = mockTemplates.find((x) => x.id === id)
      if (!t) throw new SocialApiError(404, FALLBACK_AR[404])
      const next: SocialPostTemplate = {
        ...t,
        ...payload,
        variables: t.variables,
        updatedAt: nowIso(),
      }
      mockTemplates = mockTemplates.map((x) => (x.id === id ? next : x))
      return next
    },
  )
}

export async function deletePostTemplate(id: string): Promise<void> {
  await mutate(
    `/api/admin/social/post-templates/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    () => {
      if (!mockTemplates.some((x) => x.id === id)) throw new SocialApiError(404, FALLBACK_AR[404])
      mockTemplates = mockTemplates.filter((x) => x.id !== id)
      return null
    },
  )
}

// ===== وجهات تليجرام =====

export async function listDestinations(): Promise<TelegramDestination[]> {
  const out = await request('/api/admin/telegram-destinations')
  if (out.kind === 'missing') return [...DESTINATIONS]
  if (!out.res.ok) throw errorFrom(out.json, out.res.status)
  return extractList<TelegramDestination>(out.json, ['destinations'])
}

// ===== الرتبة =====

/** رتبة المستخدم الحالية من `/api/auth/me` — فشل القراءة → null (لا نمنع الواجهة؛ الـ API يفرض requireManager). */
export async function fetchRole(): Promise<string | null> {
  const out = await request('/api/auth/me')
  if (out.kind === 'missing') return null
  if (!out.res.ok) return null
  return out.json?.data?.user?.role ?? out.json?.user?.role ?? null
}
