# توثيق مصادقة Telegram

## نظرة عامة

يستخدم المشروع نظام Deep Linking للمصادقة عبر Telegram. هذا أكثر أماناً وتجربة مستخدم أفضل من Telegram Login Widget.

---

## كيف يعمل Deep Linking

```
المستخدم              المتصفح              الخادم              Telegram Bot
   │                    │                    │                    │
   │  1. يضغط زر Telegram│                   │                    │
   │ ──────────────────>│                    │                    │
   │                    │                    │                    │
   │                    │  2. POST /api/auth/telegram             │
   │                    │ ──────────────────>│                    │
   │                    │                    │                    │
   │                    │  3. إنشاء UUID     │                    │
   │                    │     + حفظ في ملف   │                    │
   │                    │                    │                    │
   │                    │  4. { sessionToken, deepLink }          │
   │                    │ <──────────────────│                    │
   │                    │                    │                    │
   │  5. فتح t.me/BOT?start=UUID            │                    │
   │ ──────────────────────────────────────────────────────────> │
   │                    │                    │                    │
   │  6. يضغط Start     │                    │                    │
   │ ──────────────────────────────────────────────────────────> │
   │                    │                    │                    │
   │                    │                    │  7. Bot يرسل      │
   │                    │                    │     رسالة تأكيد    │
   │ <──────────────────────────────────────────────────────────│
   │                    │                    │                    │
   │                    │  8. GET /api/auth/telegram/poll?token=  │
   │                    │ ──────────────────>│                    │
   │                    │                    │                    │
   │                    │                    │  9. getUpdates     │
   │                    │                    │ ──────────────────>│
   │                    │                    │                    │
   │                    │                    │  10. يجد /start    │
   │                    │                    │      بالـ token    │
   │                    │                    │                    │
   │                    │                    │  11. performLogin  │
   │                    │                    │      + setCookie   │
   │                    │                    │                    │
   │                    │  12. { status: 'success', user }        │
   │                    │ <──────────────────│                    │
   │                    │                    │                    │
   │  13. redirect to / │                    │                    │
   │ <──────────────────│                    │                    │
```

---

## الهيكل

```
src/
├── app/api/auth/telegram/
│   ├── route.ts           # POST: إنشاء session + GET: التحقق
│   ├── poll/route.ts      # GET: polling للتحقق من Deep Link
│   └── webhook/route.ts   # POST: webhook للبوت (للإنتاج)
├── views/
│   └── login.tsx          # واجهة المستخدم
└── .tmp/telegram-sessions/
    ├── <token>.json       # بيانات الجلسة
    └── <token>.user.json  # بيانات المستخدم بعد التسجيل
```

---

## API Routes

### POST `/api/auth/telegram`
**الغرض:** إنشاء session token جديد

**الاستجابة:**
```json
{
  "sessionToken": "550e8400-e29b-41d4-a716-446655440000",
  "deepLink": "https://t.me/GAMES_ARABIC_BOT?start=550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": 1784769811316
}
```

**مدة الصلاحية:** 5 دقائق

---

### GET `/api/auth/telegram/poll?token=...`
**الغرض:** التحقق من حالة المصادقة

**الاستجابة:**
```json
// في الانتظار
{ "status": "pending" }

// نجح
{
  "status": "success",
  "user": {
    "id": "xxx",
    "username": "fffnng",
    "email": "telegram_7299579109@telegram.local",
    "role": "member",
    "avatarUrl": null
  }
}

// منتهي الصلاحية
{ "status": "expired" }

// محظور
{ "status": "banned", "error": "حسابك محظور" }
```

---

## ملفات الجلسة

### `<token>.json`
```json
{
  "used": true,
  "expiresAt": 1784769811316,
  "userData": {
    "telegramId": 7299579109,
    "firstName": "مؤمن",
    "lastName": "هاني",
    "username": "fffnng",
    "photoUrl": null
  }
}
```

### `<token>.user.json`
```json
{
  "id": "cmrwty9q70000c5edbcc93ede",
  "username": "fffnng",
  "email": "telegram_7299579109@telegram.local",
  "role": "member",
  "avatarUrl": null
}
```

---

## إعداد البوت

### 1. إنشاء البوت
1. افتح `@BotFather` على Telegram
2. أرسل `/newbot`
3. اختر اسم البوت
4. احصل على **Bot Token**

### 2. تثبيت الـ Webhook (للإنتاج)
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://games-arabic.vercel.app/api/auth/telegram/webhook"}'
```

### 3. متغيرات البيئة
```env
TELEGRAM_BOT_TOKEN="<YOUR_BOT_TOKEN_FROM_BOTFATHER>"
TELEGRAM_BOT_NAME="GAMES_ARABIC_BOT"
NEXT_PUBLIC_TELEGRAM_BOT_NAME="GAMES_ARABIC_BOT"
```

---

## كيف يعمل الـ Polling

### في وضع التطوير (localhost)
1. الـ webhook لا يعمل (Telegram يتطلب HTTPS)
2. نستخدم `getUpdates` للجلب من Telegram مباشرة
3. نبحث عن update يحتوي على `/start <sessionToken>`

### في الإنتاج (Vercel)
1. الـ webhook يعمل بشكل طبيعي
2. Telegram يُرسل التحديثات مباشرة إلى `/api/auth/telegram/webhook`
3. الـ webhook يحفظ البيانات في ملف مؤقت
4. الـ poll يقرأ البيانات من الملف

---

## دالة performLogin

```typescript
async function performLogin(userData: {
  telegramId: number
  firstName: string
  lastName?: string | null
  username?: string | null
  photoUrl?: string | null
}) {
  // 1. البحث عن المستخدم في Neon DB
  let neonUser = await db.user.findFirst({
    where: {
      OR: [
        { providerAccountId: telegramId.toString() },
        { email: `telegram_${telegramId}@telegram.local` },
      ],
    },
  })

  // 2. إنشاء مستخدم جديد إذا لم يوجد
  if (!neonUser) {
    neonUser = await db.user.create({
      data: {
        username: username || displayName,
        email: `telegram_${telegramId}@telegram.local`,
        role: 'member',
        provider: 'telegram',
        providerAccountId: telegramId.toString(),
      },
    })
  }

  // 3. فحص الحظر
  const ban = getBanStatus(neonUser)
  if (ban.banned) return { status: 'banned' }

  // 4. إنشاء role cookie
  await setRoleCookie(neonUser.id, neonUser.role, neonUser.tokenVersion)

  // 5. تحديث lastLoginAt
  await db.user.update({
    where: { id: neonUser.id },
    data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
  })

  // 6. تسجيل audit
  await logAction({ action: 'login', ... })

  return { user: { id, username, email, role, avatarUrl } }
}
```

---

## أمان الـ Deep Linking

1. **UUID فريد** — كل جلسة لها token فريد
2. **مدة صلاحية** — 5 دقائق فقط
3. **مرة واحدة** — بعد الاستخدام يُحذف
4. **لا يُخزّن كلمة المرور** — Telegram لا يُرسل كلمة المرور
5. **التحقق من الـ hash** — Telegram يُرسل hash للتحقق

---

## معالجة الأخطاء

| الخطأ | السبب | الحل |
|-------|-------|------|
| `Session expired` | انتهت الصلاحية (5 دقائق) | إنشاء session جديد |
| `Token required` | لا يوجد token في الطلب | إرسال token صحيح |
| `Bot not configured` | لا يوجد TELEGRAM_BOT_TOKEN | إضافة المتغير |
| `User not found` | فشل إنشاء المستخدم | تحقق من قاعدة البيانات |
