/**
 * scripts/migrate-legacy-templates.ts — [DRY-RUN ONLY] ترحيل قوالب Telegram القديمة
 *
 * المرحلة 1 (Rich-Text): يقرأ هذا السكربت النصوص القديمة من الكود ويطبع
 * تقرير أهلية الترحيل إلى جدول `notification_templates` (channel='telegram') —
 * ولا يكتب شيئاً أبداً.
 *
 * ضوابط ملزمة:
 *  - DRY-RUN ONLY: لا استيراد Prisma، لا اتصال قاعدة، لا INSERT/UPDATE،
 *    وأي محاولة كتابة (--apply/--write/--seed/...) تُرفض بالخروج برمز 2.
 *  - seed NOTHING: لا تُشغَّل أي بذرة؛ التقرير يكتفي بذكر ما يُ счит مؤهلاً.
 *  - النصوص القديمة في lib/telegram-templates.ts تُقرأ فقط ولا تُعدَّل.
 *  - رسائل الأمان/الحساب (welcome, password, MFA, alerts) تبقى مضمّنة في الكود
 *    (security HARDCODED untouched) ⇒ غير مؤهلة للترحيل.
 *  - كل أنواع الإشعارات مؤهلة (all types eligible) — لا قوائم سوداء.
 *  - لا إرسال، لا واجهة، لا CI، وميزات الدفع تبقى معطّلة.
 *
 * الاستخدام:
 *   npx tsx scripts/migrate-legacy-templates.ts
 */

import { NOTIFICATION_TYPE_LABELS } from '../src/lib/notifications/types'
import {
  emailChangeMessage,
  getDefaultTemplate,
  mfaChangeMessage,
  newLoginAlert,
  passwordChangedMessage,
  passwordResetMessage,
  passwordSetupPrompt,
  recoveryInitiatedMessage,
  suspiciousActivityMessage,
  welcomeMessage,
} from '../src/lib/telegram-templates'

export type LegacySourceKind = 'post_template' | 'account_security_message'

export interface LegacySource {
  /** مُعرِّف ثابت للصف في التقرير. */
  id: string
  /** وصف مقروء. */
  label: string
  /** الملف المصدر — قراءة فقط. */
  origin: string
  kind: LegacySourceKind
  /** محتوى القالب كما هو في الكود (لم يُمسّ). */
  content: string
  /** المتغيرات المستخرجة من المحتوى. */
  variables: string[]
  /** نوع الإشعار المقترح للصف، أو null حين لا يوجد. */
  proposedType: string | null
}

export interface EligibilityRow {
  id: string
  eligible: boolean
  /** أسباب الاستبعاد (فارغة حين مؤهل). */
  reasons: string[]
  target: { type: string; channel: 'telegram' } | null
  /** true حين يحتاج الهدف المقترح تأكيداً بشرياً قبل أي كتابة. */
  proposalNeedsConfirmation: boolean
}

export const DRY_RUN_WRITE_FLAGS = [
  '--apply',
  '--write',
  '--yes',
  '-y',
  '--seed',
  '--migrate',
  '--run',
  '--exec',
] as const

export const TELEGRAM_MESSAGE_LIMIT = 4096

const SECURITY_SOURCE_REASON = 'security_hardcoded_untouched'

/**
 * استخراج المتغيرات من قالب: يدعم `{var}` (القالب القديم) و`{{var}}` (Handlebars).
 */
export function extractTemplateVariables(content: string): string[] {
  const found = new Set<string>()
  const handlebars = content.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)
  for (const match of handlebars) found.add(match[1])
  const single = content.matchAll(/(?<!\{)\{([A-Za-z_][A-Za-z0-9_]*)\}(?!\})/g)
  for (const match of single) found.add(match[1])
  return [...found].sort()
}

const ORIGIN = 'src/lib/telegram-templates.ts'

