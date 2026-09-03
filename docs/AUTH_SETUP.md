# إعداد المصادقة — Google OAuth + Better Auth

هذا الدليل يوضح خطوات إعداد دخول Google عبر Better Auth في بيئة `games-arabic`.

---

## 1) Google Cloud Console

1. افتح https://console.cloud.google.com/
2. أنشئ مشروع جديد أو اختر مشروع `games-arabic`
3. من القائمة الجانبية: **APIs & Services → Credentials**
4. اضغط **Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Games Arabic - Web`
5. أضف **Authorized JavaScript origins**:
   - `http://localhost:3000` (للتطوير)
   - `https://games-arabic.com` (الإنتاج — غيّر حسب الدومين الفعلي)
   - `https://www.games-arabic.com` (إن وجد)
6. أضف **Authorized redirect URIs** (مهم جداً):
   ```
   http://localhost:3000/api/auth/callback/google
   https://games-arabic.com/api/auth/callback/google
   https://www.games-arabic.com/api/auth/callback/google
   ```
   > Better Auth يستخدم مسار `/api/auth/callback/<provider>` افتراضياً.
   > في الكود لدينا `baseURL` يأتي من `BETTER_AUTH_URL` أو `NEXT_PUBLIC_SITE_URL`، لذا نفس الدومين يجب أن يكون مسجلاً في Google.

7. احفظ → ستحصل على `Client ID` و `Client Secret` (انسخهما).

> ملاحظة: بعد إضافة Redirect URI، قد تحتاج 5 دقائق حتى ينتشر التغيير في خوادم Google.

---

## 2) متغيرات البيئة المطلوبة

أضفها إلى `.env.local` (لا ترفعها إلى git):

```env
# Better Auth
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<openssl rand -hex 32>
# أو استخدم JWT_SECRET الموجود مسبقاً كـ fallback

# Google OAuth
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YYYY-YYYYYYYYYYYYYYYYYYYYYYYYYYYY

# البريد (اختياري لكن مهم لتأكيد الإيميل)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
EMAIL_FROM="Games Arabic <noreply@games-arabic.com>"
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# تليجرام (موجود مسبقاً ✅)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=GAMES_ARABIC_BOT
TELEGRAM_WEBHOOK_SECRET=...
```

**توليد secret قوي:**
```bash
openssl rand -hex 32
# أو
openssl rand -base64 32
```

**التحقق محلياً:**
```bash
grep -n "process.env.GOOGLE" src/lib/better-auth.ts
# يجب أن يطبع GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET
```

---

## 3) سير الدخول عبر Google (Better Auth)

```
[زر جوجل في /login] → authClient.signIn.social({ provider: 'google', callbackURL: '/' })
  → 302 إلى https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=https://games-arabic.com/api/auth/callback/google
  → المستخدم يوافق → Google يعيد Code إلى /api/auth/callback/google
  → Better Auth يبدّل Code → Access Token → يجلب profile → ينشئ/يحدّث User في جدول User + Account
  → ينشئ Session في جدول session + يضع cookie: better-auth.session_token (httpOnly, 7 أيام)
  → يعيد توجيه إلى callbackURL ("/")
```

- إنشاء أول مرة: `email`, `name→displayName`, `image→avatarUrl`, `emailVerified=true` (لأن Google موثّق)
- تسجيل تالي: يربط نفس `Account` (`providerId=google`, `accountId=google_sub`)

---

## 4) الاختبار محلياً

```bash
bun run dev # أو npm run dev
# افتح http://localhost:3000/login
```

- زر **تليجرام** في الأعلى (أكبر، أزرق) ✅
- زر **جوجل** ثانياً
- جرّب الضغط على جوجل → يجب أن تُحول إلى Google → اختر حساب → تعود إلى `/` وترى ملفك الشخصي
- لو فشل: افحص Network → `/api/auth/callback/google` → Console → `[Better Auth] Social provider google is missing clientId` يعني المتغيرات غير محملة — أعد تشغيل `dev`
- تأكد أن `BETTER_AUTH_URL` يساوي `http://localhost:3000` محلياً (وليس الإنتاج)

---

## 5) الإنتاج

1. غيّر `BETTER_AUTH_URL` إلى `https://games-arabic.com`
2. غيّر `NEXT_PUBLIC_SITE_URL` إلى نفس الدومين
3. أضف redirect URI للإنتاج في Google Console (كما أعلاه)
4. أعد نشر: `npx prisma migrate deploy && bun run build`
5. اختبر تسجيل جديد من متصفح نظيف (Incognito)

---

## 6) استكشاف الأخطاء

| المشكلة | السبب | الحل |
|---|---|---|
| `redirect_uri_mismatch` | الـ redirect URI في الطلب غير مسجل | أضفه حرفياً في Google Console (مع https) |
| `Social provider google is missing clientId` | ENV غير محمل | تأكد من `.env.local` وأعد `dev` |
| بعد الدخول تبقى في `/login` | `getSession` لا يقرأ Better Auth cookie | تأكد أن `better-auth.session_token` موجود في DevTools → Application → Cookies |
| `emailVerified` بقي false | المستخدم سجّل بـ email/password وليس Google | هذا طبيعي — يجب تأكيد الإيميل عبر `/verify-email` |
| `blocked by CORS` | `trustedOrigins` لا يحتوي الدومين | عدّل `trustedOrigins` في `src/lib/better-auth.ts` |

---

## 7) ملاحظات أمنية

- لا تشارك `GOOGLE_CLIENT_SECRET` أبداً في الواجهة الأمامية (هو `server-only` عبر `process.env` في `src/lib/better-auth.ts`)
- فعّل **Google Identity Services** فقط للدومينات التي تملكها
- للبريد: استخدم `RESEND_API_KEY` مع دومين موثّق في Resend (SPF/DKIM)
