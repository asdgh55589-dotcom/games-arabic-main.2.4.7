# Notifications Operations Runbook (P5)

دليل التشغيل لمسارات الإشعارات: البوابة الرقمية، التنظيف والاحتفاظ، والمراقبة.
كل خطوة هنا قابلة للتنفيذ على environments الإنتاج دون تعديل كود.

---

## 1) بوابة الجودة (CI)

- Workflow: `.github/workflows/notifications.yml`
- يعمل على `pull_request` و`push` إلى `main`، لكنه **مقيَّد بـ `paths`** فلا
  يُستدعى من تغييرات لا تمسّ الإشعارات.
- الخطوات: `bun install --frozen-lockfile` ← `prisma generate` (عنوان افتراضي،
  لا يتصل بالخادم) ← اختبارات مسارات الإشعارات ← `bun run typecheck` ←
  `biome check` على **الملفات التي غيّرها الـ PR فقط** (محسوبة من merge-base).
- **لماذا biome محدود بملفات الـ PR؟** فحص المجلدات كاملة يوقف البناء بسبب
  ديون تنسيق سابقة في `src/lib/notifications/service.ts` و`email-service.ts` و
  `analytics/route.ts` — خارج نطاق P5 ولا يجوز إصلاحها هنا. تتبّع تلك الديون
  مهمة منفصلة؛ حتى ذلك الحين لا تتحوّل هذه البوابة إلى حاصر للفرع.
- **حالياً لا يمنع الدمج**: الـ job يُبلّغ عن الفشل فقط. الترقية إلى gate صارم
  قرار منفصل بعد استقرار المجموعة.
- التشغيل يدوياً محلياً:

```bash
bun install --frozen-lockfile
npx jest --ci --silent \
  src/app/api/admin/notifications \
  src/app/api/admin/notifications-health \
  src/app/api/admin/templates \
  src/app/api/admin/scheduler \
  src/app/api/cron/notification-cleanup \
  src/__tests__/notifications
bun run typecheck
bunx biome check $(git diff --name-only --diff-filter=ACMR \
  "$(git merge-base HEAD origin/main)" -- 'src/**/*.ts' 'src/**/*.tsx')
```

---

## 2) تنظيف والاحتفاظ (retention)

المسار: `GET /api/cron/notification-cleanup`

| البند | القيمة |
| --- | --- |
| نافذة `NotificationLog` | `retentionDays` = 90 يوماً (على `createdAt`) |
| نافذة `NotificationJob` | `jobRetentionDays` = 30 يوماً (على `updatedAt`) |
| حجم الدفعة | 500 صف |
| سقف الدفعات لكل جدول لكل تشغيل | 40 دفعة (= 20,000 صف كحد أقصى) |
| المصادقة | `Authorization: Bearer $CRON_SECRET` |

سلوك مذكور صراحةً:

- **`dead_letter` لا يُستثنى.** مهامщение الخطر تُحذف بعد 30 يوماً من آخر تحديث،
  فنافذة إعادة الإرسال اليدوي عبر `/api/admin/notifications/retry` محدودة بـ 30
  يوماً. إن أردت تمديد الأدلة، غيّر سياسة الاحتفاظ — لا هذا المسار.
- **`truncated: true`** يعني بلوغ السقف: صفوف أقدم من الحد ما زالت موجودة.
  **شغّل المسار مرة ثانية** حتى ينتهي (`truncated: false`).
- الحذف على دفعات ومقيّد بالمعرّفات المقروءة في نفس التشغيل، فلا يلمس صفاً
  ظهر بعد القراءة.

