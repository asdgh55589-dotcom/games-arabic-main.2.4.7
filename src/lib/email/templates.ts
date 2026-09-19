/**
 * lib/email/templates.ts — centralized email markup helpers (SA-2).
 *
 * SCOPE (honest):
 * - `buildApprovalEmail` / `buildResetEmail` are PURE functions centralizing
 *   the inline Arabic/RTL markup that previously lived inside the sender
 *   files. Subject + HTML are extracted VERBATIM from:
 *     - src/lib/notifications/email-service.ts:177-215 (+ REPORT_EMAIL_TEMPLATE
 *       shell, lines 219-240) for the creator-approval mail,
 *     - src/lib/recovery-email.ts:34-40 for the password-reset mail.
 *   No behavior change: SA-1's try/catch-require + inline fallback renders
 *   byte-identical copy when calling these helpers.
 * - `text` is a NEW additive plain-text rendering of the same copy (the
 *   senders previously sent html-only). It exists only to satisfy the
 *   { subject, html, text } contract SA-1 codes against.
 * - `renderEmailTemplate` (DB-row path: look up NotificationTemplate
 *   channel='email' and render via Handlebars) is DEFERRED and returns null
 *   by design: SA-1 calls it synchronously inside try/catch-require, and a
 *   Prisma lookup cannot stay sync-safe. Returning null keeps SA-1's inline
 *   fallback path behaving identically until an async renderer lands.
 *   Signature kept EXACT per spec so SA-1 compiles unchanged.
 */

export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

// ===== REPORT_EMAIL_TEMPLATE shell — VERBATIM from email-service.ts:219-240 =====

const REPORT_EMAIL_TEMPLATE = (title: string, body: string) => `  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; direction: rtl; background: #f5f5f5; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; line-height: 1.6; color: #333; }
      .footer { padding: 15px 20px; background: #f9fafb; text-align: center; font-size: 12px; color: #666; }
      .btn { display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>${title}</h1></div>
      <div class="content">${body}</div>
      <div class="footer">منصة تعريب الألعاب — هذا إشعار تلقائي</div>
    </div>
  </body>
  </html>
`

// ===== Creator approval — VERBATIM copy from email-service.ts:177-215 =====

export function buildApprovalEmail(vars: {
  username: string
  track: 'publisher' | 'translator'
  approveNote?: string
  appUrl?: string
}): BuiltEmail {
  const isPublisher = vars.track === 'publisher'
  const trackName = isPublisher ? 'ناشر' : 'معرّب'
  const nextSteps = isPublisher
    ? 'يمكنك الآن نشر المحتوى والأخبار من لوحة منشئ المحتوى.'
    : 'يمكنك الآن رفع تعريباتك ومشاركتها مع المجتمع من لوحة منشئ المحتوى.'
  const noteHtml = vars.approveNote
    ? `<p><strong>ملاحظة من المراجعة:</strong> ${vars.approveNote}</p>`
    : ''
  const appUrl =
    vars.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const subject = `مبروك! انضممت لبرنامج منشئ المحتوى ك${trackName}`
  const html = REPORT_EMAIL_TEMPLATE(
    `مبروك! انضممت لبرنامج منشئ المحتوى ك${trackName}`,
    `<p>مرحباً ${vars.username}،</p>
     <p>تم قبول طلب انضمامك إلى برنامج منشئ المحتوى بمسار <strong>${trackName}</strong>.</p>
     <p>${nextSteps}</p>
     ${noteHtml}
     <p><a class="btn" href="${appUrl}/creator">افتح لوحة منشئ المحتوى</a></p>`,
  )
  const text = [
    subject,
    `مرحباً ${vars.username}،`,
    `تم قبول طلب انضمامك إلى برنامج منشئ المحتوى بمسار ${trackName}.`,
    nextSteps,
    ...(vars.approveNote ? [`ملاحظة من المراجعة: ${vars.approveNote}`] : []),
    `افتح لوحة منشئ المحتوى: ${appUrl}/creator`,
  ].join('\n')

  return { subject, html, text }
}

// ===== Password reset — VERBATIM copy from recovery-email.ts:34-40 =====

export function buildResetEmail(resetLink: string): BuiltEmail {
  const subject = 'استعادة كلمة المرور — GAMES ARABIC'
  const html = `
        <div dir="rtl" lang="ar" style="font-family: Arial, sans-serif;">
          <h2>استعادة كلمة المرور</h2>
          <p>طلبت إعادة تعيين كلمة مرورك. الرابط صالح لمدة ساعة واحدة ولاستخدام واحد فقط.</p>
          <p><a href="${resetLink}">اضغط هنا لتعيين كلمة مرور جديدة</a></p>
          <p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
        </div>`
  const text = [
    'استعادة كلمة المرور',
    'طلبت إعادة تعيين كلمة مرورك. الرابط صالح لمدة ساعة واحدة ولاستخدام واحد فقط.',
    `اضغط هنا لتعيين كلمة مرور جديدة: ${resetLink}`,
    'إذا لم تطلب ذلك، تجاهل هذه الرسالة.',
  ].join('\n')

  return { subject, html, text }
}

