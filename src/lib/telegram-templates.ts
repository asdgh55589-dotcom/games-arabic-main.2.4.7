/**
 * lib/telegram-templates.ts — نظام قوالب منشورات Telegram
 *
 * يدعم متغيرات ديناميكية وقوالب افتراضية قابلة للتخصيص.
 */

export interface TemplateVariables {
  game_name: string
  game_name_en: string
  team_name: string
  platform: string
  version: string
  description: string
  story: string
  download_link: string
  hashtags: string
  publish_date: string
  mod_name: string
  file_size: string
  [key: string]: string
}

export interface TelegramTemplate {
  id: string
  name: string
  content: string
  isDefault: boolean
  createdAt: string
}

const PLATFORM_HASHTAGS: Record<string, string> = {
  NS: '#سويتش',
  PS4: '#بلاي_4',
  PS3: '#بلاي_3',
  PS2: '#بلاي_2',
  PS1: '#بلاي_1',
  X360: '#اكس_بوكس',
  PC: '#كمبيوتر',
}

const DEFAULT_TEMPLATE = `🎮 {game_name}
🏷️ {game_name_en}

📝 التعريب: {team_name}
🎯 المنصة: {platform}
📌 الإصدار: {version}

📖 القصة:
{story}

⬇️ رابط التحميل:
{download_link}

{hashtags}`

/**
 * توليد الهاشتاغات تلقائياً بناءً على بيانات التعريب
 */
export function generateHashtags(gameNameAr: string, platform: string, teamName: string): string {
  const platformTag = PLATFORM_HASHTAGS[platform] || `#${platform}`
  const gameTag = `#${gameNameAr.replace(/\s+/g, '_')}`
  const modTag = `#تعريب_${gameNameAr.replace(/\s+/g, '_')}`
  const teamTag = teamName ? `#${teamName.replace(/\s+/g, '_')}` : ''
  const generalTag = '#تعريبات_العاب'

  return [gameTag, modTag, platformTag, teamTag, generalTag].filter(Boolean).join(' ')
}

/**
 * تقليص القصة إلى 4 أسطر كحد أقصى
 */
export function truncateStory(story: string, maxLines = 4): string {
  if (!story) return 'لا توجد معلومات متاحة'
  const lines = story.split('\n').filter((l) => l.trim())
  if (lines.length <= maxLines) return story
  return lines.slice(0, maxLines).join('\n') + '\n...'
}

/**
 * استبدال المتغيرات في القالب
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '')
  }
  // Clean up empty lines
  result = result.replace(/\n{3,}/g, '\n\n')
  return result.trim()
}

/**
 * القالب الافتراضي
 */
export function getDefaultTemplate(): string {
  return DEFAULT_TEMPLATE
}

/**
 * التحقق من طول المنشور (حد Telegram: 4096)
 */
export function validatePostLength(content: string): {
  valid: boolean
  length: number
  remaining: number
  warning: boolean
} {
  const length = content.length
  const limit = 4096
  return {
    valid: length <= limit,
    length,
    remaining: limit - length,
    warning: length > 4000,
  }
}

/**
 * تنسيق منشور Telegram مع البيانات
 */
export function formatPost(
  mod: {
    name: string
    arabicTitle?: string
    version: string
    description?: string
    summary?: string
    fileSize?: string
    game: { name: string; platform: string }
    teamRelation?: { name: string } | null
    files?: { downloadUrl: string }[]
  },
  template?: string,
  overrides?: Partial<TemplateVariables>,
): { content: string; variables: TemplateVariables } {
  const story = truncateStory(mod.summary || mod.description || '')

  const variables: TemplateVariables = {
    game_name: mod.game.name,
    game_name_en: mod.name,
    team_name: mod.teamRelation?.name || 'فريق غير معروف',
    platform: mod.game.platform,
    version: mod.version,
    description: mod.description || '',
    story,
    download_link: mod.files?.[0]?.downloadUrl || '',
    hashtags: generateHashtags(mod.game.name, mod.game.platform, mod.teamRelation?.name || ''),
    publish_date: new Date().toLocaleDateString('ar-SA'),
    mod_name: mod.arabicTitle || mod.name,
    file_size: mod.fileSize || '',
    ...overrides,
  }

  const content = renderTemplate(template || DEFAULT_TEMPLATE, variables)

  return { content, variables }
}

// =====================================================================
// PART 2 — Account notification templates (Telegram-first auth policy).
// Pure builders for bot DMs (welcome, reset, alerts). All interpolations
// are HTML-escaped; see lib/telegram-notifications.ts for the sender.
// =====================================================================

import { escapeTelegramHtml as esc, urlButton } from './telegram-notifications'

export interface BuiltTelegramMessage {
  text: string
  replyMarkup?: object
}

