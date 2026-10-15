/**
 * post-logic — المنطق النقي لمحرّر منشورات تليجرام (بلا React ولا شبكة).
 *
 * مستخرج في ملف منفصل ليُختبر في node env (درس P4: لا نختبر مكوّنات DOM ثقيلة
 * للمنطق البسيط). مكوّنات `post-editor` و`telegram-preview` و`post-status-badge`
 * تستورد من هنا — مصدر واحد للحقيقة.
 */

/** حد تليجرام لرسالة نصية (sendMessage يقسّم تلقائياً، لكن الخطة تمنع التقسيم). */
export const TEXT_LIMIT = 4096
/** حد تليجرام لـ caption عند إرسال صورة (sendPhoto) — تجاوزه = فشل صامت. */
export const CAPTION_LIMIT = 1024

export type PostTone = 'default' | 'secondary' | 'destructive' | 'outline'

export interface ScheduleCheck {
  ok: boolean
  message?: string
}

export interface PublishCheck {
  allowed: boolean
  reason?: string
}

export interface CharMeter {
  used: number
  limit: number
  over: boolean
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  scheduled: 'مجدول',
  publishing: 'جارٍ النشر',
  published: 'منشور',
  failed: 'فشل',
  canceled: 'ملغى',
}

const STATUS_TONES: Record<string, PostTone> = {
  draft: 'secondary',
  scheduled: 'outline',
  publishing: 'secondary',
  published: 'default',
  failed: 'destructive',
  canceled: 'outline',
}

const PLATFORM_LABELS: Record<string, string> = {
  telegram: 'تليجرام',
  facebook: 'فيسبوك',
  youtube: 'يوتيوب',
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** تحويل حقل datetime-local إلى Date (يُعامل كوقت محلي). */
function parseLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!m) {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
  const [, y, mo, d, h, mi, s] = m
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  )
  return Number.isNaN(date.getTime()) ? null : date
}

