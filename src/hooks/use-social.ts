'use client'

/**
 * طبقة جلب بيانات مركز السوشيال ميديا (W2 تعرّفها، W3 تستهلكها).
 *
 * المصدر الحقيقي هو مسارات `/api/admin/social/*` (W1). ما دامت لم تُبنَ بعد،
 * تُعيد الـ hooks بيانات تجريبية **مكتوبة النوع** مطابقة لأشكال الخطة (§4)،
 * وتُشير `isMock` إلى أن المعروض تجريبي. لا تُحجب الواجهة أبداً.
 *
 * عند هبوط مسارات W1 يتحوّل السلوك تلقائياً إلى البيانات الحقيقية بلا أي تعديل
 * على الصفحات: الفشل فقط هو ما يُسقِط على الـ mock.
 */

import { useFetch } from '@/hooks/use-fetch'

// ---------------------------------------------------------------------------
// الأنواع
// ---------------------------------------------------------------------------

export type SocialPlatformKey = 'telegram' | 'facebook' | 'youtube'
export type SocialPlatformStatus = 'active' | 'coming_soon'
export type SocialStatsRange = '7d' | '30d' | '90d'
export type SocialPostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'canceled'

/** بطاقة منصة داخل `/overview` — عدّادات عامة فقط. */
export interface SocialPlatformOverview {
  key: string
  status: SocialPlatformStatus | string
  posts: { published30d: number; scheduled: number; failed: number }
  templates: number
  destinations: number | null
}

export interface SocialOverviewScheduledItem {
  id: string
  title: string | null
  scheduledFor: string
  platform: string
}

export interface SocialOverviewPublishedItem {
  id: string
  title: string | null
  publishedAt: string
  externalId: string | null
  platform: string
}

export interface SocialOverviewData {
  platforms: SocialPlatformOverview[]
  totals: { published30d: number; scheduled: number; failed: number }
  nextScheduled: SocialOverviewScheduledItem[]
  recentPublished: SocialOverviewPublishedItem[]
}

export interface SocialStatsPoint {
  date: string
  published: number
  failed: number
}

export interface SocialStatsData {
  range: string
  kpis: {
    published: number
    failed: number
    scheduledUpcoming: number
    avgPerDay: number
  }
  timeSeries: SocialStatsPoint[]
  destinations: { total: number; active: number; verified: number }
  templates: { notification: number; post: number }
  notifications: { sent: number; failed: number }
}

export interface SocialPostListItem {
  id: string
  platform: string
  status: SocialPostStatus | string
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
  createdAt: string
  updatedAt: string
}

export interface SocialPostTemplateItem {
  id: string
  platform: string
  name: string
  title: string | null
  body: string
  parseMode: string | null
  mediaUrl: string | null
  variables: unknown[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface SocialPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// نتيجة موحّدة للـ hooks
// ---------------------------------------------------------------------------

export interface SocialDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** true عندما تكون البيانات المعروضة تجريبية لأن الـ API غير متاح بعد. */
  isMock: boolean
  refetch: () => void
}

// ---------------------------------------------------------------------------
// بيانات تجريبية مكتوبة النوع (مطابقة لأشكال الخطة §4)
// ---------------------------------------------------------------------------

export const MOCK_PLATFORM_OVERVIEWS: SocialPlatformOverview[] = [
  {
    key: 'telegram',
    status: 'active',
    posts: { published30d: 42, scheduled: 3, failed: 1 },
    templates: 6,
    destinations: 2,
  },
  {
    key: 'facebook',
    status: 'coming_soon',
    posts: { published30d: 0, scheduled: 0, failed: 0 },
    templates: 0,
    destinations: null,
  },
  {
    key: 'youtube',
    status: 'coming_soon',
    posts: { published30d: 0, scheduled: 0, failed: 0 },
    templates: 0,
    destinations: null,
  },
]

export const MOCK_SOCIAL_OVERVIEW: SocialOverviewData = {
  platforms: MOCK_PLATFORM_OVERVIEWS,
  totals: { published30d: 42, scheduled: 3, failed: 1 },
  nextScheduled: [
    {
      id: 'mock-sched-1',
      title: 'إعلان تحديث التعريبات',
      scheduledFor: '2026-10-12T18:00:00.000Z',
      platform: 'telegram',
    },
    {
      id: 'mock-sched-2',
      title: 'تذكير بمسابقة الأسبوع',
      scheduledFor: '2026-10-13T09:30:00.000Z',
      platform: 'telegram',
    },
  ],
  recentPublished: [
    {
      id: 'mock-pub-1',
      title: 'صدور تعريب جديد',
      publishedAt: '2026-10-11T12:00:00.000Z',
      externalId: '1001',
      platform: 'telegram',
    },
    {
      id: 'mock-pub-2',
      title: 'أفضل التعريبات هذا الشهر',
      publishedAt: '2026-10-10T08:15:00.000Z',
      externalId: '1000',
      platform: 'telegram',
    },
  ],
}

function mockStats(range: SocialStatsRange): SocialStatsData {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const timeSeries: SocialStatsPoint[] = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(2026, 9, 12))
    date.setUTCDate(date.getUTCDate() - (days - 1 - i))
    return {
      date: date.toISOString().slice(0, 10),
      published: (i * 3) % 5,
      failed: i % 7 === 0 ? 1 : 0,
    }
  })
  const published = timeSeries.reduce((sum, p) => sum + p.published, 0)
  const failed = timeSeries.reduce((sum, p) => sum + p.failed, 0)
  return {
    range,
    kpis: {
      published,
      failed,
      scheduledUpcoming: 3,
      avgPerDay: days > 0 ? published / days : 0,
    },
    timeSeries,
    destinations: { total: 2, active: 2, verified: 2 },
    templates: { notification: 6, post: 4 },
    notifications: { sent: 128, failed: 4 },
  }
}

