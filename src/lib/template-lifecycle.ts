/**
 * lib/template-lifecycle.ts — Telegram Rich-Text Phase 3 (admin APIs).
 *
 * Shared kernel for the 12 template lifecycle procedures × 3 channels
 * (clone, activate/deactivate, validate, preview matrix, test-send,
 * publish/schedule, rollback, export, import, versions, audit, variables).
 *
 * Bindings honored here (P0+P1 canonical contract — nothing is redefined):
 *  - Schema: NotificationTemplate / NotificationTemplateVersion /
 *    TelegramDestination / ScheduledJob from prisma/schema.prisma (P0+P1).
 *  - Registry: TEMPLATE_TYPE_REGISTRY + SECURITY_ROUTER_TYPES from
 *    @/domain/rich-text (three-universe parity test pins them).
 *  - Validator: validateRichDocument / getVariableContract from
 *    @/domain/rich-text — limits, RTL and control-character rules come from
 *    the canonical validator, never from a local copy.
 *  - Security templates (security-router types) are NEVER editable: every
 *    mutation route calls securityTemplateGuard → 403, and the list route
 *    excludes them server-side.
 *  - Draft = isActive:false. No schema change: the P0+P1 schema is canonical
 *    and stays untouched (additive-only discipline from P1).
 *  - paid destination stays disabled (never referenced here), broadcast
 *    approve+send stays requireManager (existing route, untouched).
 */

import type { NotificationTemplate, NotificationTemplateVersion, Prisma } from '@prisma/client'
import Handlebars from 'handlebars'
import {
  getVariableContract,
  RICH_DOCUMENT_VERSION,
  RICH_TEXT_LIMITS,
  type RichDocument,
  type RichValidationCode,
  type RichValidationResult,
  SECURITY_ROUTER_TYPES,
  validateRichDocument,
} from '@/domain/rich-text'
import { generateEmailWrapper } from '@/infrastructure/templates/email-base'
import { forbidden, notFound, unauthorized } from './api-response'
import { db } from './db'
import { logger } from './logger'

// ===== Canonical channels =====

export const TEMPLATE_CHANNELS = ['in_app', 'email', 'telegram'] as const
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number]

export function isTemplateChannel(value: unknown): value is TemplateChannel {
  return typeof value === 'string' && (TEMPLATE_CHANNELS as readonly string[]).includes(value)
}

// ===== Security templates (never editable — server-enforced) =====

const SECURITY_TEMPLATE_TYPE_SET: ReadonlySet<string> = new Set(SECURITY_ROUTER_TYPES)

/** Arabic message surfaced on every blocked security-template mutation. */
export const SECURITY_TEMPLATE_FORBIDDEN =
  'قوالب الأمان مؤمّنة — لا تُعرض في القوائم ولا تُعدّل عبر هذه الواجهات'

/**
 * True when a raw template type belongs to the security-router universe
 * (password_reset, welcome, …). Those types bypass templates entirely at
 * runtime, so a DB row with such a type must never be mutated or listed.
 */
export function isSecurityTemplateType(type: string): boolean {
  return SECURITY_TEMPLATE_TYPE_SET.has(type)
}

/**
 * 403 response when the loaded template is a security template, else null.
 * Call AFTER loading the row (mutations always 403 rather than 404 so the
 * binding "security templates excluded everywhere" is observable).
 */
export function securityTemplateGuard(
  template: { type: string } | null | undefined,
): Response | null {
  if (template && isSecurityTemplateType(template.type)) {
    return forbidden(SECURITY_TEMPLATE_FORBIDDEN)
  }
  return null
}

/**
 * WHERE-clause helper for list endpoints: excludes security templates
 * server-side while keeping a caller-supplied canonical `type` filter a plain
 * scalar (legacy contract). A caller filtering BY a security type gets an
 * empty result — never the row.
 */
export function securityExcludedTypeWhere(
  typeFilter?: string | null,
): string | Record<string, unknown> | { filteredOut: true } {
  if (typeFilter && isSecurityTemplateType(typeFilter)) return { filteredOut: true }
  if (typeFilter) return typeFilter // canonical scalar — legacy list contract intact
  return { notIn: [...SECURITY_ROUTER_TYPES] }
}

