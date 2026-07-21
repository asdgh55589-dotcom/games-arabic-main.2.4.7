# تصميم نظام البلاغات — Reports System

**التاريخ**: 2026-07-21
**الحالة**: مسودة للتصميم
**المشروع**: games-arabic-main (Next.js + Prisma + PostgreSQL + Supabase)

---

## ملخص تصميمي

نظام بلاغات شامل يسمح للمستخدمين بالإبلاغ عن محتوى مخالف (تعريب، تعليق، مستخدم)، مع لوحة تحكم إدارية للمراجعة، وإجراءات تلقائية حسب التكرار.

**تقسيم المرحلة**:
- **المرحلة 1** (هذا التصميم): نموذج + API + لوحة تحكم + إجراءات تلقائية بسيطة
- **المرحلة 2** (لاحقاً): KPIs + إحصائيات + تصدير + تكرار البلاغات المتقدم

---

## 1. مخطط قاعدة البيانات (Schema)

### نموذج Report

```prisma
model Report {
  id              String         @id @default(cuid())
  reporterId      String?
  reporter        User?          @relation(fields: [reporterId], references: [id], onDelete: SetNull)

  // ما الذي يتم الإبلاغ عنه
  targetType      String         // mod | comment | user
  targetModId     String?
  targetMod       Mod?           @relation(fields: [targetModId], references: [id], onDelete: Cascade)
  targetCommentId String?
  targetComment   ModComment?    @relation(fields: [targetCommentId], references: [id], onDelete: Cascade)
  targetUserId    String?
  targetUser      User?          @relation(fields: [targetUserId], references: [id], onDelete: Cascade)

  // تفاصيل البلاغ
  reason          String         // spam | inappropriate | copyright | offensive | false_info | technical | other
  priority        String         @default("medium") // low | medium | high | critical
  description     String?        // تفاصيل إضافية من المُبلِّغ
  evidenceUrls    String?        // CSV: روابط صور/لقطات شاشة

  // الحالة والمتابعة
  status          String         @default("new") // new | under_review | confirmed | rejected | pending | resolved | reopened
  assignedToId    String?        // المسؤول عن المراجعة
  assignedTo      User?          @relation(fields: [assignedToId], references: [id], onDelete: SetNull)
  resolution      String?        // ملاحظات الحل
  resolvedAt      DateTime?

  // الإجراءات التلقائية
  actionTaken     String?        // none | warned | content_hidden | content_deleted | temp_ban | perm_ban
  actionAt        DateTime?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  // فهارس
  @@index([reporterId])
  @@index([targetModId])
  @@index([targetCommentId])
  @@index([targetUserId])
  @@index([status])
  @@index([priority])
  @@index([reason])
  @@index([createdAt])
  @@index([status, priority])  // فهرس مركب للمراجعة
}
```

### سبب الإبلاغ (Reason Enum)

| القيمة | التسمية العربية | الأولوية التلقائية |
|--------|----------------|-------------------|
| `spam` | سبام وإعلانات | medium |
| `inappropriate` | محتوى مخالف للآداب | high |
| `copyright` | انتهاك حقوق الملكية | high |
| `offensive` | إساءة شخصية | high |
| `false_info` | معلومات خاطئة | medium |
| `technical` | محتوى تقني معطوب | low |
| `other` | أخرى | medium |

### الحالات (Status)

| القيمة | التسمية | الوصف |
|--------|---------|-------|
| `new` | جديدة | في انتظار المراجعة |
| `under_review` | قيد المراجعة | مسؤول يدرس البلاغ |
| `confirmed` | مؤكد | تم اتخاذ إجراء |
| `rejected` | مرفوض | البلاغ غير صحيح |
| `pending` | معلقة | تحتاج معلومات إضافية |
| `resolved` | منجز | تم الحل |
| `reopened` | معاد فتحها | بعد مراجعة إضافية |

---

## 2. واجهة برمجة التطبيقات (API Routes)

### 2.1 تقديم بلاغ — `POST /api/reports`

**المصادقة**: مطلوبة (`requireAuth()`)

**الطلب**:
```json
{
  "targetType": "mod",           // mod | comment | user
  "targetId": "cuid-string",     // ID المحتوى المستهدف
  "reason": "inappropriate",     // سبب البلاغ
  "description": "التفاصيل...",  // اختياري
  "evidenceUrls": ["url1"]       // اختياري — صور دليل
}
```

**التحقق**:
- `targetType` + `targetId` مطلوبان
- `reason` يجب أن يكون ضمن القائمة المسموحة
- لا يُسمح بالإبلاغ عن النفس
- لا يُسمح بالإبلاغ عن محتوى تم الإبلاغ عنه مسبقاً من نفس المستخدم
- فحص rate limit: 5 بلاغات يومياً لكل مستخدم
- فحص IP ban