مثال:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://<host>/api/cron/notification-cleanup | jq
```

---

## 3) جدولة الـ cron (إجراء مشغّل — خارج المستودع)

لا يوجد `vercel.json` في المشروع، فلم يُضَف بناءً على طلب P5. الجدولة تُسجَّل
خارج المستودع عبر مزوّد النشر:

- **Vercel**: Project Settings → Cron Jobs → `GET /api/cron/notification-cleanup`
  بمجدولة يومية، مع Bearer secret مطابق لـ `CRON_SECRET`.
- **خادم ذاتي الاستضافة**: crontab، مثال: `17 3 * * * curl -fsS -H "Authorization:
  Bearer $CRON_SECRET" https://<host>/api/cron/notification-cleanup`.
- **خارجي (GitHub Actions / Cloud Scheduler / أي orchestrator)**: نفس الـ URL مع
  ترويسة الـ Bearer.

الفحص الذاتي: استدعِ المسار يدوياً مرّتين متتاليتين — الأولى يجب أن تُظهر الحذف،
والثانية `deleted: 0` لكلا الجدولين.

---

## 4) التنبيه (dead-letter + error-rate)

المقيّم: `src/infrastructure/observability/alerts.ts` — يُستدعى من مسار التنظيف
نفسه (لا يوجد عامل منفصل).

| التنبيه | الشرط | العتبة الافتراضية |
| --- | --- | --- |
| `dead_letter_threshold` | عدد مهام `dead_letter` بعد الجرف | `10` |
| `notification_failure_rate` | نسبة الفشل في آخر 24 ساعة | `0.2` مع `minSampleSize` = 20 |

- كل تنبيه له **تبريد 5 دقائق** (`cooldownMs: 300_000`) — تكرار التشغيل اليومي
  لا يُنتج بريداً مكرراً.
- `error_rate` لا يُطلق قبل `minSampleSize` عيّنة: 3 إخفاقات من 5 ليست «60%».
- التسليم عبر `ALERT_WEBHOOK_URL` بمهلة 5 ثوانٍ. **إن كان المتغيّر غير مضبوط —
  وهو الافتراضي — فالتنبيه صامت تماماً**؛ المسار لا يفشل ولا يُبطئ.
- أي خطأ في التسليم (شبكة، webhook غير 2xx، أو فشل حساب عدّاد) يُبتلع ويُسجَّل
  فقط: استجابة التنظيف تبقى `200`.
- طريقة العرض: `src/app/api/admin/notifications-health` يعرض
  `recentFailures`، وعدّاد `deadLetterJobs`.

---

## 5) حدود معروفة (P5 لم يغيّرها)

1. **عامل الطابور غير مدمج.** `processNotificationQueue()` بلا مستدعٍ،
   `DeadLetterHandler` غير مُنشأ، ومقاييس `metricsService` غير موصولة — كلها في
   نطاق P2 المتوقّع. لذلك: **لا فشل يمكن بهذه المسارات أن يُعيد محاولة**، و
   `notifications-health` يعرض `recentFailures` من جدول المهام فقط.
2. **حالات المصادقة ترجع 500 في بعض المسارات.** `POST
   /api/admin/templates/[id]/preview` مثلاً يلتقط الخطأ دون فحص `status`، فيرد
   خطأ 403 أو 401 كـ 500. مُغطّى باختبار يحمل وسم «known gap»؛ الإصلاح تغيير
   في مسار P2 وليس في P5.
3. **الجدولة غير مسجّلة.** ما لم ينفّذ المشغّل الخطوة 3، لا يحدث تنظيف ولا
   تنبيه — المسارات موجودة وجاهزة فقط.

---

## 6) قائمة تحقق بعد كل تغيير في الإشعارات

- [ ] `npx jest` على المسارات الستة أعلاه ينجح.
- [ ] `bun run typecheck` ينجح.
- [ ] `biome check` على مجلدات الإشعارات ينجح.
- [ ] مسارات القائمة (الرسائل، health، scheduler، templates) لم تُعدّل صدفةً:
      `git diff --stat src/app/admin`
- [ ] أي تسريب بيانات في التسجيل لا يحتوي معرّفات مستخدمين أو محتوى إشعار.