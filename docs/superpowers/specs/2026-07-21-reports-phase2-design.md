# تصميم نظام البلاغات — المرحلة 2

**التاريخ**: 2026-07-21
**الحالة**: مُعتمد
**المشروع**: games-arabic-main (Next.js + Prisma + PostgreSQL + Supabase)
**المعمارية**: On-Report Processing

---

## ملخص المرحلة 2

تتمة نظام البلاغات من المرحلة 1 بـ 6 ميزات إضافية:
1. نقاط الثقة (Trust Scores) — لكل مستخدم
2. كشف البلاغات المزيفة — تحليل سلوك المبلّغ
3. KPIs + إحصائيات — لوحة تحكم تحليلية
4. تصدير CSV — تقارير قابلة للتصدير
5. التكرار التصاعدي المتقدم — إجراءات تلقائية حسب التكرار
6. إشعارات البريد — تنبيهات للمبلّغين والمستخدمين

---

## 1. نقاط الثقة (Trust Scores)

### نموذج قاعدة البيانات

```prisma
model UserTrustScore {
  id                       String   @id @default(cuid())
  userId                   String   @unique
  user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  score                    Int      @default(50)  // 0-100
  reportAccuracy           Float    @default(0)   // نسبة البلاغات المؤكدة
  totalReports             Int      @default(0)   // بلاغات مقدمة
  confirmedReports         Int      @default(0)   // بلاغات مؤكدة
  rejectedReports          Int      @default(0)   // بلاغات مرفوضة
  reportsReceived          Int      @default(0)   // بلاغات تلقّاها
  reportsReceivedConfirmed Int      @default(0)   // بلاغات مؤكدة ضدّه
  updatedAt                DateTime @updatedAt
  createdAt                DateTime @default(now())

  @@index([userId])
  @@index([score])
}
```

### قواعد حساب النقاط

| الحدث | المبلّغ | الهدف |
|-------|--------|-------|
| بلاغ مؤكّد | +10 | -5 |
| بلاغ مرفوض | -8 | 0 |
| محتوى محذوف بسبب بلاغ | 0 | -15 |
| حظر مستخدم بسبب بلاغ | 0 | -20 |

- **البداية**: 50 نقطة
- **الحد الأدنى**: 0
- **الحد الأقصى**: 100

### مستويات الثقة

| النطاق | المستوى | السلوك |
|--------|---------|--------|
| 0-20 | مُشكوك (Suspicious) | بلاغاته تُراجع يدوياً |
| 21-40 | عادي (Normal) | بلاغاته عادية |
| 41-60 | موثوق (Trusted) | بلاغاته تُؤخذ بجدية أعلى |
| 61-80 | موثوق جداً (Highly Trusted) | بلاغاته تلقائي تأكيد جزئي |
| 81-100 | موثوق بالكامل (Fully Trusted) | بلاغاته تلقائي تأكيد |

### دالة `recalculateTrustScore(userId)`

```typescript
// src/lib/reports/trust-score.ts
export async function recalculateTrustScore(userId: string): Promise<void>
```

تُستدعى عند:
- إنشاء بلاغ جديد (تحديث totalReports)
- تأكيد بلاغ (تحديث confirmedReports + score)
- رفض بلاغ (تحديث rejectedReports + score)
- حذف محتوى بسبب بلاغ (تحديث reportsReceivedConfirmed + score)

---

## 2. كشف البلاغات المزيفة (Fake Report Detection)

### نموذج قاعدة البيانات

```prisma
model ReportFraudSignal {
  id          String   @id @default(cuid())
  reportId    String
  report      Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  signalType  String   // duplicate_pattern | timing_anomaly | target_harassment | low_trust_reporter | same_target_swarm
  score       Float    // 0.0 - 1.0
  description String
  createdAt   DateTime @default(now())

  @@index([reportId])
  @@index([signalType])
}
```

### حقل إضافي على Report

```prisma
// إضافات على Report model
fraudScore       Float    @default(0)  // 0.0 - 1.0
repeatOffenseLevel Int    @default(0)  // 0-3 (للقسم 5)
```

### إشارات الكشف

| الإشارة | الشرح | النتيجة |
|---------|-------|---------|
| `low_trust_reporter` | نقاط ثقة المبلّغ < 20 | score: 0.8 |
| `duplicate_pattern` | المبلّغ بلّغ نفس الهدف 2+ مرات في 30 يوم | score: 0.9 |
| `target_harassment` | 3+ بلاغات مرفوضة ضد نفس الهدف في 30 يوم | score: 0.85 |
| `timing_anomaly` | 5+ بلاغات في 10 دقائق من نفس الـ IP | score: 0.7 |
| `same_target_swarm` | 3+ مبلّغين بلّغوا نفس الهدف في 24 ساعة | score: 0.6 |

### دالة `analyzeReportFraud(reportId)`

```typescript
// src/lib/reports/fraud-detection.ts
export async function analyzeReportFraud(reportId: string): Promise<void>
```

تُستدعى عند إنشاء بلاغ جديد. تنشئ إشارات + تحدّد `fraudScore` كـ average للإشارات.

**النتيجة:**
- `fraudScore >= 0.7` → البلاغ يُعلّم كـ "مشبوه" ويُراجع يدوياً
- `fraudScore >= 0.5` → البلاغ يُعلّم كـ "محتمل مزيف"

---

## 3. KPIs + إحصائيات

### API

```
GET /api/admin/reports/stats
```

**الاستجابة:**