/** Partially mask an email for display: ab***@domain. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const head = (local || '').slice(0, 2)
  return `${head}***@${domain}`
}

/** Mask an IP for display: 1.2.***.***. */
export function maskIp(ip: string | null): string {
  if (!ip) return 'غير معروف'
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`
  return '***'
}

function fmtTime(d: Date = new Date()): string {
  try {
    return d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return d.toISOString()
  }
}

export function welcomeMessage(displayName: string): BuiltTelegramMessage {
  return {
    text: [
      '🎉 <b>أهلاً بك في GAMES ARABIC!</b>',
      '',
      `مرحباً ${esc(displayName)}، تم إنشاء حسابك عبر تليجرام بنجاح.`,
      '',
      '🔔 ستصلك كل إشعارات حسابك هنا — تنبيهات الأمان، روابط الاستعادة، وتحديثات مهمة.',
      '',
      '💡 نصيحة: أضف بريداً إلكترونياً من الإعدادات كطريقة استرجاع احتياطية.',
    ].join('\n'),
  }
}

export function passwordSetupPrompt(displayName: string, setupUrl: string): BuiltTelegramMessage {
  return {
    text: [
      '🔐 <b>أمّن حسابك</b>',
      '',
      `مرحباً ${esc(displayName)}، حسابك يعمل حالياً بتليجرام فقط.`,
      '',
      'ننصح بتعيين كلمة مرور (اختياري) لتتمكن من الدخول أيضاً باسم المستخدم وكلمة المرور.',
    ].join('\n'),
    replyMarkup: urlButton('تعيين كلمة المرور', setupUrl),
  }
}

export function passwordResetMessage(displayName: string, resetUrl: string): BuiltTelegramMessage {
  return {
    text: [
      '🔑 <b>إعادة تعيين كلمة المرور</b>',
      '',
      `مرحباً ${esc(displayName)}، طلبت إعادة تعيين كلمة مرورك.`,
      '',
      '⏳ الرابط صالح لمدة <b>ساعة واحدة</b> ولاستخدام واحد فقط.',
      'إذا لم تطلب ذلك، تجاهل هذه الرسالة.',
    ].join('\n'),
    replyMarkup: urlButton('إعادة تعيين كلمة المرور', resetUrl),
  }
}

export function passwordChangedMessage(vars: {
  displayName: string
  at?: Date
  ip?: string | null
}): BuiltTelegramMessage {
  return {
    text: [
      '✅ <b>تم تغيير كلمة المرور</b>',
      '',
      `مرحباً ${esc(vars.displayName)}، تم تغيير كلمة مرور حسابك بتاريخ ${fmtTime(vars.at)} من ${maskIp(vars.ip ?? null)}.`,
      '',
      '⚠️ إذا لم تقم بهذا التغيير، أمّن حسابك فوراً من الإعدادات وتواصل مع الدعم.',
    ].join('\n'),
  }
}

export function newLoginAlert(vars: {
  displayName: string
  device: string
  ip?: string | null
  at?: Date
  secureUrl: string
}): BuiltTelegramMessage {
  return {
    text: [
      '🔐 <b>تنبيه أمني — دخول جديد</b>',
      '',
      `مرحباً ${esc(vars.displayName)}،`,
      '',
      'تم تسجيل الدخول إلى حسابك من جهاز جديد:',
      `📱 الجهاز: ${esc(vars.device)}`,
      `📍 العنوان: ${maskIp(vars.ip ?? null)}`,
      `🕐 الوقت: ${fmtTime(vars.at)}`,
      '',
      'إذا لم تكن أنت، اضغط الزر أدناه لتأمين حسابك.',
    ].join('\n'),
    replyMarkup: urlButton('تأمين الحساب', vars.secureUrl),
  }
}

export function mfaChangeMessage(vars: {
  displayName: string
  action: 'enabled' | 'disabled'
  at?: Date
}): BuiltTelegramMessage {
  const on = vars.action === 'enabled'
  return {
    text: [
      `${on ? '🛡️' : '⚠️'} <b>${on ? 'تم تفعيل المصادقة الثنائية' : 'تم تعطيل المصادقة الثنائية'}</b>`,
      '',
      `مرحباً ${esc(vars.displayName)}، ${on ? 'أصبح حسابك محمياً بطبقة إضافية.' : 'أصبح حسابك بدون الحماية الإضافية.'}`,
      `🕐 الوقت: ${fmtTime(vars.at)}`,
      '',
      on
        ? 'احفظ رموز الاسترداد في مكان آمن.'
        : '⚠️ إذا لم تقم بهذا التغيير، أعد التفعيل فوراً وتواصل مع الدعم.',
    ].join('\n'),
  }
}

export function emailChangeMessage(vars: {
  displayName: string
  newEmail: string
  at?: Date
}): BuiltTelegramMessage {
  return {
    text: [
      '📧 <b>تم تغيير البريد الإلكتروني</b>',
      '',
      `مرحباً ${esc(vars.displayName)}، تم ربط البريد ${maskEmail(vars.newEmail)} بحسابك كطريقة استرجاع احتياطية.`,
      `🕐 الوقت: ${fmtTime(vars.at)}`,
      '',
      '⚠️ إذا لم تقم بهذا التغيير، تواصل مع الدعم فوراً.',
    ].join('\n'),
  }
}

export function recoveryInitiatedMessage(displayName: string): BuiltTelegramMessage {
  return {
    text: [
      '🆘 <b>طلب استرجاع الحساب</b>',
      '',
      `مرحباً ${esc(displayName)}، تم بدء إجراء استرجاع لحسابك.`,
      '',
      'إذا كنت أنت من طلب ذلك، أكمل الخطوات المرسلة إليك. وإلا فتجاهل الرسالة وراجع إعدادات الأمان.',
    ].join('\n'),
  }
}

export function suspiciousActivityMessage(vars: {
  displayName: string
  detail: string
  secureUrl: string
}): BuiltTelegramMessage {
  return {
    text: [
      '🚨 <b>نشاط مشبوه</b>',
      '',
      `مرحباً ${esc(vars.displayName)}، رصدنا نشاطاً غير معتاد: ${esc(vars.detail)}`,
      '',
      'ننصح بتأمين حسابك فوراً: غيّر كلمة المرور وراجع الجلسات النشطة.',
    ].join('\n'),
    replyMarkup: urlButton('تأمين الحساب', vars.secureUrl),
  }
}
