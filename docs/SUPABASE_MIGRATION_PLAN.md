# خطة ترحيل Supabase → Better Auth (READ-ONLY — لم تُنفذ)

> هذه خطة فقط — لا يُنفذ أي كود ترحيل قبل موافقة المالك.
> الهدف: الانتقال الكامل إلى Better Auth مع الحفاظ على كل البيانات (mods, تعليقات, تقييمات, نقاط, إلخ) بدون فقدان.

---

## الوضع الحالي (قبل الترحيل)

- **مصادقة الطاقم** (4-credential: username+email+password+securityKey + TOTP) → مجمدة في `src/app/api/auth/login` + `src/lib/auth.ts` + `src/proxy.ts` (Edge JWT `ga_admin_role`)
- **مصادقة العامة**: Supabase Auth (Google/Discord/Telegram) عبر `src/lib/supabase/*` + جدول `User.supabaseId` + `OAuthAccount` (provider=google/discord/telegram)
- **Better Auth الجديد**: مثبت في Phase 1+2 (`src/lib/better-auth.ts`, جداول `session/account/verification` الجديدة، `/api/auth/[...all]`, `/login` الجديد, `/verify-email`, `/settings/sessions`, `/api/auth/telegram-bridge`)
- **التعايش**: `proxy.ts` يحدّث Supabase session وفي نفس الوقت يتحقق من `ga_admin_role` و `better-auth.session_token`. كلاهما fail-open.

---

## المرحلة A — فترة التعايش المزدوج (Dual-Login) — مدة: شهر واحد

**الهدف:** المستخدم القديم يظل يدخل بالطريقة القديمة، والجديد بـ Better Auth — بدون كسر.

### ما يبقى يعمل:
- `Supabase` يبقى مفعّل: `/api/auth/callback`, `/api/auth/me` (يقرأ Supabase أولاً ثم fallback لـ better-auth), وسيظل `createClient()` يقرأ كوكيز Supabase.
- `Better Auth` يبقى مفعّل: `/api/auth/[...all]` يخدم Google (عبر better-auth) + Email/Password + Telegram bridge.
- `/login` الجديد يعرض **تليجرام أولاً** (bridge + widget قديم)، ثم Google (عبر better-auth)، ثم Email/Password (عبر better-auth) — لا يُحذف widget القديم.

### تجربة المستخدم القديم (عنده supabaseId):
1. يدخل عبر زر **Google** (الآن يمر عبر better-auth). Better Auth ينشئ `User` جديد بنفس `email` → سيكون هناك `User` مكرر بنفس الإيميل؟
   - **الحل:** قبل إنشاء `User` جديد عبر better-auth، نضيف `databaseHooks.user.create.before` يفحص هل يوجد `User` بنفس `email` لديه `supabaseId` — إن وجد، نربط الـ `Account` الجديد به بدل إنشاء `User` جديد (account linking). هذا يمنع ازدواج الإيميل.
2. أو يستمر الدخول عبر زر **تليجرام widget القديم** (يمر عبر `/api/auth/telegram/callback` ثم يُحوّل تلقائياً عبر `/api/auth/telegram-bridge` إلى جلسة better-auth — المستخدم لا يلحظ فرقاً).
3. نعرض بانر لطيف للمستخدمين القدامى:
   > "🔄 نقلنا نظام الدخول لنظام أسرع وأأمن. حسابك كما هو — كل تعريباتك ونقاطك محفوظة. اضغط **تحديث دخولي** لربط إيميلك بالطريقة الجديدة (مرة واحدة فقط)."
   - الزر يرسل إيميل تأكيد عبر better-auth → بعد التأكيد، نحدّث `User.emailVerified=true` وننشئ `Account` من نوع `email/password`.

### ماذا نراقب (A):
- عدد المستخدمين الذين لديهم `session` في better-auth مقارنة بـ Supabase (يومياً عبر `SELECT count(*) FROM "session"` مقابل `auth.users` في Supabase).
- نسبة تسجيلات جديدة عبر better-auth (يجب أن تكون 100% للجدد بعد Phase 2).
- أخطاء `USER_BANNED` و `RATE_LIMITED` — نراقبها في `proxy.ts` و `telegram-bridge`.

**معيار الانتقال للمرحلة B:** عندما يصبح >60% من الدخول اليومي عبر better-auth أو بعد شهر أيهما أقرب.

---

## المرحلة B — سكربت الترحيل (Migration Script) — يُشغّل مرة واحدة يدوياً

**لا يُشغّل تلقائياً — يحتاج موافقة و backup.**

### ما قبل التشغيل (يدوي):
```bash
# 1) نسخ احتياطي كامل
pg_dump "postgresql://..." > backup_before_migration_$(date +%F).sql
# 2) وضع الموقع في maintenance أو read-only لـ 30 دقيقة
# 3) تعطيل التسجيل الجديد مؤقتاً (feature flag)
```

### السكربت: `scripts/migrate-supabase-to-better-auth.ts` (يُكتب في Phase 3)

