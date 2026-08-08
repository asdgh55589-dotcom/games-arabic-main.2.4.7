# توثيق نظام المصادقة (Authentication)

## نظرة عامة

يستخدم المشروع نظام مصادقة مزدوج:
1. **Supabase Auth** — للمصادقة عبر OAuth (Google, Discord)
2. **JWT Role Cookie** — للتحقق من الصلاحيات في Edge runtime

---

## الهيكل العام

```
src/
├── app/api/auth/
│   ├── callback/route.ts      # استقبال OAuth callback
│   ├── login/route.ts         # تسجيل دخول الإدارة (username/password)
│   ├── logout/route.ts        # تسجيل الخروج
│   ├── me/route.ts            # جلب بيانات المستخدم الحالي
│   └── telegram/
│       ├── route.ts           # إنشاء session token + جلب الحالة
│       ├── poll/route.ts      # polling للتحقق من Deep Link
│       └── webhook/route.ts   # webhook للبوت (للإنتاج)
├── lib/
│   ├── auth.ts                # الدوال الأساسية للمصادقة
│   └── supabase/
│       ├── server.ts          # عميل Supabase للسيرفر
│       ├── client.ts          # عميل Supabase للمتصفح
│       └── middleware.ts      # تحديث الجلسة في middleware
└── views/
    └── login.tsx              # واجهة تسجيل الدخول
```

---

## مزودو المصادقة

### 1. Google OAuth
- **الحالة:** مفعّل ✅
- **ال_callback URL:** `https://games-arabic.vercel.app/api/auth/callback`
- **الميزة:** يُظهر نافذة اختيار الحساب (`prompt: select_account`)

### 2. Discord OAuth
- **الحالة:** مفعّل ✅
- **ال_callback URL:** `https://games-arabic.vercel.app/api/auth/callback`

### 3. Telegram Deep Linking
- **الحالة:** مفعّل ✅
- **البوت:** `@GAMES_ARABIC_BOT`
- **الآلية:** Deep Link → Bot → Polling → Login

### 4. Admin Login (username/password)
- **الحالة:** مفعّل ✅
- **المسار:** `/admin/login`
- **المستخدم:** owner فقط

---

## تدفق تسجيل الدخول عبر OAuth

```
المستخدم              المتصفح              الخادم              Supabase
   │                    │                    │                    │
   │  1. يضغط زر OAuth  │                    │                    │
   │ ──────────────────>│                    │                    │
   │                    │  2. signInWithOAuth │                    │
   │                    │ ──────────────────>│                    │
   │                    │                    │  3. redirect to    │
   │                    │                    │     Google/Discord │
   │  4. يُحوّل إلى     │                    │                    │
   │     المزود          │                    │                    │
   │ <──────────────────│                    │                    │
   │                    │                    │                    │
   │  5. يسجّل دخول     │                    │                    │
   │ ──────────────────────────────────────────────────────────> │
   │                    │                    │                    │
   │  6. يُعيده مع Code │                    │                    │
   │ <──────────────────────────────────────────────────────────│
   │                    │                    │                    │
   │                    │  7. GET /api/auth/callback?code=...     │
   │                    │ ──────────────────>│                    │
   │                    │                    │  8. exchangeCode   │
   │                    │                    │     ForSession     │
   │                    │                    │ ──────────────────>│
   │                    │                    │                    │
   │                    │                    │  9. userData       │
   │                    │                    │ <──────────────────│
   │                    │                    │                    │
   │                    │  10. setRoleCookie │                    │
   │                    │ <──────────────────│                    │
   │                    │                    │                    │
   │  11. redirect to / │                    │                    │
   │ <──────────────────│                    │                    │
   │                    │                    │                    │
   │  12. GET /api/auth/me                   │                    │
   │ ──────────────────>│                    │                    │
   │                    │  13. getUser       │                    │
   │                    │ ──────────────────>│                    │
   │                    │                    │                    │
   │  14. user data     │                    │                    │
   │ <──────────────────│                    │                    │
```

---

## تدفق تسجيل الدخول عبر Telegram

