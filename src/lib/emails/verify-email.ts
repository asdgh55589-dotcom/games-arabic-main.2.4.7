/**
 * قالب إيميل تأكيد البريد — عربي، RTL، تصميم بسيط
 */
export function getVerifyEmailHtml(opts: {
  displayName: string
  url: string
  siteName?: string
}): string {
  const site = opts.siteName || 'Games Arabic'
  const name = opts.displayName || 'مستخدم'
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;direction:rtl;background:#0a0a0a;margin:0;padding:24px;color:#e5e5e5}
  .container{max-width:560px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden}
  .header{background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;padding:24px;text-align:center}
  .header h1{margin:0;font-size:22px;font-weight:900;letter-spacing:0}
  .content{padding:24px;line-height:1.8;color:#d4d4d8}
  .btn{display:inline-block;padding:12px 28px;background:#ff8c00;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;margin-top:16px}
  .btn:hover{background:#e67e00}
  .muted{font-size:12px;color:#a1a1aa;margin-top:16px;word-break:break-all}
  .footer{padding:16px 24px;background:#0f0f0f;text-align:center;font-size:11px;color:#71717a;border-top:1px solid #27272a}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${site}</h1><p style="margin:8px 0 0;opacity:0.9">تأكيد بريدك الإلكتروني</p></div>
    <div class="content">
      <p>أهلاً ${name}،</p>
      <p>فعّل حسابك في <strong>${site}</strong> بالضغط على الزر أدناه — الرابط صالح <strong>24 ساعة</strong> فقط.</p>
      <p style="text-align:center"><a href="${opts.url}" class="btn">تفعيل الحساب</a></p>
      <p class="muted">إذا لم يشتغل الزر، انسخ الرابط التالي للمتصفح:<br><a href="${opts.url}" style="color:#ff8c00">${opts.url}</a></p>
      <p class="muted">لم تطلب هذا؟ تجاهل الرسالة — حسابك سيبقى آمناً.</p>
    </div>
    <div class="footer">منصة تعريب الألعاب — رسالة تلقائية، لا ترد عليها</div>
  </div>
</body>
</html>
`.trim()
}

export function getVerifyEmailText(opts: {
  displayName: string
  url: string
  siteName?: string
}): string {
  return `أهلاً ${opts.displayName}،\nفعّل حسابك في ${opts.siteName || 'Games Arabic'} عبر الرابط (صالح 24 ساعة):\n${opts.url}\n`
}