/** قيمة datetime-local لـ Date (للتعبئة عند التعديل). */
export function toDateTimeLocal(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * الجدولة: المستقبل فقط. الحقل الفارغ/غير الصالح/الماضي — كلها مرفوضة.
 * نفس القاعدة يفرضها `POST /posts/[id]/schedule` بـ 422؛ نمنعه هنا قبل الإرسال.
 */
export function checkScheduleInput(
  value: string | null | undefined,
  now: Date = new Date(),
): ScheduleCheck {
  if (!value || !value.trim()) {
    return { ok: false, message: 'حدّد وقت الجدولة' }
  }
  const when = parseLocal(value)
  if (!when) {
    return { ok: false, message: 'وقت الجدولة غير صالح' }
  }
  if (when.getTime() <= now.getTime()) {
    return { ok: false, message: 'وقت الجدولة يجب أن يكون في المستقبل' }
  }
  return { ok: true }
}

/** هل الوقت المُمرَّر ماضٍ (أو فارغ/تالف → لا يُعد ماضياً حتى لا يُحوَّل غياب لخطأ). */
export function isPastSchedule(value: string | null | undefined, now: Date = new Date()): boolean {
  if (!value || !value.trim()) return false
  const when = parseLocal(value)
  if (!when) return false
  return when.getTime() <= now.getTime()
}

/** نص المنشور النهائي: العنوان ثم سطران فارغان ثم المتن (نفس محرّك النشر §4.1). */
export function buildCaption(title: string | null | undefined, body: string): string {
  const t = (title ?? '').trim()
  if (!t) return body ?? ''
  return `${t}\n\n${body ?? ''}`
}

/** طول النص النهائي كما سيصل لتليجرام. */
export function captionLength(
  body: string,
  mediaUrl?: string | null,
  title?: string | null,
): number {
  void mediaUrl
  return buildCaption(title, body).length
}

/** نص المعاينة المعروض في الفقاعة. */
export function postPreviewText(fields: { title?: string | null; body: string }): string {
  return buildCaption(fields.title, fields.body).trim()
}

/**
 * هل يجوز النشر؟
 * - لا محتوى → ممنوع.
 * - النص > 4096 → ممنوع (الخطة §9 س3: نمنع التقسيم بدل قبوله).
 * - وسائط والنص النهائي > 1024 → ممنوع (sendPhoto caption limit — درس الخطأ الصامت).
 */
export function canPublish(fields: {
  body: string
  title?: string | null
  mediaUrl?: string | null
}): PublishCheck {
  const body = fields.body ?? ''
  if (!body.trim()) return { allowed: false, reason: 'محتوى المنشور مطلوب' }

  const caption = buildCaption(fields.title, body)
  if (caption.length > TEXT_LIMIT) {
    return {
      allowed: false,
      reason: `النص يتجاوز حد تليجرام ${TEXT_LIMIT} حرفاً (${caption.length}) — اختصره قبل النشر`,
    }
  }
  if (fields.mediaUrl && caption.length > CAPTION_LIMIT) {
    return {
      allowed: false,
      reason: `نص المنشور مع الوسائط يتجاوز حد الوسائط ${CAPTION_LIMIT} حرفاً (${caption.length})`,
    }
  }
  return { allowed: true }
}

/** عدّاد الأحرف: 4096 للنص، 1024 حين توجد وسائط (caption). */
export function charMeter(fields: {
  body: string
  title?: string | null
  mediaUrl?: string | null
}): CharMeter {
  const used = buildCaption(fields.title, fields.body).length
  const limit = fields.mediaUrl ? CAPTION_LIMIT : TEXT_LIMIT
  return { used, limit, over: used > limit }
}

/**
 * تسمية الحالة — لا تُرجع `undefined` أبداً (درس P4: شارة طبعت `undefined`).
 * الحالة المجهولة تعرض قيمتها الخام؛ الفارغ يعرض بديلاً عربياً.
 */
export function statusLabel(status?: string | null): string {
  if (status == null) return 'غير معروف'
  const key = String(status).trim()
  if (!key) return 'غير معروف'
  return STATUS_LABELS[key] ?? key
}

/** نبرة الشالة — قيمة design معرّفة دائماً (fallback outline). */
export function statusTone(status?: string | null): PostTone {
  const key = status == null ? '' : String(status).trim()
  return STATUS_TONES[key] ?? 'outline'
}

/**
 * من يرى الحِزَز الخاصة بالطفرات (§D8: كلها `requireManager`).
 * `null`/`undefined` = الرتبة لم تصل بعد → نُظهر الحِز؛ الحارس الحقيقي هو الـ API
 * (`requireManager`)، والإخفاء هنا تجميلي فقط.
 */
export function canManage(role?: string | null): boolean {
  if (role == null) return true
  return role === 'manager' || role === 'owner'
}

/** تسمية المنصة — نفس منهج statusLabel (لا undefined أبداً). */
export function platformLabel(platform?: string | null): string {
  if (platform == null) return 'غير محددة'
  const key = String(platform).trim()
  if (!key) return 'غير محددة'
  return PLATFORM_LABELS[key] ?? key
}

// ===== تحقق المنشور (بديل محلي بنفس أشكال §4 A3) =====

export interface PostIssue {
  field: string
  code: string
  message: string
}

export interface PostValidation {
  ok: boolean
  issues: PostIssue[]
  metrics: { renderedLength: number; chunks: number; withinLimit: boolean }
}

export const TITLE_LIMIT = 256

function chunksOf(text: string): number {
  if (!text) return 1
  return Math.max(1, Math.ceil(text.length / TEXT_LIMIT))
}

/**
 * تحقق الحقول محلياً — يُستدعى حين يغيب مسار `POST /posts/[id]/validate` (W1)
 * وللتحقق قبل الحفظ. نفس قواعد §4 A3: مطلوب، 4096 للنص، 1024 للوسائط، رابط صالح.
 */
export function validatePostFields(fields: {
  title?: string | null
  body: string
  parseMode?: string | null
  mediaUrl?: string | null
}): PostValidation {
  const issues: PostIssue[] = []
  const body = fields.body ?? ''
  const title = (fields.title ?? '').trim()
  const caption = buildCaption(fields.title, body)

  if (!body.trim()) {
    issues.push({ field: 'body', code: 'required', message: 'محتوى المنشور مطلوب' })
  }
  if (title.length > TITLE_LIMIT) {
    issues.push({
      field: 'title',
      code: 'too_long',
      message: `العنوان يتجاوز ${TITLE_LIMIT} حرفاً (${title.length})`,
    })
  }
  if (fields.mediaUrl) {
    try {
      new URL(fields.mediaUrl)
    } catch {
      issues.push({ field: 'mediaUrl', code: 'invalid_url', message: 'رابط الوسائط غير صالح' })
    }
  }
  if (caption.length > TEXT_LIMIT) {
    issues.push({
      field: 'body',
      code: 'too_long',
      message: `النص يتجاوز حد تليجرام ${TEXT_LIMIT} حرفاً (${caption.length})`,
    })
  } else if (fields.mediaUrl && caption.length > CAPTION_LIMIT) {
    issues.push({
      field: 'mediaUrl',
      code: 'caption_too_long',
      message: `نص الوسائط يتجاوز حد ${CAPTION_LIMIT} حرفاً (${caption.length})`,
    })
  }

  const withinLimit = !issues.some((i) => i.code === 'too_long' || i.code === 'caption_too_long')
  return {
    ok: issues.length === 0,
    issues,
    metrics: {
      renderedLength: caption.length,
      chunks: chunksOf(caption),
      withinLimit,
    },
  }
}
