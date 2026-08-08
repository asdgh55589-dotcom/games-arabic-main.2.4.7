# توثيق المشروع

## دليل التوثيق

### 1. المصادقة (Authentication)
- **[توثيق المصادقة الكامل](./AUTHENTICATION.md)** — نظرة عامة على نظام المصادقة
- **[مصادقة الإدارة](./ADMIN-AUTH.md)** — توثيق تسجيل دخول الإدارة
- **[مصادقة Telegram](./TELEGRAM-AUTH.md)** — توثيق نظام Deep Linking

---

## ملخص سريع

### نظام المصادقة
يستخدم المشروع 4 طرق لتسجيل الدخول:

| الطريقة | الحالة | المسار |
|---------|--------|--------|
| Google OAuth | ✅ مفعّل | `/?view=login` |
| Discord OAuth | ✅ مفعّل | `/?view=login` |
| Telegram Deep Link | ✅ مفعّل | `/?view=login` |
| Admin Login | ✅ مفعّل | `/admin/login` |

### الملفات الرئيسية

```
src/
├── app/api/auth/
│   ├── callback/route.ts      # OAuth callback
│   ├── login/route.ts         # Admin login
│   ├── logout/route.ts        # Logout
│   ├── me/route.ts            # Current user
│   └── telegram/
│       ├── route.ts           # Session + Status
│       ├── poll/route.ts      # Polling
│       └── webhook/route.ts   # Bot webhook
├── lib/
│   ├── auth.ts                # Core auth functions
│   └── supabase/              # Supabase clients
└── views/
    └── login.tsx              # Login page
```

### متغيرات البيئة المطلوبة

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# JWT
JWT_SECRET=

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_NAME=
NEXT_PUBLIC_TELEGRAM_BOT_NAME=
```

---

## خطوات الإعداد

### 1. Supabase Dashboard
- أضف `https://games-arabic.vercel.app/api/auth/callback` إلى Redirect URLs

### 2. Google Cloud Console
- أضف `https://games-arabic.vercel.app/api/auth/callback` إلى Authorized redirect URIs

### 3. Discord Developer Portal
- أضف `https://games-arabic.vercel.app/api/auth/callback` إلى Redirects

### 4. Telegram Bot
- أنشئ البوت عبر `@BotFather`
- ثبّت الـ webhook (للإنتاج)

---

## الأدوار والصلاحيات

| الدور | الصلاحيات |
|-------|-----------|
| `owner` | كل شيء + إدارة الأدوار |
| `admin` | التعريبات + إدارة المستخدمين |
| `moderator` | نشر/تعديل التعريبات |
| `member` | لا يصلح للوحة التحكم |

---

## الأمان

- HttpOnly Cookies
- Secure Cookies (HTTPS)
- SameSite Lax
- JWT Signing (HMAC-SHA256)
- Token Versioning
- Rate Limiting
- IP Ban System
- Audit Logging