```typescript
interface ReportStats {
  // إحصائيات أساسية
  total: number
  new: number
  underReview: number
  confirmed: number
  rejected: number
  resolved: number
  confirmationRate: number
  avgResolutionHours: number

  // تحليلات الأسباب
  topReasons: { reason: string; count: number }[]
  topTargets: { targetType: string; targetId: string; count: number }[]
  topReporters: { userId: string; count: number }[]

  // اتجاهات الوقت
  dailyTrend: { date: string; count: number }[]    // آخر 30 يوم
  weeklyTrend: { week: string; count: number }[]   // آخر 12 أسبوع
  monthlyTrend: { month: string; count: number }[]  // آخر 12 شهر

  // إحصائيات الإجراءات
  actionsTaken: { action: string; count: number }[]
  bannedUsers: number
  warnedUsers: number
  repeatOffenders: { userId: string; reportsReceived: number }[]
}
```

### واجهة المستخدم (Dashboard Updates)

**صفحة `/admin/reports` — تحديثات:**
- بطاقات KPIs في الأعلى (4 بطاقات: جديد/تحت المراجعة/مؤكدة/مرفوضة)
- رسم بياني خطي (Chart.js) لاتجاهات البلاغات الشهرية
- جدول أكثر الأسباب تكراراً
- جدول أكثر المبلّغين نشاطاً
- فلتر تاريخ جديد (من/إلى)

---

## 4. تصدير CSV

### API

```
GET /api/admin/reports/export?status=new&reason=spam&dateFrom=2026-01-01&dateTo=2026-07-21
```

**Headers:**
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="reports-YYYY-MM-DD.csv"`

**أعمدة CSV:**
```
ID,النوع,السبب,الأولوية,الحالة,المبلّغ,الهدف,تاريخ الإنشاء,تاريخ الحل,الإجراء المُتخذ
```

### واجهة المستخدم

- زر "تصدير CSV" في صفحة البلاغات الرئيسية
- يأخذ الفلاتر الحالية (status, reason, priority, date range)
- لا يحتاج مكتبة خارجية — CSV يُولّد يدوياً

---

## 5. التكرار التصاعدي المتقدم

### حقل جديد على Report

```prisma
repeatOffenseLevel Int @default(0)  // 0-3
```

### قواعد التصعيد

| Level | شرط | إجراء تلقائي |
|-------|------|-------------|
| 0 | 0-2 بلاغات مؤكدة ضدّ الهدف | لا شيء |
| 1 | 3-4 بلاغات مؤكدة ضدّ الهدف | تنبيه أدنى (notification) |
| 2 | 5-7 بلاغات مؤكدة ضدّ الهدف | حظر مؤقت تلقائي (7 أيام) |
| 3 | 8+ بلاغات مؤكدة ضدّ الهدف | حظر دائم تلقائي |

### دالة `updateRepeatOffenseLevel(targetUserId)`

```typescript
// src/lib/reports/repeat-offender.ts
export async function updateRepeatOffenseLevel(targetUserId: string): Promise<void>
```

تُستدعى عند تأكيد كل بلاغ. تعدد بلاغات المؤكدة ضدّ الهدف وتحدد Level.

### تكامل مع `executeAutoAction()`

في `auto-actions.ts`، عند تأكيد بلاغ:
1. تنفيذ الإجراء المُختار (warn/hide/delete/ban)
2. `updateRepeatOffenseLevel(targetUserId)` — تحديث مستوى التكرار
3. إذا Level تغيّر → تنفيذ إجراء تلقائي (تنبيه/حظر مؤقت/حظر دائم)

---

## 6. إشعارات البريد

### تحسينات `email-service.ts`

إضافة 3 functions جديدة:

```typescript
// إشعار للمبلّغ عند تأكيد بلاغه
export async function sendReportConfirmedEmail(
  reporterEmail: string,
  report: { reason: string; targetType: string }
): Promise<void>

// إشعار للمبلّغ عند رفض بلاغه
export async function sendReportRejectedEmail(
  reporterEmail: string,
  report: { reason: string; targetType: string; resolution?: string }
): Promise<void>

// إشعار للمستخدم عند اتخاذ إجراء ضدّه
export async function sendReportActionEmail(
  targetEmail: string,
  report: { reason: string; targetType: string },
  action: string
): Promise<void>
```

### التكامل

- `confirm/route.ts`: بعد `executeAutoAction()` → `sendReportConfirmedEmail()` + `sendReportActionEmail()`
- `reject/route.ts`: بعد الرفض → `sendReportRejectedEmail()`
- يُستخدم Resend الموجود بالفعل

---

## هيكل الملفات الجديدة

```
src/lib/reports/
  trust-score.ts        — recalculateTrustScore()
  fraud-detection.ts    — analyzeReportFraud()
  repeat-offender.ts    — updateRepeatOffenseLevel()

src/app/api/admin/reports/
  stats/route.ts        — GET /api/admin/reports/stats
  export/route.ts       — GET /api/admin/reports/export

src/lib/notifications/
  email-service.ts      — +3 functions جديدة
```

---

## ترتيب التنفيذ

1. **Schema**: إضافة UserTrustScore + ReportFraudSignal + حقول جديدة على Report
2. **Trust Score Engine**: `trust-score.ts`
3. **Fraud Detection**: `fraud-detection.ts`
4. **Repeat Offender**: `repeat-offender.ts`
5. **KPIs API**: `stats/route.ts`
6. **CSV Export**: `export/route.ts`
7. **Email Notifications**: تحسين `email-service.ts`
8. **Integration**: ربط كل شيء بـ `confirm/route.ts` و `reject/route.ts`
9. **Dashboard UI**: تحديث صفحة البلاغات الرئيسية
10. **Final Verification**: TypeScript check + test