**الاستجابة**: `201 { report: Report }`

**الأولوية التلقائية**: تُحسب حسب `reason` (انظر الجدول أعلاه)

### 2.2 قائمة البلاغات — `GET /api/admin/reports`

**المصادقة**: `requireModerator()`

**المعاملات**:
- `page` (افتراضائي: 1)
- `limit` (افتراضائي: 20، أقصى: 50)
- `status` — فلترة حسب الحالة
- `reason` — فلترة حسب السبب
- `priority` — فلترة حسب الأولوية
- `targetType` — فلترة حسب نوع المستهدف
- `assignedToId` — فلترة حسب المسؤول
- `search` — بحث في `description`
- `sort` — `newest` | `oldest` | `priority`

**الاستجابة**:
```json
{
  "reports": [...],
  "total": 42,
  "totalPages": 3,
  "stats": {
    "new": 5,
    "under_review": 2,
    "confirmed": 30,
    "rejected": 5
  }
}
```

### 2.3 تفاصيل بلاغ — `GET /api/admin/reports/[id]`

**المصادقة**: `requireModerator()`

**الاستجابة**:
```json
{
  "report": {
    "id": "...",
    "reporter": { "id": "...", "username": "...", "avatarUrl": "..." },
    "targetType": "mod",
    "targetMod": { "id": "...", "name": "...", "slug": "..." },
    "reason": "inappropriate",
    "priority": "high",
    "description": "...",
    "evidenceUrls": ["..."],
    "status": "new",
    "assignedTo": null,
    "createdAt": "...",
    "previousReports": 3  // بلاغات سابقة على نفس المحتوى
  }
}
```

### 2.4 تحديث حالة — `PATCH /api/admin/reports/[id]`

**المصادقة**: `requireModerator()`

**الطلب**:
```json
{
  "status": "under_review",
  "assignedToId": "...",    // اختياري
  "resolution": "..."       // اختياري
}
```

### 2.5 تأكيد البلاغ — `POST /api/admin/reports/[id]/confirm`

**المصادقة**: `requireModerator()`

**الطلب**:
```json
{
  "action": "warn",     // warn | hide_content | delete_content | temp_ban | perm_ban
  "resolution": "...",  // ملاحظات
  "banDuration": 7      // فقط مع temp_ban (أيام)
}
```

**الإجراءات التلقائية** (انظر القسم 4)

### 2.6 رفض البلاغ — `POST /api/admin/reports/[id]/reject`

**المصادقة**: `requireModerator()`

**الطلب**:
```json
{
  "resolution": "سبب الرفض..."
}
```

---

## 3. واجهة المستخدم (Frontend Components)

### 3.1 زر الإبلاغ — `<ReportButton />`

**الموقع**: مكون مشترك يُستخدم في:
- تعريف التعريب (`mod-detail.tsx`) — بجانب أزرار التحميل والتأييد
- تعليقات (`mod-comments.tsx`) — في قائمة الإجراءات لكل تعليق
- ملف المستخدم (`profile.tsx`) — في قائمة الإجراءات

**التصميم**:
- زر `Flag` icon من lucide-react
- عند الضغط: يفتح **Modal** (Radix Dialog)
- يختفي إذا كان المستخدم غير مسجل دخول
- يتحول لـ `CheckCircle` بعد تقديم البلاغ بنجاح

### 3.2 نموذج الإبلاغ — `<ReportDialog />`

**التصميم**: Radix Dialog مع:
- **Header**: "الإبلاغ عن محتوى" + زر إغلاق
- **Reason Select**: قائمة منسدلة بأسباب البلاغ (6 خيارات)
- **Description Textarea**: تفاصيل إضافية (اختياري)
- **Evidence Upload**: رفع صور (اختياري، حد أقصى 3 صور، 5MB لكل صورة)
- **Footer**: زر "إرسال البلاغ" + زر "إلغاء"
- **Toast** عند النجاح: "تم استلام بلاغك. شكراً لمساهمتك."

### 3.3 لوحة تحكم البلاغات — `/admin/reports`

**التصميم**: يتبع نمط `admin/audit/page.tsx` (جدول + فلاتر + pagination)

**المكونات**:
- **Header**: "إدارة البلاغات" + إحصائيات سريعة (جديدة / قيد المراجعة / منجزة)
- **Filte**Bar:
  - حالة (Status dropdown)
  - سبب (Reason dropdown)
  - أولوية (Priority dropdown)
  - نوع المستهدف (Target type dropdown)
  - ترتيب (Sort dropdown)
