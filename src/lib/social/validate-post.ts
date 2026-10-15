/**
 * lib/social/validate-post.ts — منطق التحقق/المعاينة المشترك للمنشورات.
 *
 * مصدر واحد للقواعد يستهلكه كل من:
 *   POST /api/admin/social/posts/[id]/validate
 *   POST /api/admin/social/posts/[id]/preview
 *
 * القواعد (الخطة §7 A3 + A0 + تحديث المالك #1):
 *  - تجميع النص: `title` + '\n\n' + `body` عند وجود العنوان (نفس §4.1).
 *  - HTML: وسوم الطبقة الكلاسيكية في الوضع العادي، ووسوم Bot API 10.3
 *    في الوضع الغني (`richDocument != null`) — عبر lib/telegram-html.ts.
 *  - الحدود: 4096 للنص، 1024 للتعليق حين توجد وسائط، وحدود الرسائل الغنية
 *    (32768/500/16/50/20) في الوضع الغني.
 *  - bidi/control: عبر `validateRichDocument` من `@/domain/rich-text` على
 *    مستند رمزي — نفس أسلوب `projectAndValidate` في template-lifecycle،
 *    بلا نسخة ثانية من قواعد الاتجاه.
 */

import { RICH_DOCUMENT_VERSION, RICH_TEXT_LIMITS, validateRichDocument } from '@/domain/rich-text'
import {
  countTelegramMessageChunks,
  splitTelegramMessage,
  TELEGRAM_MESSAGE_LIMITS,
  TELEGRAM_RICH_MESSAGE_LIMITS,
  validateTelegramHtmlTags,
  validateTelegramRichHtmlTags,
} from '@/lib/telegram-html'
import {
  countRichSpecBlocks,
  countRichSpecMedia,
  isRichPostSpec,
  measureRichSpecDepth,
  measureRichSpecTableColumns,
  type RichPostSpec,
  renderRichPostHtml,
  toRichMessageInput,
} from './rich-post'

export interface PostIssue {
  field: string
  code: string
  message: string
}

export interface PostMetrics {
  renderedLength: number
  chunks: number
  withinLimit: boolean
  /** هل المنشور في وضع غني (Bot API 10.3)؟ */
  isRich: boolean
  /** مقاييس الوضع الغني — تُملأ فقط حين isRich. */
  rich?: {
    blocks: number
    media: number
    maxNestingDepth: number
    maxTableColumns: number
    htmlLength: number
  }
}

export interface PostValidationInput {
  title?: string | null
  body: string
  parseMode?: string | null
  mediaUrl?: string | null
  /** قيمة `SocialPost.richDocument` (JSON خام من Prisma أو من الطلب). */
  richDocument?: unknown
  /** العربية واجهة افتراضية — `is_rtl: true` في الوضع الغني. */
  isRtl?: boolean
}

export interface PostPreview {
  text: string
  parseMode: 'HTML' | null
  photo: {
    url: string
    caption: string
    captionWithinLimit: boolean
  } | null
  chunks: number
  /** موجود فقط في الوضع الغني. */
  rich?: {
    html: string
    input: { html?: string; markdown?: string; is_rtl?: boolean; skip_entity_detection?: boolean }
    blocks: number
    media: number
  }
}

export interface PostValidationResult {
  ok: boolean
  issues: PostIssue[]
  metrics: PostMetrics
  preview: PostPreview
}

// ===== أدوات مساعدة =====

/**
 * تجميع النص النهائي كما سيرسله المحرّك (§4.1 خطوة 4).
 * في الوضع الغني يُعرض HTML الناتج من toHTML() كنص المعاينة.
 */
export function renderPostText(input: {
  title?: string | null
  body: string
  richDocument?: unknown
}): string {
  const title = (input.title ?? '').trim()
  const body = input.body ?? ''
  if (input.richDocument != null && isRichPostSpec(input.richDocument)) {
    const html = renderRichPostHtml(input.richDocument)
    return title ? `${title}\n\n${html}` : html
  }
  return title ? `${title}\n\n${body}` : body
}

/**
 * تحويل مشاكل `validateRichDocument` إلى مشاكل المنشور.
 * (نفس منطق canonicalIssuesToLifecycle في template-lifecycle — بلا نسخة
 * من قواعد الاتجاه؛ هنا ترجمة حقل أبسط: title/body.)
 */