export const MOCK_SOCIAL_STATS: Record<SocialStatsRange, SocialStatsData> = {
  '7d': mockStats('7d'),
  '30d': mockStats('30d'),
  '90d': mockStats('90d'),
}

// ---------------------------------------------------------------------------
// hooks
// ---------------------------------------------------------------------------

interface Envelope<T> {
  data?: T
}

/** لمحة `/admin/social`. */
export function useSocialOverview(): SocialDataResult<SocialOverviewData> {
  const { data, loading, error, refetch } = useFetch<Envelope<SocialOverviewData>>(
    '/api/admin/social/overview',
  )
  const real = data?.data ?? null
  const isMock = !real && !!error
  return {
    data: real ?? (isMock ? MOCK_SOCIAL_OVERVIEW : null),
    loading,
    error,
    isMock,
    refetch,
  }
}

/** إحصاءات منصة (تليجرام حالياً) لنطاق زمني. */
export function useSocialStats(
  range: SocialStatsRange = '7d',
  platform: SocialPlatformKey = 'telegram',
): SocialDataResult<SocialStatsData> {
  const url = `/api/admin/social/stats?platform=${platform}&range=${range}`
  const { data, loading, error, refetch } = useFetch<Envelope<SocialStatsData>>(url)
  const real = data?.data ?? null
  const isMock = !real && !!error
  return {
    data: real ?? (isMock ? MOCK_SOCIAL_STATS[range] : null),
    loading,
    error,
    isMock,
    refetch,
  }
}

export interface SocialPostsQuery {
  platform?: string
  status?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

/** قائمة المنشورات (W3 يستهلكها للجدول). لا تُسقِط على mock كي لا تُوهم المستخدم. */
export function useSocialPosts(query: SocialPostsQuery = {}) {
  const params = new URLSearchParams()
  if (query.platform) params.set('platform', query.platform)
  if (query.status) params.set('status', query.status)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  params.set('page', String(query.page ?? 1))
  params.set('limit', String(query.limit ?? 20))
  const url = `/api/admin/social/posts?${params.toString()}`
  const { data, loading, error, refetch } = useFetch<
    Envelope<SocialPostListItem[]> & { pagination?: SocialPagination }
  >(url)
  return {
    posts: data?.data ?? [],
    pagination: data?.pagination ?? null,
    loading,
    error,
    refetch,
  }
}

/** تفصيل منشور واحد. */
export function useSocialPost(id: string | null) {
  const { data, loading, error, refetch } = useFetch<Envelope<SocialPostListItem>>(
    id ? `/api/admin/social/posts/${id}` : null,
  )
  return { post: data?.data ?? null, loading, error, refetch }
}

/** قوالب المنشورات (W3 يستهلكها). */
export function useSocialPostTemplates(platform = 'telegram') {
  const { data, loading, error, refetch } = useFetch<Envelope<SocialPostTemplateItem[]>>(
    `/api/admin/social/post-templates?platform=${platform}`,
  )
  return { templates: data?.data ?? [], loading, error, refetch }
}

// ---------------------------------------------------------------------------
// مساعد الطفرات (W3): يوحّد استخراج رسالة الخطأ العربية من RFC7807.
// ---------------------------------------------------------------------------

export type SocialApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

export async function socialApi<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<SocialApiResult<T>> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
  } catch {
    return { ok: false, status: 0, message: 'تعذّر الاتصال بالخادم' }
  }
  let json: {
    data?: T
    error?: { message?: string }
    problem?: { detail?: string }
  } | null = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: json?.error?.message ?? json?.problem?.detail ?? `فشل الطلب (HTTP ${res.status})`,
    }
  }
  return { ok: true, data: (json?.data ?? (json as unknown)) as T }
}