- **Reports Table**:
  - العمود 1: نوع المستهدف (Icon + نص)
  - العمود 2: السبب (Badge ملون)
  - العمود 3: الأولوية (Badge ملون)
  - العمود 4: الحالة (Badge ملون)
  - العمود 5: المُبلِّغ (Avatar + username)
  - العمود 6: المسؤول (Avatar + username أو "غير مُعيَّن")
  - العمود 7: التاريخ (relative time)
  - العمود 8: إجراءات (عرض / تأكيد / رفض)
- **Pagination**

### 3.4 صفحة تفاصيل البلاغ — `/admin/reports/[id]`

**المكونات**:
- **Report Card**: معلومات البلاغ الكاملة
- **Target Preview**: معاينة المحتوى المُبلَّغ عنه (رابط + معلومات)
- **Reporter Info**: معلومات المُبلِّغ + تاريخه
- **Evidence Gallery**: عرض صور الدليل
- **Action Panel**:
  - تغيير الحالة
  - تعيين مسؤول
  - اتخاذ إجراء (تحذير / حذف / حظر)
  - إدخال ملاحظات الحل
- **History**: سجل تغييرات الحالة

### 3.5 تعريف البلاغ — Admin Badge في الـ Sidebar

**الموقع**: `admin/layout.tsx` — مجموعة "إدارة المجتمع"
**الإضافة**: `{ href: '/admin/reports', label: 'البلاغات', icon: Flag, adminOnly: true }`

---

## 4. الإجراءات التلقائية (Auto Actions)

### 4.1 عند تأكيد البلاغ (`confirm`)

```
1. تحديث حالة البلاغ → confirmed
2. تسجيل الإجراء المتخذ في Report.actionTaken
3. حسب نوع الإجراء المختار:
   - warn:       إرسال إشعار + UserAction(warn) + خصم 10 نقاط من tier
   - hide_content: إخفاء المحتوى (Mod.isFeatured=false أو حذف التعليق) + تحذير
   - delete_content: حذف المحتوى + تحذير + UserAction(delete)
   - temp_ban:   تعليق المستخدم (banStatus='banned_temp', bannedUntil) + UserAction(suspend)
   - perm_ban:   حظر دائم (banStatus='banned_perm') + UserAction(ban)
4. إرسال إشعار للمستخدم المُبلَّغ عنه (نتيجة المراجعة)
5. إرسال إشعار للمستخدم المُبلِّغ (تم تأكيد بلاغك)
6. تسجيل في AuditLog
```

### 4.2 التكرار (Phase 2 — مبسط في Phase 1)

**Phase 1**: فقط تحذير + UserAction log
**Phase 2**: التسلسل التصاعدي:
- التحذير الأول: تنبيه + خصم نقاط
- التحذير الثاني: تعليق 24 ساعة
- التحذير الثالث: تعليق 7 أيام + بريد
- التحذير الرابع: حظر دائم

### 4.3 حماية من الإساءة (Phase 1)

- **Rate limit**: 5 بلاغات يومياً لكل مستخدم
- **منع الإبلاغ عن النفس**: `reporterId !== targetUserId`
- **منع الإبلاغ المكرر**: لا يُسمح للمستخدم بالإبلاغ عن نفس المحتوى مرتين
- **تسجيل IP**: `x-forwarded-for` يُخزّن في `Report` (أو `UserAction`)

---

## 5. الإشعارات

### Types المُستخدمة

| النوع | المستخدم | الرسالة |
|-------|---------|---------|
| `report_received` | المُبلِّغ | "تم استلام بلاغك بنجاح. شكراً لمساهمتك." |
| `report_action_taken` | المُبلَّغ عنه | "تم اتخاذ إجراء على محتواك بناءً على بلاغ." |
| `report_confirmed` | المُبلِّغ | "تم تأكيد بلاغك واتخاذ الإجراء المناسب." |
| `report_rejected` | المُبلِّغ | "تم مراجعة بلاغك. لم نجد مخالفة." |
| `admin_new_report` | كل الأدمن | "بلاغ جديد: [السبب]" |

### التكامل مع النظام الحالي

- نستخدم `db.notification.create()` مباشرة
- نستخدم `sendRealtimeNotification()` للإشعارات الفورية
- نستخدم `handleAdminNotification('report', { reason })` للإشعارات الإدارية

---

## 6. هيكل الملفات

```
src/
├── app/
│   ├── api/
│   │   ├── reports/route.ts                    # POST — تقديم بلاغ
│   │   └── admin/reports/
│   │       ├── route.ts                        # GET — قائمة البلاغات
│   │       └── [id]/
│   │           ├── route.ts                    # GET — تفاصيل / PATCH — تحديث
│   │           ├── confirm/route.ts            # POST — تأكيد + إجراء
│   │           └── reject/route.ts             # POST — رفض
│   └── admin/reports/
│       ├── page.tsx                            # لوحة تحكم البلاغات
│       └── [id]/page.tsx                       # صفحة تفاصيل البلاغ
├── components/
│   ├── report-button.tsx                       # زر الإبلاغ
│   ├── report-dialog.tsx                       # نموذج الإبلاغ (Modal)
│   └── report-status-badge.tsx                 # Badge حالة البلاغ
├── lib/
│   └── reports/
│       ├── auto-actions.ts                     # الإجراءات التلقائية
│       ├── validation.ts                       # تحقق من صحة البلاغ
│       └── constants.ts                        # ثوابت (أسباب، أولويات، حالات)
└── prisma/
    └── schema.prisma                           # نموذج Report
```