/**
 * DB-row template path — DEFERRED, always returns null (see header).
 * SA-1 calls this synchronously inside try/catch-require; null selects its
 * inline fallback, preserving current behavior exactly.
 */
export function renderEmailTemplate(
  _type: string,
  _locale: string,
  _vars: Record<string, string>,
): { subject: string; html: string; text: string } | null {
  return null
}

// ===== Email verification — VERBATIM copy from verification-email.ts =====
// (subject + html previously inline in sendVerificationEmail's fallback;
//  text is the additive plain-text rendering of the same copy.)

export function buildVerificationEmail(verifyLink: string): BuiltEmail {
  const subject = 'تأكيد بريدك الإلكتروني — GAMES ARABIC'
  const html = `
        <div dir="rtl" lang="ar" style="font-family: Arial, sans-serif;">
          <h2>تأكيد بريدك الإلكتروني</h2>
          <p>أضفت هذا البريد إلى حسابك. الرابط صالح لمدة ٢٤ ساعة ولاستخدام واحد فقط.</p>
          <p><a href="${verifyLink}">اضغط هنا لتأكيد بريدك الإلكتروني</a></p>
          <p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
        </div>`
  const text = [
    'تأكيد بريدك الإلكتروني',
    'أضفت هذا البريد إلى حسابك. الرابط صالح لمدة ٢٤ ساعة ولاستخدام واحد فقط.',
    `اضغط هنا لتأكيد بريدك الإلكتروني: ${verifyLink}`,
    'إذا لم تطلب ذلك، تجاهل هذه الرسالة.',
  ].join('\n')

  return { subject, html, text }
}

// ===== Team invite — VERBATIM copy from invites/route.ts =====

export function buildInviteEmail(vars: {
  inviterUsername: string
  teamName: string
  acceptUrl: string
}): BuiltEmail {
  const subject = `دعوة للانضمام إلى فريق "${vars.teamName}"`
  const html = `<p>مرحباً،</p><p>دعاك ${vars.inviterUsername} للانضمام إلى فريق "${vars.teamName}".</p><p><a href="${vars.acceptUrl}">قبول الدعوة</a> (صالحة لمدة 7 أيام)</p>`
  const text = [
    subject,
    `دعاك ${vars.inviterUsername} للانضمام إلى فريق "${vars.teamName}".`,
    `قبول الدعوة: ${vars.acceptUrl} (صالحة لمدة 7 أيام)`,
  ].join('\n')

  return { subject, html, text }
}

// ===== Ownership transfer nomination — VERBATIM copy from transfer/nominate/route.ts =====

export function buildTransferEmail(vars: {
  nomineeUsername: string
  nominatorUsername: string
  teamName: string
  transferLink: string
}): BuiltEmail {
  const subject = `ترشيح لملكية فريق "${vars.teamName}"`
  const html = `<p>مرحباً ${vars.nomineeUsername}،</p><p>رشحك ${vars.nominatorUsername} لتصبح مالك فريق "${vars.teamName}".</p><p><a href="${vars.transferLink}">مراجعة الترشيح</a> (صالح لمدة 7 أيام)</p>`
  const text = [
    subject,
    `مرحباً ${vars.nomineeUsername}،`,
    `رشحك ${vars.nominatorUsername} لتصبح مالك فريق "${vars.teamName}".`,
    `مراجعة الترشيح: ${vars.transferLink} (صالح لمدة 7 أيام)`,
  ].join('\n')

  return { subject, html, text }
}

// ===== Password-changed notification (Telegram-first backup leg) =====

export function buildPasswordChangedEmail(vars: {
  username: string
  changedAt: string
  ip: string | null
}): BuiltEmail {
  const subject = 'تم تغيير كلمة المرور الخاصة بك — GAMES ARABIC'
  const html = `
        <div dir="rtl" lang="ar" style="font-family: Arial, sans-serif;">
          <h2>تم تغيير كلمة المرور</h2>
          <p>مرحباً ${vars.username}،</p>
          <p>تم تغيير كلمة المرور الخاصة بحسابك بتاريخ ${vars.changedAt}${vars.ip ? ` من العنوان ${vars.ip}` : ''}.</p>
          <p>إذا لم تقم بهذا التغيير، تواصل مع الدعم فوراً وسجّل الدخول لتأمين حسابك.</p>
        </div>`
  const text = [
    'تم تغيير كلمة المرور الخاصة بك',
    `مرحباً ${vars.username}،`,
    `تم تغيير كلمة المرور الخاصة بحسابك بتاريخ ${vars.changedAt}${vars.ip ? ` من العنوان ${vars.ip}` : ''}.`,
    'إذا لم تقم بهذا التغيير، تواصل مع الدعم فوراً وسجّل الدخول لتأمين حسابك.',
  ].join('\n')

  return { subject, html, text }
}