// ===== Auth error mapping (401/403 never fall into 500) =====

/** Map AuthError-shaped throws to 401/403 responses; null for other errors. */
export function authErrorResponse(err: unknown, forbiddenMessage?: string): Response | null {
  const status = (err as { status?: number })?.status
  if (status === 401) return unauthorized('سجّل الدخول أولاً')
  if (status === 403) return forbidden(forbiddenMessage ?? 'غير مصرح — إدارة القوالب للمديرين فقط')
  return null
}

// ===== Arabic field-level messages for zod failures =====

const TEMPLATE_FIELD_AR: Record<string, string> = {
  type: 'نوع الإشعار غير صالح',
  channel: 'قناة الإشعار غير صالحة',
  titleTemplate: 'عنوان القالب مطلوب',
  bodyTemplate: 'محتوى القالب مطلوب',
  variables: 'قائمة المتغيرات غير صالحة',
  isActive: 'قيمة التفعيل غير صالحة',
  parseMode: 'وضع التحليل (parseMode) غير صالح',
  richBodyTemplate: 'النص الغني غير صالح',
  changeNote: 'ملاحظة التغيير غير صالحة',
}

/**
 * Arabic top-level message for a flattened zod error — field details stay in
 * `details` per the api-response contract consumed by the rest of the app.
 */
export function zodArabicMessage(
  flat: { formErrors?: string[]; fieldErrors?: Record<string, string[]> },
  fallback = 'بيانات غير صالحة — راجع الحقول المدخلة',
): string {
  for (const [field, msgs] of Object.entries(flat.fieldErrors ?? {})) {
    const m = msgs?.[0]
    if (!m) continue
    if (/[\u0600-\u06FF]/.test(m)) return m
    if (TEMPLATE_FIELD_AR[field]) return TEMPLATE_FIELD_AR[field]
  }
  const form = flat.formErrors?.[0]
  if (form && /[\u0600-\u06FF]/.test(form)) return form
  return fallback
}

// ===== Sample variables (management source shared by preview/test-send) =====

/**
 * Canonical per-type sample values — moved here from the preview route so
 * preview, test-send, validate and the variables endpoint render the SAME
 * samples (single source). Values are unchanged (legacy preview tests pin
 * their rendering).
 */
export const TEMPLATE_SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  comment_reply: {
    actorName: 'أحمد',
    modTitle: 'لعبة زيد',
    replyPreview: 'شكراً على المجهود الرائع!',
  },
  top_level_comment: {
    actorName: 'محمد',
    modTitle: 'لعبة زيد',
    commentPreview: 'عمل ممتاز، شكراً لكم!',
  },
  like: { modTitle: 'لعبة زيد' },
  follow: { followerName: 'سارة' },
  mod_endorse: { modTitle: 'لعبة زيد' },
  mod_endorse_milestone: { modTitle: 'لعبة زيد', count: '50' },
  mod_featured: { modTitle: 'لعبة زيد' },
  mod_published: { modTitle: 'لعبة زيد' },
  mod_updated: { modTitle: 'لعبة زيد' },
  mod_deleted: { modTitle: 'لعبة زيد' },
  tier_upgrade: { fromTier: 'مبتدئ', toTier: 'مترجم' },
  tier_revoked: { fromTier: 'مترجم', toTier: 'مبتدئ', reason: 'عدم النشاط' },
  special_role_assigned: { roleName: 'مترجم رسمي' },
  special_role_removed: { roleName: 'مترجم رسمي', reason: 'انتهاء الصلاحية' },
  admin_action: { actionMessage: 'تم تعليق الحساب مؤقتاً', resolution: 'خرق سياسة المجتمع' },
  admin_user_register: { username: 'ahmed_dev', registerDate: '2026-08-14' },
  admin_request: { requestMessage: 'طلب انضمام لفريق التعريب' },
  admin_report: { reason: 'محتوى مخالف' },
  admin_milestone: { milestoneMessage: 'تم اعتماد 100 تعريب' },
  system_announcement: { announcementMessage: 'سيتم إجراء صيانة مجدولة يوم الجمعة' },
}

