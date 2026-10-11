/**
 * lib/telegram-html.ts — قواعد HTML الخاصة بتليجرام (مصدر واحد للحقيقة).
 *
 * وُلِد هذا الملف من استخراج القواعد المحلية في `lib/template-lifecycle.ts`
 * (Phase 3) كي تتشارك دورة حياة القوالب ومحرّر المنشورات نفس النسخة — لا نسخ
 * ثانٍ ينحرف تدريجياً (قرار D6 في خطة Social Hub).
 *
 * طبقتان هنا، وجب التفريق بينهما حرفياً:
 *
 *  1) `TELEGRAM_HTML_ALLOWED_TAGS` — وسم HTML الرسمي لـ `parse_mode=HTML`
 *     في `sendMessage`/`sendPhoto` (الرسائل الكلاسيكية). وسوم الوسائط ممنوعة
 *     نهائياً لأن الوسائط تُرسل عبر حقل `photo`/`caption` منفصل.
 *
 *  2) `TELEGRAM_RICH_HTML_ALLOWED_TAGS` — وسوم «الرسائل الغنية» في
 *     Bot API 10.3 (`sendRichMessage`). هنا الوسائط مسموحة لكن **كتل مستقلة**
 *     (`<img>`/`<video>`/`<audio>`/`<tg-document>`)، والجداول والقوائم
 *     والتفاصيل والصيغ الرياضية كلها جزء من التنسيق الرسمي.
 *
 * المرجع: https://core.telegram.org/bots/api#rich-messages
 *         https://core.telegram.org/bots/api#sendrichmessage
 *         https://github.com/vdistortion/tg-rich-messages
 */

// ===== حدود الرسائل الكلاسيكية (sendMessage / sendPhoto) =====

export const TELEGRAM_MESSAGE_LIMITS = {
  /** الحد الأقصى لنص الرسالة النصية. */
  maxLength: 4096,
  /** الحد الأقصى لنص التعليق (caption) مع الوسائط. */
  maxCaptionLength: 1024,
} as const

// ===== حدود الرسائل الغنية (Bot API 10.3 — Rich Message Limits) =====

/**
 * الحدود الرسمية للرسائل الغنية كما هي موثّقة في Bot API 10.3.
 * نفس القيم التي يتحقق منها `validate()` في مكتبة `tg-rich-messages`.
 */
export const TELEGRAM_RICH_MESSAGE_LIMITS = {
  /** أقصى عدد حرف (UTF-8 code points) في نص الرسالة الغنية. */
  maxTextLength: 32768,
  /** أقصى عدد كتل — يشمل الكتل المتداخلة وعناصر القوائم وصفوف الجداول. */
  maxBlocks: 500,
  /** أقصى عمق تداخل للتنسيق والكتل. */
  maxNestingDepth: 16,
  /** أقصى عدد مرفقات وسائط. */
  maxMedia: 50,
  /** أقصى عدد أعمدة في جدول. */
  maxTableColumns: 20,
} as const

// ===== الطبقة 1 — HTML الكلاسيكي (parse_mode=HTML) =====

/**
 * وسوم HTML الرسمية المدعومة في `parse_mode=HTML` (sendMessage/sendPhoto).
 * وسوم الوسائط والدمج (embed) لا تُقبل أبداً — binding: media perms.
 */