---

## 7. الترتيب والمراحل

### المرحلة 1 (هذا التصميم)

| # | المهمة | الملفات |
|---|--------|---------|
| 1 | إضافة نموذج Report في schema.prisma | `prisma/schema.prisma` |
| 2 | إنشاء migration + تطبيق | `prisma migrate` |
| 3 | كتابة constants.ts (أسباب، أولويات، حالات) | `src/lib/reports/constants.ts` |
| 4 | كتابة validation.ts | `src/lib/reports/validation.ts` |
| 5 | API: تقديم بلاغ `POST /api/reports` | `src/app/api/reports/route.ts` |
| 6 | مكون ReportButton | `src/components/report-button.tsx` |
| 7 | مكون ReportDialog | `src/components/report-dialog.tsx` |
| 8 | مكون ReportStatusBadge | `src/components/report-status-badge.tsx` |
| 9 | تثبيت ReportButton في mod-detail | `src/views/mod-detail.tsx` |
| 10 | تثبيت ReportButton في mod-comments | `src/components/mod-comments.tsx` |
| 11 | API: قائمة البلاغات `GET /api/admin/reports` | `src/app/api/admin/reports/route.ts` |
| 12 | API: تفاصيل بلاغ `GET/PATCH /api/admin/reports/[id]` | `src/app/api/admin/reports/[id]/route.ts` |
| 13 | API: تأكيد بلاغ `POST .../confirm` | `src/app/api/admin/reports/[id]/confirm/route.ts` |
| 14 | API: رفض بلاغ `POST .../reject` | `src/app/api/admin/reports/[id]/reject/route.ts` |
| 15 | الإجراءات التلقائية `auto-actions.ts` | `src/lib/reports/auto-actions.ts` |
| 16 | إضافة Flag icon في admin sidebar | `src/app/admin/layout.tsx` |
| 17 | صفحة لوحة تحكم البلاغات | `src/app/admin/reports/page.tsx` |
| 18 | صفحة تفاصيل البلاغ | `src/app/admin/reports/[id]/page.tsx` |
| 19 | حماية الإساءة (rate limit + منع التكرار) | `src/app/api/reports/route.ts` |
| 20 | إشعارات البلاغات | `src/lib/notifications/` (تحديث) |
| 21 | اختبار + TypeScript check | `npx tsc --noEmit` |

### المرحلة 2 (لاحقاً)

- إحصائيات البلاغات (KPIs)
- تصدير تقرير البلاغات
- التكرار التصاعدي المتقدم (Repeat Offender)
- كشف البلاغات المزيفة
- نقاط الثقة للمُبلِّغين
- إشعارات البريد للإجراءات المهمة
- أرشيف البلاغات المحلولة
- إعادة فتح بلاغ

---

## 8. القيود والمعايير

### أمنية
- `requireAuth()` لتقديم البلاغ
- `requireModerator()` لعرض/إدارة البلاغات
- لا يُسمح بالإبلاغ عن النفس
- rate limit على تقديم البلاغات
- لا SQL injection (Prisma parameterized)

### أداء
- فهارس على `Report.status + priority` (المرجع الرئيسي)
- فهارس على `Report.targetModId/commentId/userId`
- pagination على كل القوائم

### UX
- Arabic-first (RTL) — كل النصوص بالعربية
- Toast notifications بعد كل إجراء
- loading states مع Loader2
- Empty states مع أيقونة + نص

---

## ملاحظات التصميم

1. **الدليل المرئي**: `evidenceUrls` يُخزّن كـ CSV في `String` field (متوافق مع النمط الحالي في `Mod.galleryUrls` و`Mod.tags`)
2. **الأولوية التلقائية**: تُحسب حسب `reason` عند الإنشاء، لكن المشرف يستطيع تعديلها يدوياً
3. **الإجراءات التلقائية**: `actionTaken` يُخزّن كـ string واحد (يجمع كل الإجراءات المتخذة)
4. **البلاغات المكررة**: في Phase 1 نعرض فقط بلاغات سابقة على نفس المحتوى (عدداً). في Phase 2 نضيف كشف الأنماط
5. **الترجمة**: كل enum values بالإنجليزية مع Arabic labels في constants.ts