/** Sample bag for rendering; empty object for unknown types (never a default). */
export function renderSampleVariables(type: string): Record<string, unknown> {
  const samples = TEMPLATE_SAMPLE_DATA[type]
  return samples ? { ...samples } : {}
}

// ===== Rendering =====

export interface RenderedTemplateContent {
  title: string
  body: string
}

/** Compile + render one Handlebars source; throws on broken templates. */
export function compileAndRender(source: string, variables: Record<string, unknown>): string {
  return Handlebars.compile(source)(variables)
}

/** Render title + legacy body (email/in-app surfaces and telegram fallback). */
export function renderTemplateFields(
  template: Pick<NotificationTemplate, 'titleTemplate' | 'bodyTemplate'>,
  variables: Record<string, unknown>,
): RenderedTemplateContent {
  return {
    title: compileAndRender(template.titleTemplate, variables),
    body: compileAndRender(template.bodyTemplate, variables),
  }
}

/** Declared variables of a template row (Json column → string[]). */
export function declaredVariables(template: Pick<NotificationTemplate, 'variables'>): string[] {
  return Array.isArray(template.variables) ? (template.variables as string[]) : []
}

/** The full text a Telegram user would receive (rich payload when parseMode). */
export function telegramRenderedText(
  template: Pick<
    NotificationTemplate,
    'titleTemplate' | 'bodyTemplate' | 'richBodyTemplate' | 'parseMode'
  >,
  variables: Record<string, unknown>,
): { text: string; usedRich: boolean } {
  const title = compileAndRender(template.titleTemplate, variables)
  const activeBody = template.parseMode
    ? compileAndRender(template.richBodyTemplate || '', variables)
    : compileAndRender(template.bodyTemplate, variables)
  const text = title ? (activeBody ? `${title}\n\n${activeBody}` : activeBody || title) : activeBody
  return { text, usedRich: Boolean(template.parseMode) }
}

// ===== Validation (12 procedures #3 — per channel) =====

export type LifecycleIssueField =
  | 'titleTemplate'
  | 'bodyTemplate'
  | 'richBodyTemplate'
  | 'parseMode'
  | 'variables'
  | 'type'
  | 'template'

export interface LifecycleIssue {
  /** Stable machine code (legacy: rich-validation codes pass through). */
  code: string
  field: LifecycleIssueField
  /** Arabic field-level message (binding: Arabic field-level errors). */
  message: string
  severity: 'error' | 'warning'
  /** Canonical validator path when one exists (title/body/…). */
  path?: string
}

export interface TemplateValidationMetrics {
  renderedTitleLength: number
  renderedBodyLength: number
  renderedTotalLength: number
  withinTelegramLimit: boolean
  declaredVariableCount: number
  contractVariableCount: number
  hasRichPayload: boolean
}

export interface TemplateValidationResult {
  ok: boolean
  issues: LifecycleIssue[]
  metrics: TemplateValidationMetrics
}