```
المستخدم              المتصفح              الخادم              Telegram
   │                    │                    │                    │
   │  1. يضغط زر Telegram│                   │                    │
   │ ──────────────────>│                    │                    │
   │                    │  2. POST /api/auth/telegram             │
   │                    │ ──────────────────>│                    │
   │                    │                    │  3. إنشاء session  │
   │                    │                    │     token          │
   │                    │  4. deepLink       │                    │
   │                    │ <──────────────────│                    │
   │                    │                    │                    │
   │  5. فتح بوت Telegram│                   │                    │
   │ ──────────────────────────────────────────────────────────> │
   │                    │                    │                    │
   │  6. /start <token> │                    │                    │
   │ ──────────────────────────────────────────────────────────> │
   │                    │                    │                    │
   │                    │  7. GET /api/auth/telegram/poll?token=  │
   │                    │ ──────────────────>│                    │
   │                    │                    │  8. getUpdates     │
   │                    │                    │ ──────────────────>│
   │                    │                    │                    │
   │                    │                    │  9. user data      │
   │                    │                    │ <──────────────────│
   │                    │                    │                    │
   │                    │  10. performLogin  │                    │
   │                    │ <──────────────────│                    │
   │                    │                    │                    │
   │                    │  11. setRoleCookie │                    │
   │                    │ <──────────────────│                    │
   │                    │                    │                    │
   │  12. redirect to / │                    │                    │
   │ <──────────────────│                    │                    │
```

---

## الكوكيز المستخدمة

### 1. Supabase Session Cookies
- **الاسم:** `sb-<project-ref>-auth-token`
- **المحتوى:** JWT يحتوي على Supabase session
- **الإعدادات:**
  ```typescript
  {
    httpOnly: true,
    secure: true,        // في الإنتاج
    sameSite: 'lax',
    path: '/',
  }
  ```

### 2. Role Cookie
- **الاسم:** `ga_admin_role`
- **المحتوى:** JWT يحتوي على `{ userId, role, tv }`
- **الإعدادات:**
  ```typescript
  {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 604800,      // 7 أيام
  }
  ```

---

## الأدوار والصلاحيات

| الدور | الصلاحيات |
|-------|-----------|
| `owner` | كل شيء + إدارة الأدوار + إعدادات الموقع |
| `admin` | كل التعريبات/الألعاب + إدارة المستخدمين |
| `moderator` | نشر/تعديل التعريبات فقط |
| `member` | لا يصلح للوحة التحكم |

---

## API Routes

### POST `/api/auth/telegram`
**الغرض:** إنشاء session token للـ Deep Linking

**الاستجابة:**
```json
{
  "sessionToken": "uuid",
  "deepLink": "https://t.me/GAMES_ARABIC_BOT?start=uuid",
  "expiresAt": 1234567890
}
```

### GET `/api/auth/telegram/poll?token=...`
**الغرض:** التحقق من حالة المصادقة

**الاستجابة:**
```json
{
  "status": "success" | "pending" | "expired" | "banned",
  "user": { "id", "username", "email", "role", "avatarUrl" }
}
```

### GET `/api/auth/me`
**الغرض:** جلب بيانات المستخدم الحالي

**الاستجابة:**
```json
{
  "user": { "id", "username", "email", "role", "avatarUrl" }
}
```

### POST `/api/auth/logout`
**الغرض:** تسجيل الخروج

**الاستجابة:**
```json
{ "success": true }
```

### GET `/api/auth/callback?code=...`
**الغرض:** استقبال OAuth callback من Supabase

**الإجراء:** يُحوّل إلى الصفحة الرئيسية بعد تسجيل الدخول

---

## متغيرات البيئة المطلوبة

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# JWT
JWT_SECRET=xxx

# OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx

# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_BOT_NAME=xxx
NEXT_PUBLIC_TELEGRAM_BOT_NAME=xxx
```

---

## الإعداد في Supabase Dashboard

### 1. Redirect URLs
أضف إلى **Authentication → URL Configuration → Redirect URLs**:
```
https://games-arabic.vercel.app/api/auth/callback
```

### 2. Google OAuth
أضف إلى **Google Cloud Console → Credentials → Authorized redirect URIs**:
```
https://games-arabic.vercel.app/api/auth/callback
```

### 3. Discord OAuth
أضف إلى **Discord Developer Portal → OAuth2 → Redirects**:
```
https://games-arabic.vercel.app/api/auth/callback
```

---

## معالجة الأخطاء

| الخطأ | السبب | الحل |
|-------|-------|------|
| `auth_failed` | فشل تبادل الكود | تحقق من Redirect URLs |
| `no_session` | لا يوجد Supabase session | تحقق من إعدادات Supabase |
| `banned` | المستخدم محظور | تحقق من banStatus في DB |
| `IP_BANNED` | IP محظور | تحقق من IpBan table |

---

## الأمان

1. **HttpOnly Cookies** — لا يمكن قراءتها من JavaScript
2. **Secure Cookies** — فقط عبر HTTPS في الإنتاج
3. **SameSite Lax** — يمنع CSRF الهجمات
4. **JWT Signing** — التوكن موقّع بـ HMAC-SHA256
5. **Token Versioning** — إبطال الجلسات القديمة
6. **Rate Limiting** — حماية من Brute Force
7. **IP Ban** — حظر عناوين IP المشبوهة
