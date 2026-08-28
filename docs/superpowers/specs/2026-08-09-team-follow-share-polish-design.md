# Design: Team Follow + Share + Member Links + Professional Polish

Date: 2026-08-09

## Goal
تحسين صفحة تفاصيل الفريق: إضافة إجراءات تفاعلية (متابعة الفريق، مشاركة الرابط، ربط حسابات الأعضاء) وتوحيد المظهر الاحترافي في جميع التبويبات.

## Scope
- صفحة `team-detail` فقط (الواجهة الأمامية)، مع إضافة مسار API جديد وتحديث مسار API قائم وترحيل قاعدة البيانات.

## Backend

### 1. قاعدة البيانات — موديل `TeamFollow`
```prisma
model TeamFollow {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  createdAt DateTime @default(now())
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([teamId, userId])
  @@index([teamId])
  @@index([userId])
}
```
- علاقة `follows TeamFollow[]` في `Team`.
- علاقة `teamFollows TeamFollow[]` في `User`.
- تم الدفع عبر `prisma db push` + `prisma generate`.

### 2. مسار جديد `/api/teams/[slug]/follow`
- `GET` — حالة المتابعة للمستخدم الحالي + عدد المتابعين.
- `POST` — متابعة (يمنع متابعة الفريق الخاص؛ 401 بدون تسجيل دخول).
- `DELETE` — إلغاء المتابعة.
- المصادقة عبر `requireUser()` بنفس نمط `users/[username]/follow`.

### 3. تحديث `/api/teams/[slug]`
- إدراج `user: { select: { username: true } }` داخل كل عضوية (لربط الحسابات).
- إضافة `followersCount` إلى الإحصائيات عبر `_count.follows`.

## Types (`src/lib/types.ts`)
- `TeamMember.username?: string | null` — حساب العضو إن وُجد.
- `TeamStats.followersCount: number`.
- `TeamDetail.ownerId?: string | null` — لتحديد مالك الفريق.

## Frontend (`src/views/team-detail.tsx`)

### الإجراءات (Actions)
- **زر متابعة/متابَع**: في رأس الصفحة بجانب أيقونات التواصل.
  - يتطلب تسجيل دخول (خلاف ذلك توست "سجّل الدخول").
  - مخفي لمالك الفريق.
  - يعرض عدّاد المتابعين بين قوسين.
- **زر مشاركة**: نسخ رابط الصفحة عبر `navigator.clipboard` + توست تأكيد.
- **زر حساب العضو**: أيقونة `Link2` بجانب اسم كل عضو لديه `username` (في تبويب الأعضاء وجدول الإحصائيات) يفتح `/?view=profile&user=...`.

### التلميع الاحترافي الموحد
- بطاقات الأعضاء: زوايا مدورة `rounded-md` + صور دائرية + hover.
- جداول الإحصائيات: `rounded-md overflow-hidden` بدل الحدود المربعة.
- أرقام tabular-nums في جميع الخلايا الرقمية (التحميلات/الإعجابات/المشاهدات والإجمالي).
- أزرار موحدة `rounded-md` بنفس نظام الألوان والتفاعل.

## Verification
- `npx tsc --noEmit` — نظيف (باستثناء خطأ موجود مسبقاً خارج النطاق في `route.ts:100`).
- `npx jest` — 7/7 ناجحة.