/** Canonical validator issues → Arabic field-level messages. */
const CANONICAL_MESSAGE_AR: Record<RichValidationCode, string> = {
  not_an_object: 'بنية غير صالحة',
  unsupported_version: 'إصدار مستند غير مدعوم',
  empty_body: 'متن القالب فارغ بعد العرض',
  empty_title: 'العنوان فارغ — سيُعرض كرسالة بلا عنوان',
  empty_segment: 'عنصر نصي فارغ',
  too_long: `النص يتجاوز الحد الرسمي (${RICH_TEXT_LIMITS.maxTotalLength} حرفاً)`,
  title_too_long: `العنوان يتجاوز ${RICH_TEXT_LIMITS.maxTitleLength} حرفاً`,
  too_many_segments: 'عدد العناصر النصية يتجاوز الحد',
  segment_text_too_long: 'عنصر نصي يتجاوز الطول المسموح',
  too_many_marks: 'عدد علامات التنسيق يتجاوز الحد',
  unknown_mark: 'علامة تنسيق غير مدعومة',
  duplicate_mark: 'علامة تنسيق مكررة',
  code_mark_conflict: 'علامة code لا تُجمع مع علامات أخرى',
  unsafe_link: 'الروابط تقبل https:// و tg:// فقط',
  href_too_long: 'رابط يتجاوز الطول المسموح',
  control_chars: 'أحرف تحكم غير مسموحة (يُسمح بفاصلة سطر وتاب فقط)',
  direction_override: 'رموز تغيير الاتجاه (bidi) غير مسموحة — خطر على واجهة RTL',
  nested_link: 'لا تُداخل الروابط',
  unknown_segment_kind: 'نوع عنصر غير معروف',
  unknown_template_type: 'نوع القالب غير معروف في العقد',
  unknown_variable: 'متغير غير موجود في عقد النوع',
  missing_variable: 'متغير مطلوب غير مُعرَّف',
  invalid_variable_type: 'نوع متغير غير صالح',
  variable_too_long: 'قيمة متغير تتجاوز الطول المسموح',
  invalid_variable_value: 'قيمة متغير خارج النطاق المسموح',
}

function canonicalIssuesToLifecycle(
  result: RichValidationResult,
  bodyField: LifecycleIssueField,
): LifecycleIssue[] {
  return result.issues.map((issue) => {
    const isTitle = issue.path === 'title' || issue.path.startsWith('title')
    const isBody = issue.path === 'body' || issue.path.startsWith('body')
    return {
      code: issue.code,
      field: isTitle ? 'titleTemplate' : isBody ? bodyField : 'template',
      message: CANONICAL_MESSAGE_AR[issue.code] ?? issue.message,
      severity: issue.severity,
      path: issue.path,
    }
  })
}

/** Project rendered strings through the CANONICAL rich validator (no local copy). */
function projectAndValidate(title: string, bodyText: string): RichValidationResult {
  const doc: RichDocument = {
    version: RICH_DOCUMENT_VERSION,
    title: title ? [{ kind: 'text', text: title, marks: [] }] : [],
    body: [{ kind: 'text', text: bodyText, marks: [] }],
  }
  return validateRichDocument(doc)
}

/**
 * Telegram official HTML tag whitelist (Bot API parse_mode=HTML supports only
 * these). Media/embed tags are never permitted — binding: media perms.
 */
const TELEGRAM_HTML_ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'a',
  'code',
  'pre',
  'blockquote',
  'tg-spoiler',
  'tg-emoji',
  'span', // class="tg-spoiler" wrapper
])

/** Tags that reference media — rejected in every parse mode (media perms). */
const MEDIA_TAG_RE = /<(img|video|audio|iframe|embed|object|source|picture|track|svg|canvas)\b/i
const ANY_TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g

/**
 * Draft constructs: Handlebars block helpers, partials, comments and triple
 * stash. Telegram messages are flat — conditionals/loops cannot exist there,
 * so they must not survive into a published telegram template.
 */