const CANONICAL_MESSAGE_AR: Record<string, string> = {
  not_an_object: 'بنية غير صالحة',
  unsupported_version: 'إصدار مستند غير مدعوم',
  empty_body: 'متن المنشور فارغ بعد العرض',
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

/** اختبار بروتوكولي للاتجاه/أحرف التحكم — بلا كتابة على قاعدة البيانات. */
function checkDirectionAndControls(title: string, body: string, issues: PostIssue[]): void {
  const doc = {
    version: RICH_DOCUMENT_VERSION,
    title: title ? [{ kind: 'text', text: title, marks: [] }] : [],
    body: [{ kind: 'text', text: body, marks: [] }],
  }
  const result = validateRichDocument(doc)
  for (const issue of result.issues) {
    if (issue.code !== 'control_chars' && issue.code !== 'direction_override') continue
    const isTitle = issue.path.startsWith('title')
    issues.push({
      field: isTitle ? 'title' : 'body',
      code: issue.code,
      message: CANONICAL_MESSAGE_AR[issue.code] ?? issue.message,
    })
  }
}

// ===== الدالة الرئيسية =====

/**
 * تحقق المنشور بلا أي كتابة. تُرجع النتيجة كاملة كي يستهلكها مسار
 * المعاينة بلا إعادة حساب.
 */
export function validateSocialPost(input: PostValidationInput): PostValidationResult {
  const issues: PostIssue[] = []
  const title = (input.title ?? '').trim()
  const body = input.body ?? ''
  const parseMode = input.parseMode === 'HTML' ? 'HTML' : null
  const mediaUrl = input.mediaUrl?.trim() || null
  const hasMedia = Boolean(mediaUrl)

  // ===== الوضع الغني؟ =====
  const rawRich = input.richDocument
  let richSpec: RichPostSpec | null = null
  if (rawRich != null) {
    if (!isRichPostSpec(rawRich)) {
      issues.push({
        field: 'richDocument',
        code: 'invalid_rich_spec',
        message: 'مواصفة الرسالة الغنية غير صالحة أو إصدار غير مدعوم',
      })
    } else {
      richSpec = rawRich
    }
  }

  // ===== HTML tag whitelist =====
  if (parseMode === 'HTML') {
    if (richSpec) {
      // الوضع الغني: نتحقق HTML الناتج فعلياً (لا سلوك منفصل).
      let renderedHtml = ''
      try {
        renderedHtml = renderRichPostHtml(richSpec)
      } catch {
        issues.push({
          field: 'richDocument',
          code: 'rich_render_failed',
          message: 'تعذّر بناء HTML من مواصفة الرسالة الغنية',
        })
      }
      if (renderedHtml) {
        for (const tag of validateTelegramRichHtmlTags(renderedHtml)) {
          issues.push({
            field: 'richDocument',
            code: 'unsupported_tag',
            message: `وسم غير مدعوم في الرسالة الغنية: <${tag}>`,
          })
        }
      }
      // العنوان يُرسل ضمن HTML الغني أيضًا — افحصه بقواعد الغني.
      if (title) {
        for (const tag of validateTelegramRichHtmlTags(title)) {
          issues.push({
            field: 'title',
            code: 'unsupported_tag',
            message: `وسم غير مدعوم في العنوان: <${tag}>`,
          })
        }
      }
    } else {
      const rendered = renderPostText({ title, body })
      for (const tag of validateTelegramHtmlTags(rendered)) {
        issues.push({
          field: tag === 'img' || tag === 'video' || tag === 'audio' ? 'mediaUrl' : 'body',
          code:
            tag === 'img' || tag === 'video' || tag === 'audio' ? 'media_tag' : 'unsupported_tag',
          message:
            tag === 'img' || tag === 'video' || tag === 'audio'
              ? `وسوم الوسائط ممنوعة في نص الرسالة (<${tag}>) — استخدم mediaUrl`
              : `وسم غير مدعوم: <${tag}>`,
        })
      }
    }
  }

  // ===== bidi / control chars =====
  checkDirectionAndControls(title, body, issues)

  // ===== الحدود =====
  const text = renderPostText({ title, body, richDocument: richSpec ?? undefined })

  if (!richSpec) {
    const maxLen = hasMedia
      ? TELEGRAM_MESSAGE_LIMITS.maxCaptionLength
      : TELEGRAM_MESSAGE_LIMITS.maxLength
    if (text.length > maxLen) {
      issues.push({
        field: 'body',
        code: 'too_long',
        message: hasMedia
          ? `التعليق مع الوسائط يتجاوز ${maxLen} حرفاً (الطول الحالي ${text.length})`
          : `النص يتجاوز ${maxLen} حرفاً (الطول الحالي ${text.length})`,
      })
    }
  } else {
    // حدود Bot API 10.3 للرسائل الغنية.
    const blocks = countRichSpecBlocks(richSpec)
    const media = countRichSpecMedia(richSpec)
    const depth = measureRichSpecDepth(richSpec)
    const cols = measureRichSpecTableColumns(richSpec)
    if (text.length > TELEGRAM_RICH_MESSAGE_LIMITS.maxTextLength) {
      issues.push({
        field: 'richDocument',
        code: 'too_long',
        message: `الرسالة الغنية تتجاوز ${TELEGRAM_RICH_MESSAGE_LIMITS.maxTextLength} حرفاً`,
      })
    }
    if (blocks > TELEGRAM_RICH_MESSAGE_LIMITS.maxBlocks) {
      issues.push({
        field: 'richDocument',
        code: 'too_many_blocks',
        message: `عدد الكتل (${blocks}) يتجاوز الحد ${TELEGRAM_RICH_MESSAGE_LIMITS.maxBlocks}`,
      })
    }
    if (depth > TELEGRAM_RICH_MESSAGE_LIMITS.maxNestingDepth) {
      issues.push({
        field: 'richDocument',
        code: 'too_deep',
        message: `عمق التداخل (${depth}) يتجاوز الحد ${TELEGRAM_RICH_MESSAGE_LIMITS.maxNestingDepth}`,
      })
    }
    if (media > TELEGRAM_RICH_MESSAGE_LIMITS.maxMedia) {
      issues.push({
        field: 'richDocument',
        code: 'too_many_media',
        message: `عدد الوسائط (${media}) يتجاوز الحد ${TELEGRAM_RICH_MESSAGE_LIMITS.maxMedia}`,
      })
    }
    if (cols > TELEGRAM_RICH_MESSAGE_LIMITS.maxTableColumns) {
      issues.push({
        field: 'richDocument',
        code: 'too_many_columns',
        message: `عدد أعمدة الجدول (${cols}) يتجاوز الحد ${TELEGRAM_RICH_MESSAGE_LIMITS.maxTableColumns}`,
      })
    }
  }

  // ===== المعاينة =====
  const chunks = countTelegramMessageChunks(text)
  const photo = hasMedia
    ? {
        url: mediaUrl as string,
        caption: text,
        captionWithinLimit: text.length <= TELEGRAM_MESSAGE_LIMITS.maxCaptionLength,
      }
    : null

  const preview: PostPreview = {
    text,
    parseMode,
    photo,
    chunks,
  }

  if (richSpec) {
    try {
      const html = renderRichPostHtml(richSpec)
      const richInput = toRichMessageInput(richSpec, { isRtl: input.isRtl ?? true })
      preview.rich = {
        html,
        input: richInput,
        blocks: countRichSpecBlocks(richSpec),
        media: countRichSpecMedia(richSpec),
      }
    } catch {
      // سبق أن سجّلنا issue — المعاينة تبقى بلا حقل rich.
    }
  }

  const metrics: PostMetrics = {
    renderedLength: text.length,
    chunks,
    withinLimit: richSpec
      ? text.length <= TELEGRAM_RICH_MESSAGE_LIMITS.maxTextLength
      : text.length <=
        (hasMedia ? TELEGRAM_MESSAGE_LIMITS.maxCaptionLength : TELEGRAM_MESSAGE_LIMITS.maxLength),
    isRich: Boolean(richSpec),
  }
  if (richSpec) {
    metrics.rich = {
      blocks: countRichSpecBlocks(richSpec),
      media: countRichSpecMedia(richSpec),
      maxNestingDepth: measureRichSpecDepth(richSpec),
      maxTableColumns: measureRichSpecTableColumns(richSpec),
      htmlLength: preview.rich?.html.length ?? 0,
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    metrics,
    preview,
  }
}

/** التقسيم الفعلي للأجزاء (للاختبار/المقاييس) — نفس خوارزمية تليجرام. */
export function chunkPostText(text: string): string[] {
  return splitTelegramMessage(text)
}