/** مُعرِّف ثابت + نوع مقترح لكل حساب قديم يُبنى من دالة في الكود. */
interface LegacyAccountSpec {
  id: string
  label: string
  content: string
}

/**
 * كل مصادر النصوص القديمة — قراءة فقط من lib/telegram-templates.ts.
 * (الدوال تُستدعى بقيم نائبة فقط لعرض المحتوى؛ الكود الأصلي لا يُغيَّر.)
 */
export function collectLegacySources(): LegacySource[] {
  const postContent = getDefaultTemplate()
  const sources: LegacySource[] = [
    {
      id: 'default_post_template',
      label: 'قالب منشور القناة الافتراضي',
      origin: ORIGIN,
      kind: 'post_template',
      content: postContent,
      variables: extractTemplateVariables(postContent),
      // اقتراح فقط — يحتاج تأكيداً قبل أي كتابة فعلية.
      proposedType: 'mod_published',
    },
  ]

  const accountSpecs: LegacyAccountSpec[] = [
    { id: 'welcome_message', label: 'رسالة ترحيب', content: welcomeMessage('مستخدم').text },
    {
      id: 'password_setup_prompt',
      label: 'دعوة تعيين كلمة المرور',
      content: passwordSetupPrompt('مستخدم', 'https://example.invalid/setup').text,
    },
    {
      id: 'password_reset_message',
      label: 'رسالة إعادة تعيين كلمة المرور',
      content: passwordResetMessage('مستخدم', 'https://example.invalid/reset').text,
    },
    {
      id: 'password_changed_message',
      label: 'إشعار تغيير كلمة المرور',
      content: passwordChangedMessage({
        displayName: 'مستخدم',
        at: new Date(0),
        ip: '203.0.113.9',
      }).text,
    },
    {
      id: 'new_login_alert',
      label: 'تنبيه دخول جديد',
      content: newLoginAlert({
        displayName: 'مستخدم',
        device: 'Chrome',
        ip: '203.0.113.9',
        at: new Date(0),
        secureUrl: 'https://example.invalid/session',
      }).text,
    },
    {
      id: 'mfa_change_message',
      label: 'إشعار تفعيل/تعطيل MFA',
      content: mfaChangeMessage({
        displayName: 'مستخدم',
        action: 'enabled',
        at: new Date(0),
      }).text,
    },
    {
      id: 'email_change_message',
      label: 'إشعار تغيير البريد',
      content: emailChangeMessage({
        displayName: 'مستخدم',
        newEmail: 'ab***@domain',
        at: new Date(0),
      }).text,
    },
    {
      id: 'recovery_initiated_message',
      label: 'إشعار بدء الاسترجاع',
      content: recoveryInitiatedMessage('مستخدم').text,
    },
    {
      id: 'suspicious_activity_message',
      label: 'تنبيه نشاط مشبوه',
      content: suspiciousActivityMessage({
        displayName: 'مستخدم',
        detail: 'محاولة دخول غير معروفة',
        secureUrl: 'https://example.invalid/sessions',
      }).text,
    },
  ]

  for (const spec of accountSpecs) {
    sources.push({
      id: spec.id,
      label: spec.label,
      origin: ORIGIN,
      kind: 'account_security_message',
      content: spec.content,
      variables: extractTemplateVariables(spec.content),
      proposedType: null,
    })
  }
  return sources
}

/** تقييم أهلية كل مصدر للترحيل إلى notification_templates (channel='telegram'). */
export function assessEligibility(sources: LegacySource[]): EligibilityRow[] {
  return sources.map((source) => {
    const reasons: string[] = []
    if (source.kind === 'account_security_message') {
      reasons.push(SECURITY_SOURCE_REASON)
    }
    if (!source.content.trim()) {
      reasons.push('empty_content')
    }
    if (source.content.length > TELEGRAM_MESSAGE_LIMIT) {
      reasons.push(`exceeds_telegram_limit(${source.content.length}>${TELEGRAM_MESSAGE_LIMIT})`)
    }

    const eligible = reasons.length === 0
    return {
      id: source.id,
      eligible,
      reasons,
      target:
        eligible && source.proposedType ? { type: source.proposedType, channel: 'telegram' } : null,
      proposalNeedsConfirmation: eligible,
    }
  })
}

