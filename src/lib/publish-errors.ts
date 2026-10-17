/**
 * lib/publish-errors.ts — كتالوج أخطاء النشر (المرحلة 6، الفئة 7).
 *
 * لكل رمز: `causeAr` (السبب بالعربية) + `fixAr` (خطوات الإصلاح) + `retryable`
 * (هل إعادة المحاولة التلقائية ذات جدوى). ملف نقي بلا تبعيات Node — يجوز
 * استيراده من مكوّنات العميل (post-editor، صفحات الأرشيف، مساعدة النشر).
 *
 * القاعدة: لا خطأ بلا رمز — كل فشل كتابة/تنفيذ/إجراء مرّ عبر الكتالوج،
 * وسُجّل في PublishErrorEvent بهذا الرمز.
 */

export type PublishErrorScope = 'post' | 'route' | 'bot' | 'destination' | 'schedule'

export interface PublishErrorDef {
  /** السبب بالعربية — ما حدث فعلاً. */
  readonly causeAr: string
  /** الإصلاح خطوة بخطوة بالعربية — يُعرض في «كيف أصلحه؟». */
  readonly fixAr: string
  /** هل إعادة المحاولة (تلقائية أو من مركز الأخطاء) ذات جدوى؟ */
  readonly retryable: boolean
}

export const PUBLISH_ERROR_CATALOG = {
  unknown: {
    causeAr: 'خطأ غير مصنّف في النشر',
    fixAr: 'افتح مركز الأخطاء وسجّل النص الخام إن تكرر — ثم راجع سجل التدقيق.',
    retryable: true,
  },

  // ===== الإعداد (بلا استهلاك محاولة) =====
  destination_missing: {
    causeAr: 'الوجهة المربوطة بالمنشور غير موجودة (حُذفت أو مُعرّفها قديم).',
    fixAr: 'افتح صفحة الوجهات، أنشئ/وثّق الوجهة، ثم أعد ربط المنشور أو هدفه بها.',
    retryable: false,
  },
  destination_not_qualified: {
    causeAr: 'الوجهة غير مؤهلة للإرسال (غير نشطة أو غير موثّقة).',
    fixAr: 'افتح صفحة الوجهات، وثّق الوجهة (تحقق كلمة إضافية عند إضافة البوت)، ثم فعّلها.',
    retryable: false,
  },
  destination_archived: {
    causeAr: 'الوجهة مؤرشفة — لا تُرسل الرسائل إليها.',
    fixAr: 'استعد الوجهة من الأرشيف أو أعد ربط الهدف لوجهة نشطة موثّقة.',
    retryable: false,
  },
  env_channel_missing: {
    causeAr: 'لا توجد وجهة مُتحقَّق منها ولا TELEGRAM_CHANNEL_ID في البيئة.',
    fixAr: 'أضف وجهة فعّالة موثّقة كبديل عن متغير البيئة القديم.',
    retryable: false,
  },
  bot_missing: {
    causeAr: 'بوت الإرسال غير موجود في السجل.',
    fixAr: 'أضف البوت من صفحة البوتات (توكن صالح) ثم أعد ربط الوجهة به.',
    retryable: false,
  },
  bot_not_active: {
    causeAr: 'بوت الإرسال غير نشط (موقوف).',
    fixAr: 'أعد تنشيط البوت من صفحة البوتات أو عيّن بوتاً نشطاً للوجهة.',
    retryable: false,
  },
  bot_token_decrypt: {
    causeAr: 'تعذّر فك تشفير توكن البوت.',
    fixAr: 'أعد إدخال التوكن الأصلي في صفحة البوتات (سيُشفّر من جديد).',
    retryable: false,
  },

  // ===== التحقق المسبق (فشل دائم) =====
  rich_spec_invalid: {
    causeAr: 'مواصفة الرسالة الغنية (richDocument) غير صالحة.',
    fixAr: 'افتَح المنشور في محرّر الرسائل الغنية وأصلح البنية ثم أعد النشر.',
    retryable: false,
  },
  validation_failed: {
    causeAr: 'النص/الوسوم/عقد الرسالة تجاوز حدود تليجرام.',
    fixAr: 'عدّل المنشور وفق المطالب المعروضة، ثم أعد النشر أو الجدولة.',
    retryable: false,
  },
  caption_too_long: {
    causeAr: 'التعليق مع الوسائط يتجاوز 1024 حرفاً.',
    fixAr: 'قصّر النص أو أزل الوسائط (النص الكامل فوق 4096 يرمى بلا وسائط).',
    retryable: false,
  },

  // ===== فشل النقل (من تليجرام) =====
  rate_limited: {
    causeAr: 'تليجرام طلب البطء (429) — تجاوز حد الإرسال.',
    fixAr: 'انتظر دقيقة كاملة ثم أعد النشر — الجدولة تعكف تلقائياً على الإعادة.',
    retryable: true,
  },
  transport_rejected: {
    causeAr: 'رفَضت واجهة تليجرام الإرسال لسبب مؤقت (شبكة/تجاوز سريع).',
    fixAr:
      'أبقِ الهدوء — آلية الإعادة (5 دقائق حتى 3 محاولات) مصمّمة لهذا. إن تكرر راجع سجل التسليم.',
    retryable: true,
  },
  chat_not_found: {
    causeAr: 'تليجرام لا يعرف الاتصال: المحادثة غير موجودة أو البوت مفقود منها.',
    fixAr: 'أضف البوت إلى القناة/المجموعة بصلاحيات النشر ثم تحقق من كلمة الاتصال لكي تعود الإقامة.',
    retryable: false,
  },
  parse_error: {
    causeAr: 'تعذر تحليل ترقيم HTML في الرسالة (زوال زر أو وسم غير متناظر).',
    fixAr: 'صحّح الوسوم في محرّر المنشور ثم أعد الإرسال (وضع HTML).',
    retryable: false,
  },

  // ===== التزامن والإدارة اليدوية =====
  in_progress: {
    causeAr: 'ناشر آخر ما يزال يرسل هذا الهدف (عقد المطالبة لم ينته).',
    fixAr:
      'لا تدخّل — عقد المطالبة (15 دقيقة) يستعيد الأعمال المكسورة تلقائياً، والمطالبة تمنع الإرسال المزدوج.',
    retryable: true,
  },
  unsupported_platform: {
    causeAr: 'المنصة غير مدعومة للنشر بعد (فيسبوك/يوتيوب قريباً).',
    fixAr: 'اختر المنصة تيليجرام من محرّر النشر حتى تُفعَّل المنصات الأخرى لاحقاً.',
    retryable: false,
  },
  legacy_job_failed: {
    causeAr: 'فشلت مهمة جدولة قديمة (telegram_post) أثناء التنفيذ.',
    fixAr: 'افتح صفحة الجدولة وأعد المجدولة لمهمة جديدة — المهام القديمة مسار تراثي.',
    retryable: false,
  },
} as const satisfies Record<string, PublishErrorDef>