const DRAFT_CONSTRUCT_RE = /\{\{(?:[#/>!]|\{3}|--)/

export interface ValidateTemplateInput {
  type: string
  channel: string
  titleTemplate: string
  bodyTemplate: string
  richBodyTemplate?: string | null
  parseMode?: string | null
  variables?: string[]
  /** Override the sample bag (custom validation runs). */
  samples?: Record<string, unknown>
}

/**
 * The per-channel validation core behind POST /[id]/validate and the publish
 * gate. Pure (no DB) — callers load the row.
 *
 * Rules by channel:
 *  - all: Handlebars compiles+renders; canonical projection for official
 *    limits (4096/256), RTL bidi and control characters; declared variables
 *    ⊆ the type's canonical contract.
 *  - telegram: parseMode↔richBody pairing (exactly-one payload field),
 *    official Telegram HTML tag whitelist (media perms), draft constructs
 *    rejected, plain payload also scanned for draft constructs.
 *  - email: HTML-safety warnings for unescaped triple-stash, size warning.
 *  - in_app: canonical rules only.
 */
export function validateTemplateContent(input: ValidateTemplateInput): TemplateValidationResult {
  const issues: LifecycleIssue[] = []
  const samples = input.samples ?? renderSampleVariables(input.type)
  const channel = isTemplateChannel(input.channel) ? input.channel : null

  // --- Handlebars compile + render (all channels) ---
  let title = ''
  let body = ''
  try {
    title = compileAndRender(input.titleTemplate, samples)
  } catch (err) {
    issues.push({
      code: 'handlebars_syntax',
      field: 'titleTemplate',
      message: `خطأ في صيغة العنوان: ${(err as Error).message}`,
      severity: 'error',
    })
  }
  try {
    body = compileAndRender(input.bodyTemplate, samples)
  } catch (err) {
    issues.push({
      code: 'handlebars_syntax',
      field: 'bodyTemplate',
      message: `خطأ في صيغة المتن: ${(err as Error).message}`,
      severity: 'error',
    })
  }

  let richRendered: string | null = null
  if (input.richBodyTemplate) {
    try {
      richRendered = compileAndRender(input.richBodyTemplate, samples)
    } catch (err) {
      issues.push({
        code: 'handlebars_syntax',
        field: 'richBodyTemplate',
        message: `خطأ في صيغة النص الغني: ${(err as Error).message}`,
        severity: 'error',
      })
    }
  }

  // --- Canonical limits / RTL / control chars (all channels) ---
  const bodyField: LifecycleIssueField =
    channel === 'telegram' && input.parseMode ? 'richBodyTemplate' : 'bodyTemplate'
  const projectionBody =
    channel === 'telegram' && input.parseMode && richRendered !== null ? richRendered : body
  const canonical = projectAndValidate(title, projectionBody)
  issues.push(...canonicalIssuesToLifecycle(canonical, bodyField))

  // تيليجرام بنص غني: المتن البسيط يبقى نصاً احتياطياً يصل للمستخدم حين يفشل
  // تحليل HTML — يجب أن يحقق هو الآخر القواعد الرسمية (حدود/RTL/تحكم).
  if (channel === 'telegram' && input.parseMode && richRendered !== null) {
    const fallback = projectAndValidate(title, body)
    for (const issue of canonicalIssuesToLifecycle(fallback, 'bodyTemplate')) {
      if (issue.field === 'bodyTemplate') issues.push(issue) // مشاكل العنوان مغطاة أعلاه
    }
  }

  // --- Variable contract (all channels) ---
  const contract = getVariableContract(input.type)
  const declared = input.variables ?? []
  if (!contract) {
    issues.push({
      code: 'unknown_template_type',
      field: 'type',
      message: 'نوع القالب غير معروف في عقد المتغيرات',
      severity: 'error',
    })
  } else {
    const known = new Set(contract.map((definition) => definition.name))
    for (const name of declared) {
      if (!known.has(name)) {
        issues.push({
          code: 'unknown_variable',
          field: 'variables',
          message: `المتغير "${name}" غير موجود في عقد النوع`,
          severity: 'error',
          path: `vars.${name}`,
        })
      }
    }
    for (const definition of contract) {
      if (!declared.includes(definition.name)) {
        issues.push({
          code: 'missing_variable',
          field: 'variables',
          message: `المتغير "${definition.name}" مطلوب في العقد وغير مُعلن`,
          severity: 'warning',
          path: `vars.${definition.name}`,
        })
      }
    }
  }

  // --- Telegram-only rules ---
  if (channel === 'telegram') {
    // exactly-one-field: the rich payload must bind to exactly one mode —
    // parseMode ⟺ richBodyTemplate, never one without the other.
    if (input.parseMode && !input.richBodyTemplate?.trim()) {
      issues.push({
        code: 'exactly_one_field',
        field: 'parseMode',
        message: 'parseMode يتطلب نصاً غنياً (richBodyTemplate) — لا يجوز تحديد نصف الحقلين',
        severity: 'error',
      })
    }
    if (!input.parseMode && input.richBodyTemplate?.trim()) {
      issues.push({
        code: 'exactly_one_field',
        field: 'richBodyTemplate',
        message: 'النص الغني يتطلب parseMode (HTML أو MarkdownV2)',
        severity: 'error',
      })
    }

    const rich = input.richBodyTemplate ?? ''
    if (input.parseMode) {
      // media perms + official tag whitelist (HTML mode).
      if (MEDIA_TAG_RE.test(rich)) {
        issues.push({
          code: 'media_perms',
          field: 'richBodyTemplate',
          message: 'وسوم الوسائط (صورة/فيديو/صوت) غير مسموحة في رسائل تيليجرام',
          severity: 'error',
        })
      }
      if (input.parseMode === 'HTML') {
        let match: RegExpExecArray | null
        ANY_TAG_RE.lastIndex = 0
        while ((match = ANY_TAG_RE.exec(rich)) !== null) {
          const tag = match[1].toLowerCase()
          if (MEDIA_TAG_RE.test(`<${tag}`)) continue // already reported
          if (!TELEGRAM_HTML_ALLOWED_TAGS.has(tag)) {
            issues.push({
              code: 'unsupported_tag',
              field: 'richBodyTemplate',
              message: `الوسم <${tag}> غير مدعوم في HTML الخاص بتيليجرام`,
              severity: 'error',
              path: `richBodyTemplate:${match.index}`,
            })
          }
        }
      }
    }

    // reject draft constructs in both payload candidates (body stays the
    // fallback text, so it must be flat too).
    if (DRAFT_CONSTRUCT_RE.test(rich)) {
      issues.push({
        code: 'draft_construct',
        field: 'richBodyTemplate',
        message: 'بنية مسودة (block helper / partial / تعليق / triple-stash) غير مدعومة في القالب',
        severity: 'error',
      })
    }
    if (DRAFT_CONSTRUCT_RE.test(input.bodyTemplate)) {
      issues.push({
        code: 'draft_construct',
        field: 'bodyTemplate',
        message: 'بنية مسودة (block helper / partial / تعليق / triple-stash) غير مدعومة في القالب',
        severity: 'error',
      })
    }
  }

  // --- Email HTML-safety ---
  if (channel === 'email') {
    if (/\{\{\{/.test(input.bodyTemplate) || /\{\{\{/.test(input.titleTemplate)) {
      issues.push({
        code: 'html_unescaped',
        field: 'bodyTemplate',
        message: 'استخدام {{{ }}} يُدخل HTML غير مهرَّب — راجع أمان العرض',
        severity: 'warning',
      })
    }
    if (body.length > 100_000) {
      issues.push({
        code: 'oversized_body',
        field: 'bodyTemplate',
        message: 'متن البريد يتجاوز 100000 حرف',
        severity: 'warning',
      })
    }
  }

  const renderedTotal = title.length + projectionBody.length
  const result: TemplateValidationResult = {
    ok: issues.every((issue) => issue.severity !== 'error'),
    issues,
    metrics: {
      renderedTitleLength: title.length,
      renderedBodyLength: projectionBody.length,
      renderedTotalLength: renderedTotal,
      withinTelegramLimit: renderedTotal <= RICH_TEXT_LIMITS.maxTotalLength,
      declaredVariableCount: declared.length,
      contractVariableCount: contract?.length ?? 0,
      hasRichPayload: Boolean(input.parseMode),
    },
  }
  return result
}

// ===== Preview matrix (procedure #4) =====

export interface PreviewSurface {
  surface: string
  text: string
  html?: string
  payload?: Record<string, unknown>
  dir?: 'rtl' | 'ltr'
  note?: string
  metrics: Record<string, string | number | boolean>
}

export interface PreviewMatrix {
  channel: string
  surfaces: PreviewSurface[]
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

/**
 * Channel-aware preview matrix:
 *  - telegram: channel/group/topic renderings + serialized Bot API payloads +
 *    length metrics;
 *  - email: desktop/mobile/dark/plaintext surfaces;
 *  - in_app: bell/list/detail surfaces with explicit RTL direction.
 * Pure — callers pass an already-loaded template.
 */
export function buildPreviewMatrix(
  template: Pick<
    NotificationTemplate,
    'type' | 'channel' | 'titleTemplate' | 'bodyTemplate' | 'richBodyTemplate' | 'parseMode'
  >,
  variables: Record<string, unknown>,
): PreviewMatrix {
  if (template.channel === 'telegram') {
    const { text } = telegramRenderedText(template, variables)
    const baseMetrics = {
      characters: text.length,
      withinLimit: text.length <= RICH_TEXT_LIMITS.maxTotalLength,
      titleCharacters: compileAndRender(template.titleTemplate, variables).length,
      parseMode: template.parseMode ?? 'none',
      hasRichPayload: Boolean(template.parseMode),
    }
    const payloadFor = (surface: 'channel' | 'group' | 'topic'): Record<string, unknown> => ({
      surface,
      chat_id: '<registry-destination>',
      text,
      ...(template.parseMode ? { parse_mode: template.parseMode } : {}),
      ...(surface === 'topic' ? { message_thread_id: null } : {}),
      disable_web_page_preview: true,
    })
    const notes = {
      channel: 'قناة — بلا سياق محادثة، المحتوى فقط',
      group: 'مجموعة — يظهر اسم المحادثة والمرسل',
      topic: 'موضوع داخل مجموعة — مرتبط بخيط (message_thread_id)',
    }
    return {
      channel: 'telegram',
      surfaces: (['channel', 'group', 'topic'] as const).map((surface) => ({
        surface,
        text,
        payload: payloadFor(surface),
        note: notes[surface],
        metrics: baseMetrics,
      })),
    }
  }

  if (template.channel === 'email') {
    const { title, body } = renderTemplateFields(template, variables)
    const html = generateEmailWrapper({
      title,
      body,
      recipientName: (variables.recipientName as string | undefined) ?? undefined,
      actionUrl: (variables.actionUrl as string | undefined) ?? undefined,
      actionLabel: (variables.actionLabel as string | undefined) ?? undefined,
    })
    const darkHtml = html.replace(
      '</head>',
      '<style>/* dark surface */ html,body{background:#111 !important;} table[bgcolor],table{background-color:#1a1a2e !important;} td{color:#eee !important;} h1,h2,p,span,div{color:#eee !important;}</style></head>',
    )
    const plaintext = `${stripHtml(title)}\n\n${stripHtml(body)}`
    const metrics = {
      htmlBytes: html.length,
      textCharacters: plaintext.length,
      dirRtl: html.includes('dir="rtl"'),
      hasDarkSurface: true,
    }
    return {
      channel: 'email',
      surfaces: [
        { surface: 'desktop', text: plaintext, html, metrics },
        {
          surface: 'mobile',
          text: plaintext,
          html,
          note: 'عرض متجاوب (viewport) — نفس HTML بمقاسات متدفقة',
          metrics,
        },
        {
          surface: 'dark',
          text: plaintext,
          html: darkHtml,
          note: 'سطح داكن عبر تجاوز CSS',
          metrics,
        },
        { surface: 'plaintext', text: plaintext, note: 'نص خام بلا HTML', metrics },
      ],
    }
  }

  // in_app — bell / list / detail, RTL by contract (Arabic-first app).
  const { title, body } = renderTemplateFields(template, variables)
  const metrics = {
    titleLength: title.length,
    bodyLength: body.length,
    bellTruncated: truncate(`${title} — ${body}`, 120) !== `${title} — ${body}`,
  }
  return {
    channel: 'in_app',
    surfaces: [
      {
        surface: 'bell',
        text: truncate(`${title} — ${body}`, 120),
        dir: 'rtl',
        note: 'إشعار الدفع — سطر واحد مختصر',
        metrics,
      },
      {
        surface: 'list',
        text: truncate(body, 80),
        dir: 'rtl',
        note: 'قائمة الإشعارات — عنوان + معاينة',
        metrics,
      },
      { surface: 'detail', text: body, dir: 'rtl', note: 'تفاصيل الإشعار — النص الكامل', metrics },
    ],
  }
}

// ===== Sample HTML-safety (procedure #12) =====

export interface HtmlSafeSample {
  name: string
  raw: string
  /** true when the value carries no raw HTML metacharacters. */
  safe: boolean
  /** HTML-escaped copy — safe to interpolate into email surfaces. */
  escaped: string
}

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** HTML-safety verdict for one sample value (stringified). */
export function htmlSafetyForSample(name: string, value: unknown): HtmlSafeSample {
  const raw = typeof value === 'string' ? value : String(value)
  return {
    name,
    raw,
    safe: !/[<>&]/.test(raw),
    escaped: escapeHtmlText(raw),
  }
}

/**
 * Contract-driven samples with HTML-safety flags — fills every contract
 * variable (numbers get an in-range integer) and merges caller overrides.
 */
export function contractSamplesFor(
  type: string,
  overrides?: Record<string, unknown>,
): { samples: Record<string, unknown>; htmlSafety: HtmlSafeSample[] } {
  const contract = getVariableContract(type) ?? []
  const base = renderSampleVariables(type)
  const samples: Record<string, unknown> = {}
  for (const definition of contract) {
    if (definition.kind === 'number') {
      const fallback = definition.min ?? 0
      samples[definition.name] =
        typeof base[definition.name] === 'number' ? base[definition.name] : fallback
    } else {
      const value = base[definition.name]
      samples[definition.name] = value !== undefined ? value : `(${definition.name})`
    }
  }
  if (overrides) {
    for (const [name, value] of Object.entries(overrides)) samples[name] = value
  }
  const htmlSafety = Object.entries(samples).map(([name, value]) =>
    htmlSafetyForSample(name, value),
  )
  return { samples, htmlSafety }
}

// ===== Version snapshots (persistence layer duty from P1) =====

export interface SnapshotOptions {
  changedBy?: string | null
  changeNote?: string | null
  /** Rethrow instead of logging — callers where history is mandatory. */
  strict?: boolean
}

/**
 * Immutable NotificationTemplateVersion row for the template's CURRENT
 * version (P1: "لقطة غير قابلة للتعديل لكل تعديل — تُملأ من طبقة الحفظ").
 * Best-effort by default so a legacy CRUD edit never 500s on history write;
 * pass strict for rollback/import where history is the point.
 */
export async function snapshotTemplateVersion(
  template: NotificationTemplate,
  opts: SnapshotOptions = {},
): Promise<void> {
  try {
    await db.notificationTemplateVersion.create({
      data: {
        templateId: template.id,
        version: template.version,
        type: template.type,
        channel: template.channel,
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        richBodyTemplate: template.richBodyTemplate ?? null,
        parseMode: template.parseMode ?? null,
        variables: (template.variables ?? []) as Prisma.InputJsonValue,
        isActive: template.isActive,
        changedBy: opts.changedBy ?? null,
        changeNote: opts.changeNote ?? null,
      },
    })
  } catch (err) {
    if (opts.strict) throw err
    logger.error('[template-lifecycle] snapshot write failed:', err)
  }
}

/** Does a snapshot already exist for this (template, version)? */
export async function snapshotExists(templateId: string, version: number): Promise<boolean> {
  const row = await db.notificationTemplateVersion.findUnique({
    where: { templateId_version: { templateId, version } },
    select: { id: true },
  })
  return Boolean(row)
}

// ===== Loader for [id] lifecycle routes =====

export type LoadTemplateResult =
  | { template: NotificationTemplate; response?: undefined }
  | { response: Response; template?: undefined }

/**
 * Load a template for a [id] lifecycle route: 404 when missing, 403 when it
 * is a security template (server-enforced exclusion on every mutation and
 * sub-resource read).
 */
export async function loadTemplateForLifecycle(id: string): Promise<LoadTemplateResult> {
  const template = await db.notificationTemplate.findUnique({ where: { id } })
  if (!template) return { response: notFound('القالب غير موجود') }
  const guard = securityTemplateGuard(template)
  if (guard) return { response: guard }
  return { template }
}

// ===== Snapshot row type re-export for route tests =====

export type TemplateVersionRow = NotificationTemplateVersion