export const TELEGRAM_HTML_ALLOWED_TAGS: ReadonlySet<string> = new Set([
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

/** وسوم تشير إلى وسائط — تُرفض في كل وضع تحليل كلاسيكي. */
export const MEDIA_TAG_RE =
  /<(img|video|audio|iframe|embed|object|source|picture|track|svg|canvas)\b/i

/** يلتقط أي وسم HTML مفتوح/مغلق مع اسمه. حَالة lastIndex تُضبط قبل كل حلقة. */
export const ANY_TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g

// ===== الطبقة 2 — HTML الرسائل الغنية (Bot API 10.3) =====

/**
 * وسوم HTML الرسمية المدعومة في حقل `html` من `InputRichMessage`.
 * المرجع: قسم "Rich HTML style" في Bot API 10.3.
 *
 * الفروق الجوهرية عن الطبقة 1:
 *  - الوسائط (`img`/`video`/`audio`/`tg-document`) مسموحة ككتل مستقلة.
 *  - عناصر بنيوية: عناوين، فقرات، قوائم، جداول، تفاصيل، اقتباسات، خرائط.
 *  - تنسيق إضافي: mark / sub / sup / tg-time / tg-math / tg-reference.
 */
export const TELEGRAM_RICH_HTML_ALLOWED_TAGS: ReadonlySet<string> = new Set([
  // تنسيق سطر
  'a',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'code',
  'mark',
  'sub',
  'sup',
  'br',
  'tg-spoiler',
  'tg-reference',
  'tg-emoji',
  'tg-time',
  'tg-math',
  // كتل بنيوية
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'pre',
  'footer',
  'hr',
  'ul',
  'ol',
  'li',
  'input', // عنصر اختيار داخل قائمة المهام
  'blockquote',
  'cite',
  'aside',
  // وسائط (كتل مستقلة فقط)
  'img',
  'video',
  'audio',
  'tg-document',
  'figure',
  'figcaption',
  'tg-map',
  'tg-collage',
  'tg-slideshow',
  // جداول
  'table',
  'caption',
  'tr',
  'th',
  'td',
  // كتل قابلة للطي + صيغ رياضية + أزرار
  'details',
  'summary',
  'tg-math-block',
  'tg-button',
  'tg-button-row',
])

/** وسوم تُرفض في الرسائل الغنية أصلاً (لا معنى لها في Bot API 10.3). */
export const TELEGRAM_RICH_HTML_FORBIDDEN_TAGS: ReadonlySet<string> = new Set([
  'iframe',
  'embed',
  'object',
  'source',
  'picture',
  'track',
  'svg',
  'canvas',
  'script',
  'style',
  'link',
  'meta',
  'form',
])

// ===== أدوات المسح (حالة آمنة — لا مشاركة بين نداءات) =====

interface HtmlTagHit {
  tag: string
  index: number
}

/** يمسح كل وسوم HTML في النص مع مواضعها (يستخدم نسخة محلية من النمط). */
export function scanHtmlTags(html: string): HtmlTagHit[] {
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g
  const hits: HtmlTagHit[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    hits.push({ tag: match[1].toLowerCase(), index: match.index })
  }
  return hits
}

/** هل هذا الاسم وسم وسائط (يُرفض في الوضع الكلاسيكي)؟ */
export function isTelegramMediaTag(tag: string): boolean {
  return MEDIA_TAG_RE.test(`<${tag}`)
}

/**
 * تحقق وسوم HTML في نص كلاسيكي (`parse_mode=HTML`).
 * @returns أسماء الوسوم غير المسموحة (بدون تكرار، بترتيب ظهورها).
 */
export function validateTelegramHtmlTags(html: string): string[] {
  const unsupported: string[] = []
  const seen = new Set<string>()
  for (const hit of scanHtmlTags(html)) {
    if (isTelegramMediaTag(hit.tag)) {
      if (!seen.has(hit.tag)) {
        seen.add(hit.tag)
        unsupported.push(hit.tag)
      }
      continue
    }
    if (!TELEGRAM_HTML_ALLOWED_TAGS.has(hit.tag) && !seen.has(hit.tag)) {
      seen.add(hit.tag)
      unsupported.push(hit.tag)
    }
  }
  return unsupported
}

/**
 * تحقق وسوم HTML في نص غني (`InputRichMessage.html` — Bot API 10.3).
 * الوسائط هنا مسموحة (كتل مستقلة)، لكن كل وسم خارج القائمة الرسمية يُرفض.
 * @returns أسماء الوسوم غير المسموحة (بدون تكرار، بترتيب ظهورها).
 */
export function validateTelegramRichHtmlTags(html: string): string[] {
  const unsupported: string[] = []
  const seen = new Set<string>()
  for (const hit of scanHtmlTags(html)) {
    if (seen.has(hit.tag)) continue
    if (TELEGRAM_RICH_HTML_FORBIDDEN_TAGS.has(hit.tag)) {
      seen.add(hit.tag)
      unsupported.push(hit.tag)
      continue
    }
    if (!TELEGRAM_RICH_HTML_ALLOWED_TAGS.has(hit.tag)) {
      seen.add(hit.tag)
      unsupported.push(hit.tag)
    }
  }
  return unsupported
}

// ===== التقسيم (مطابق لسلوك sendMessage في lib/telegram-bot.ts) =====

/**
 * عدد الأجزاء التي سيقسّمها تليجرام النص إليها (>4096).
 * تُستخدم في مقاييس المعاينة/التحقق — لا إرسال هنا.
 */
export function countTelegramMessageChunks(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / TELEGRAM_MESSAGE_LIMITS.maxLength))
}

/**
 * تقسيم نص إلى أجزاء ≤ maxLength عند حدود أسطر كاملة قدر الإمكان.
 * نفس خوارزمية `splitMessage` في lib/telegram-bot.ts (منسخة نقية هنا كي
 * تُحسب المقاييس بلا استيراد طبقة الإرسال).
 */
export function splitTelegramMessage(
  text: string,
  maxLength: number = TELEGRAM_MESSAGE_LIMITS.maxLength,
): string[] {
  if (text.length <= maxLength) return text ? [text] : []

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    let splitIdx = remaining.lastIndexOf('\n', maxLength)
    if (splitIdx === 0 || splitIdx === -1) {
      splitIdx = maxLength
    }

    chunks.push(remaining.slice(0, splitIdx))
    remaining = remaining.slice(splitIdx).trimStart()
  }

  return chunks
}