export type PublishErrorCode = keyof typeof PUBLISH_ERROR_CATALOG

/** تعريف رمز بضمان النوع (fallback للرمز المجهول). */
export function publishErrorDef(
  code: string | null | undefined,
): PublishErrorDef & { code: string } {
  const def =
    (code && code in PUBLISH_ERROR_CATALOG
      ? PUBLISH_ERROR_CATALOG[code as PublishErrorCode]
      : null) ?? PUBLISH_ERROR_CATALOG.unknown
  return { code: code && code in PUBLISH_ERROR_CATALOG ? code : 'unknown', ...def }
}

/** كل رموز الكتالوج — لصفحة «مساعدة النشر» الآلية ولوحات الاختبار. */
export const PUBLISH_ERROR_CODES: readonly PublishErrorCode[] = Object.keys(
  PUBLISH_ERROR_CATALOG,
) as PublishErrorCode[]

/**
 * تصنيف خطأ نقل تليجرام الخام → رمز الكتالوج. يطابق أنماط رسائل
 * Bot API المعروفة (429/Chat not found/parse/CSS…).
 */
export function classifyTransportError(raw?: string | null): PublishErrorCode {
  if (!raw) return 'transport_rejected'
  const text = raw.toLowerCase()
  if (text.includes('429') || text.includes('too many requests')) return 'rate_limited'
  if (text.includes('chat not found')) return 'chat_not_found'
  if (text.includes('bot was blocked') || text.includes('not enough rights'))
    return 'chat_not_found'
  if (
    text.includes('can\u2019t parse') ||
    text.includes("can't parse") ||
    text.includes('message is not modified')
  )
    return 'parse_error'
  return 'transport_rejected'
}

/**
 * تحويل سبب المسار الوحيد (PublishResult.reason) → رمز كتالوج.
 * يُستخدم حيثما النتيجة القديمة كانت بلا رمز.
 */
export function reasonToCode(reason?: string): PublishErrorCode {
  switch (reason) {
    case 'unsupported_platform':
      return 'unsupported_platform'
    case 'misconfigured':
      return 'destination_not_qualified'
    case 'validation':
      return 'validation_failed'
    case 'transport':
      return 'transport_rejected'
    case 'in_progress':
      return 'in_progress'
    default:
      return 'unknown'
  }
}

/** أسباب التخطي (ليست أخطاء) — لعرض شرح في الواجهة عند skipped. */
export const SKIPPED_REASON_LABELS: Record<string, string> = {
  already_published: 'المنشور منشور مسبقاً (idempotency) — لا شيء يُعاد.',
  in_progress: 'ناشر آخر يرسله الآن — لن يرسله هذا المسار مرتين.',
}
