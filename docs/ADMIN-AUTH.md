# توثيق مصادقة الإدارة (Admin Authentication)

## نظرة عامة

نظام تسجيل دخول الإدارة منفصل عن المستخدمين العاديين. يستخدم username/password بدلاً من OAuth.

---

## الهيكل

```
src/
├── app/admin/
│   └── login/
│       └── page.tsx           # صفحة تسجيل دخول الإدارة
├── app/api/auth/
│   └── login/
│       └── route.ts           # API تسجيل دخول الإدارة
└── middleware.ts              # حماية مسارات الإدارة
```

---

## تدفق تسجيل دخول الإدارة

```
المدير                المتصفح              الخادم              Neon DB
   │                    │                    │                    │
   │  1. يفتح /admin    │                    │                    │
   │ ──────────────────>│                    │                    │
   │                    │                    │                    │
   │  2. redirect to    │                    │                    │
   │     /admin/login   │                    │                    │
   │ <──────────────────│                    │                    │
   │                    │                    │                    │
   │  3. يدخل username  │                    │                    │
   │     + password     │                    │                    │
   │ ──────────────────>│                    │                    │
   │                    │  4. POST /api/auth/login                │
   │                    │ ──────────────────>│                    │
   │                    │                    │  5. findFirst user │
   │                    │                    │ ──────────────────>│
   │                    │                    │                    │
   │                    │                    │  6. userData       │
   │                    │                    │ <──────────────────│
   │                    │                    │                    │
   │                    │                    │  7. signInWith-    │
   │                    │                    │     Password       │
   │                    │                    │ ──────────────────>│ Supabase
   │                    │                    │                    │
   │                    │                    │  8. session        │
   │                    │                    │ <──────────────────│
   │                    │                    │                    │
   │                    │  9. setRoleCookie  │                    │
   │                    │ <──────────────────│                    │
   │                    │                    │                    │
   │  10. redirect to   │                    │                    │
   │      /admin        │                    │                    │
   │ <──────────────────│                    │                    │
```

---

## صفحة تسجيل دخول الإدارة

**المسار:** `/admin/login`

**المكونات:**
- حقل اسم المستخدم
- حقل كلمة المرور
- زر تسجيل الدخول
- رسالة الخطأ

**المنطق:**
1. فحص إذا كان المستخدم مسجّل دخول بالفعل → redirect لـ `/admin`
2. عرض رسالة خطأ من query string (`?error=insufficient_role`)
3. إرسال طلب تسجيل الدخول
4. بعد النجاح → redirect لـ `/admin`

---

## API Route: POST `/api/auth/login`

**الطلب:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**الاستجابة (نجاح):**
```json
{
  "user": {
    "id": "xxx",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "avatarUrl": null
  }
}
```

**الاستجابة (خطأ):**
```json
{
  "error": "بيانات الدخول غير صحيحة"
}
```

**الكود:**
```typescript
// src/app/api/auth/login/route.ts

export async function POST(req: NextRequest) {
  // 1. التحقق من OWNER_ACCOUNT
  await ensureOwnerExists()

  // 2. التحقق من المدخلات
  const parsed = loginSchema.safeParse(body)

  // 3. فحص Rate Limiting (5 محاولات/دقيقة)
  const rl = await rateLimit(req, { limit: 5, window: 60 })

  // 4. البحث عن المستخدم في Neon DB
  const neonUser = await db.user.findFirst({ where: { username } })

  // 5. فحص الحظر
  const ban = getBanStatus(neonUser)

  // 6. فحص الدور (member لا يصلح للإدارة)
  if (neonUser.role === 'member') {
    return 403
  }

  // 7. تسجيل الدخول عبر Supabase Auth
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: neonUser.email,
    password,
  })

  // 8. إنشاء role cookie
  await setRoleCookie(neonUser.id, neonUser.role, neonUser.tokenVersion)

  // 9. تحديث lastLoginAt
  await db.user.update({ where: { id }, data: { lastLoginAt: new Date() } })

  // 10. تسجيل audit
  await logAction({ action: 'login', ... })
}
```

---

## حماية مسارات الإدارة

### Middleware
```typescript
// src/middleware.ts

// حماية /admin/* (مش /admin/login)
if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.includes(pathname)) {
  const rolePayload = await getRoleFromCookie(req)
  if (!rolePayload?.role || !user) {
    return redirect('/admin/login')
  }
  if (rolePayload.role !== 'moderator' && rolePayload.role !== 'admin' && rolePayload.role !== 'owner') {
    return redirect('/admin/login?error=insufficient_role')
  }
}

// حماية /api/admin/*
if (pathname.startsWith('/api/admin')) {
  const rolePayload = await getRoleFromCookie(req)
  if (!rolePayload?.role || !user) {
    return 401
  }
  if (rolePayload.role !== 'moderator' && rolePayload.role !== 'admin' && rolePayload.role !== 'owner') {
    return 403
  }
}
```

---

## إنشاء حساب Owner الأولي

### через `.env`
```env
OWNER_USERNAME=admin
OWNER_EMAIL=admin@example.com
OWNER_PASSWORD=secure_password
```

### عبر API
```bash
curl -X POST https://games-arabic.vercel.app/api/admin/setup
```

**الاستجابة:**
```json
{
  "message": "Owner account created successfully",
  "setup": true
}
```

---

## إعدادات الكوكيز

```typescript
// src/lib/auth.ts

export async function setRoleCookie(userId: string, role: UserRole, tokenVersion?: number) {
  const payload = { userId, role, tv: tokenVersion }
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('604800s') // 7 أيام
    .sign(JWT_SECRET)

  cookieStore.set('ga_admin_role', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 604800,
  })
}
```

---

## Rate Limiting

| Endpoint | الحد | النافذة |
|----------|------|---------|
| `/api/auth/login` | 5 محاولات | 60 ثانية |
| `/api/admin/setup` | 3 محاولات | 300 ثانية |

---

## Audit Logging

كل عملية تسجيل دخول تُسجل في `UserAction` table:

```typescript
await logAction({
  userId: user.id,
  username: user.username,
  action: 'login',
  entity: 'user',
  entityId: user.id,
  request: req,
})
```

---

## معالجة الأخطاء

| الخطأ | HTTP Code | المعنى |
|-------|-----------|--------|
| `بيانات غير صحيحة` | 400 | المدخلات غير صالحة |
| `بيانات الدخول غير صحيحة` | 401 | كلمة المرور خاطئة |
| `لا تملك صلاحية الوصول` | 403 | المستخدم member |
| `تم تجاوز الحد` | 429 | Rate limit |
| `حدث خطأ` | 500 | خطأ داخلي |