```
لكل user في DB حيث supabaseId IS NOT NULL ولا يوجد له Account من نوع "email" أو "google" في better-auth:

  1. اقرأ من Supabase Auth عبر service_role: GET /auth/v1/admin/users/{supabaseId}
     → احصل على email, email_confirmed_at, providers[], last_sign_in_at

  2. في Neon DB:
     - تأكد أن User موجود (هو موجود أصلاً)
     - username, displayName, email, avatarUrl, bio, role, banStatus, tier, ... تُحفظ كما هي — لا تتغير
     - mods, comments, ratings, teamMemberships, notifications, ... كلها مرتبطة بـ User.id فلا داعي لنقلها

  3. أنشئ سجل Account لكل provider كان يستخدمه:
     - Google: { providerId: 'google', accountId: google_sub, userId, ... }
     - Discord: { providerId: 'discord', accountId: discord_id, userId }
     - Telegram: موجود أصلاً في OAuthAccount — انسخه إلى Account أيضاً للتوافق
     - Email/Password: إذا كان لديه password في User.password (deprecated) → أنشئ Account { providerId: 'credential', accountId: email, password: bcryptHash, userId }

  4. اضبط emailVerified:
     - إذا كان email_confirmed_at في Supabase موجوداً → true
     - إلا → false وسيُرسل له إيميل "فعّل دخولك الجديد"

  5. أنشئ Verification token مؤقت للذين يحتاجون تأكيداً وأرسل إيميل عبر Resend باستخدام قالب `src/lib/emails/verify-email.ts`

  6. سجّل في AuditLog: { action: 'migrate_supabase_user', userId, supabaseId, providers }
```

### ما بعد السكربت:
```bash
# تحقق عددي
SELECT count(*) FROM "User" WHERE "supabaseId" IS NOT NULL; -- كل القدامى
SELECT count(*) FROM "account" WHERE "providerId" IN ('google','discord','credential'); -- يجب أن يساوي نفس العدد تقريباً
# جرّب دخول عينة: 5 حسابات Google قديمة + 5 تليجرام + 5 email (إن وجد)
```

### إرسال إيميل جماعي (اختياري):
> "أهلاً [displayName]، حدثنا نظام الدخول. حسابك وكل تعريباتك محفوظة. اضغط هنا لتفعيل دخولك الجديد (رابط 24 ساعة): [verify url]"

يُرسل عبر Resend batch (rate limit 2 رسالة/ثانية لتجنب Spam).

---

## المرحلة C — إيقاف Supabase نهائياً (بعد 90% ترحيل)

**لا تبدأ قبل:** 90% من المستخدمين النشطين (آخر 30 يوم) لديهم جلسة better-auth ناجحة، ومرّ أسبوعان بلا شكوى.

### الخطوات (بالترتيب):

1. **إخفاء واجهة Supabase القديمة:**
   - في `src/views/login.tsx` — احذف `TelegramLogin widget` القديم كـ fallback وأبقِ فقط bridge (زر تليجرام واحد)
   - في `src/lib/supabase/*` — اترك الملفات لكن اجعل `updateSession` في `proxy.ts` no-op (لا يستدعي Supabase)

2. **تعطيل Supabase Auth في الكود:**
   - في `src/lib/auth.ts:getSession()` — احذف الفقرة `supabase.auth.getUser()` وأبقِ فقط `better-auth` + `ga_admin_role` fallback
   - في `src/app/api/auth/me` — احذف فرع Supabase

3. **إبقاء البيانات فقط:**
   - لا تحذف جدول `User.supabaseId` ولا `OAuthAccount` فوراً — اتركهما 3 أشهر للرجوع
   - احذف متغيرات Supabase من `.env` بعد التأكد: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

4. **تنظيف:**
   - احذف `src/lib/supabase/**` و `src/app/api/auth/callback` (القديم) فقط بعد نسخة احتياطية و tag جديد `git tag supabase-removed`
   - اترك `proxy.ts` يتحقق فقط من `better-auth.session_token` و `ga_admin_role`

### خطة الرجوع (Rollback):
- كل ترحيل يبقى reversible: `supabaseId` محفوظ → يمكن إعادة تفعيل Supabase بمجرد إعادة `getSession` القديم.
- نسخة DB قبل كل مرحلة محفوظة في `backups/`.

---

## ملخص القرارات المفتوحة قبل التنفيذ

- [ ] خدمة البريد: هل نبقى على **Resend** أم ننتقل لـ SMTP داخلي؟ (Resend موصى به — الكود جاهز في `src/lib/emails/verify-email.ts` و `src/lib/better-auth.ts:41`)
- [ ] هل نرسل إيميل جماعي لكل القدامى أم نكتفي بالبانر عند أول دخول؟ (مقترح: بانر + إيميل فقط لمن لم يدخل منذ 30 يوماً)
- [ ] تاريخ بدء التعايش (A) وتاريخ هدف لإيقاف Supabase (C) — يحدده المالك بعد اختبار Phase 2.