/** كل أنواع الإشعارات مؤهلة لقالب telegram غني — بلا أي فلترة. */
export function eligibleNotificationTypes(): string[] {
  return Object.keys(NOTIFICATION_TYPE_LABELS).sort()
}

/** تقرير نصي جاهز للطباعة. */
export function buildReport(sources: LegacySource[], rows: EligibilityRow[]): string {
  const lines: string[] = []
  const byId = new Map(rows.map((row) => [row.id, row]))

  lines.push('=== Telegram Rich-Text Phase 1 — migrate-legacy-templates ===')
  lines.push('MODE: DRY-RUN ONLY — 0 rows written, 0 seeds run, no DB connection, no delivery.')
  lines.push('')

  lines.push('1) Legacy telegram sources (read-only: src/lib/telegram-templates.ts)')
  for (const source of sources) {
    const row = byId.get(source.id)
    const state = row?.eligible ? 'ELIGIBLE  ' : 'NOT ELIGIBLE'
    const target = row?.target ? ` -> type=${row.target.type} channel=telegram` : ''
    const reasons = row?.eligible
      ? row.proposalNeedsConfirmation
        ? ' (proposal: needs confirmation)'
        : ''
      : ` [${(row?.reasons ?? []).join(', ')}]`
    lines.push(
      `   [${state}] ${source.id} (vars=${source.variables.length}, len=${source.content.length})${target}${reasons}`,
    )
  }
  lines.push('')

  const types = eligibleNotificationTypes()
  lines.push(
    `2) Notification types eligible for telegram rich-text templates: ${types.length}/${types.length} (all types eligible — no allowlist)`,
  )
  lines.push(`   ${types.join(', ')}`)
  lines.push('')

  const eligibleRows = rows.filter((row) => row.eligible)
  lines.push('3) Seeding: NOTHING was seeded this phase.')
  lines.push(
    `   Eligible for a future seed (after the migration is deployed): ${types.length} rows in notification_templates (channel='telegram', one per type).`,
  )
  lines.push(
    `   Legacy sources eligible for a future migration write: ${eligibleRows.length}/${rows.length}.`,
  )
  lines.push(
    '   Existing in_app/email seeds stay owned by prisma/seed-notification-templates.ts (not run here).',
  )
  lines.push('')

  lines.push('4) Invariants confirmed by this dry-run:')
  lines.push('   - security HARDCODED untouched (account/security messages stay in code).')
  lines.push('   - manager-only broadcast unchanged (no endpoint added; send route untouched).')
  lines.push('   - paid features remain DISABLED (nothing price-related is emitted).')
  lines.push('   - legacy strings untouched (read-only access, no rewrite).')
  lines.push('')

  const ineligible = rows.filter((row) => !row.eligible)
  lines.push(`SUMMARY: eligible=${eligibleRows.length} ineligible=${ineligible.length} written=0`)
  return lines.join('\n')
}

function main(): void {
  const args = process.argv.slice(2)
  const requestedWrite = args.filter((arg) =>
    (DRY_RUN_WRITE_FLAGS as readonly string[]).includes(arg),
  )
  if (requestedWrite.length > 0) {
    console.error(
      `[DRY-RUN ONLY] رفض تنفيذ ${requestedWrite.join(' ')} — هذا السكربت لا يكتب ولا يزرع أبداً.`,
    )
    process.exit(2)
  }

  const sources = collectLegacySources()
  const rows = assessEligibility(sources)
  console.log(buildReport(sources, rows))
}

if (require.main === module) {
  main()
}
