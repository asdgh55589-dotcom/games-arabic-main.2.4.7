# مركز السوشيال ميديا (Social Hub)

مركز موحّد لإدارة قنوات السوشيال ميديا من لوحة التحكم، بدءاً بمنصة **تيليجرام**
(النشطة حالياً)، مع مساحة محجوزة لفيسبوك ويوتيوب.

## الصفحات

| المسار | الوصف | الصلاحية الدنيا |
| --- | --- | --- |
| `/admin/social` | لمحة عامة: عدّادات، شبكة المنصات، المنشورات المجدولة والأخيرة | `admin` |
| `/admin/social/channels` | قائمة المنصات (مفعّل / قريباً) وزر الإدارة | `admin` |
| `/admin/social/telegram` | مركز تيليجرام: مؤشرات، مخطط النشر اليومي، الوجهات، روابط سريعة، **بطاقة صحة النشر** | `admin` |
| `/admin/publish/errors` | **مركز أخطاء النشر**: الأحداث غير المحلولة + «كيف أصلحه؟» + إعادة الوجهات الفاشلة + وضع علامة محلول | قراءة `admin` / كتابة `manager` |
| `/admin/publish/help` | **مساعدة النشر**: تُبنى تلقائياً من كتالوج الأخطاء (لا توثيق يدوي يتقادم) | `manager` |

> الصفحات أعلاه هي المسجّلة والمشحونة فعلاً في هذا الإصدار. صفحات
> `/admin/social/telegram/posts` (منشورات) و`/admin/social/telegram/templates`
> (قوالب) رتبتها `manager` وتُسجَّل في السجل مع هبوط مسارات العامل **W3** — لا
> نُسجّل صفحات ولا روابط قبل وجودها (لا روابط ميتة ولا منح صلاحية لصفحة مفقودة).

> عناصر التنقّل في الشريط الجانبي تتبع نفس الصلاحيات: صفحات اللمحة/المركز تظهر
> بوصف `adminOnly`، وتُضاف عناصر المنشورات/القوالب مع هبوط صفحاتها. لا صفحة أوسع من
> الـ API الذي تستهلكه.

> **قاعدة P3 — لا رابط لصفحة لا يستطيع المشاهد فتحها:** الروابط السريعة في
> `/admin/social/telegram` (رتبتها `admin`) تُعرض للوجهات التي يستطيع `admin`
> فتحها فقط: `/admin/notifications/history` و`/admin/scheduler` (كلتاهما `admin`).
> لا تُدرج روابط `manager` مثل `/admin/templates` أو صفحات منشورات/قوالب W3 في
> صفحة `adminOnly` — تجنّباً لوعد زائر الصفحة بصفحة سيرفضها الـ API بـ 403.

## الطبقة البيانية — `src/hooks/use-social.ts`

طبقة مشتركة (يستهلكها العامل W3 أيضاً) توحّد الجلب والأنواع:

- `useSocialOverview()` → `GET /api/admin/social/overview`
- `useSocialStats(range)` → `GET /api/admin/social/stats?platform=telegram&range=7d|30d|90d`
- `useSocialPosts(query)` / `useSocialPost(id)` / `useSocialPostTemplates(query)` — يستهلكها W3

> **مسار ↔ صفحة:** تتبع مسارات الـ API تدرّج الصفحات، لذا فإن المنشورات/القوالب
> تُبنى على `/api/admin/social/telegram/posts` و
> `/api/admin/social/telegram/templates` (لا `/api/admin/social/posts`) عبر
> `socialPostsUrl` / `socialPostUrl` / `socialTemplatesUrl` لتفادي الانحراف. هذا
> شرط لعمل حاجز claim الصفحات في `proxy.ts` عبر `apiPathToAdminPath` +
> `findPageForPath`: بمجرّد تسجيل W3 لصفحتي المنشورات/القوالب يُنسب المسار لمفتاح
> `social-telegram-posts` / `social-telegram-templates` (رتبة `manager`) بدل
> المفتاح العام `social` (رتبة `admin`). قبل التسجيل تُنسب لصفحة المركز
> `social-telegram` (أطول بادئة مسجّلة) وليس للجذر `social`.

### سلوك البيانات التجريبية

جرى تصميم الواجهة بحيث **لا تُحجب** إن لم تكن نقاط الـ API جاهزة على الخادم بعد:

- عند نجاح الطلب تُعرض البيانات الحقيقية.
- عند فشل الطلب (404/خطأ شبكة) تُعرض بيانات **تجريبية** مطابقة للعقد مع
  `isMock: true`، ويظهر شريط «بيانات تجريبية» أعلى الصفحة.
- فور جهوزية `src/lib/social/*` و`/api/admin/social/*` يتحوّل العرض للبيانات
  الحقيقية تلقائياً دون أي تغيير في الكود.

> ملاحظة للمطوّرين: سجل المنصات الرسمي هو `src/lib/social/platforms.ts`. ما دام لم
> يهبط، يبقى في `src/components/admin/social/platform-card.tsx` كائن عرض مطابق
> (`ADMIN_SOCIAL_PLATFORMS`)؛ عند هبوط السجل يكفي استبدال الاستيراد — لا يُلمَس المكوّن.

## مركز أخطاء النشر وصحة النشر (المرحلة 6)

### كتالوج الأخطاء — `src/lib/publish-errors.ts`

لكل رمز: `causeAr` (السبب بالعربية) + `fixAr` (الإصلاح خطوة بخطوة) + `retryable`.
ملف نقي بلا تبعيات Node، لذا يُستورد من مكوّنات العميل (محرّر المنشور، مركز
الأخطاء، صفحة المساعدة). القاعدة: **لا فشل بلا رمز** — الكتابة (zod)، التنفيذ
(إرسال تليجرام)، والإجراءات (جدولة/قديمة) كلها تُمرّر عبر `recordPublishError`
مع رمز من الكتالوج. تصنيف أخطاء تليجرام الخام يتم في `classifyTransportError`
(429 → `rate_limited`، chat not found → `chat_not_found`، parse → `parse_error`).

### حدث الخطأ — `PublishErrorEvent`

جدول `publish_error_events` (هجرة `20261017000002_phase6_publish_errors`، إضافة
خالصة): `code / scope / refId / message / causeAr / fixAr / retryable / attempt
/ notifiedAt / resolvedAt / resolvedBy`. `resolvedAt = null` تعني غير محلول،
و`resolvedBy = null` مع حلّ تعني **حلّ تلقائي عند النجاح**. الأحداث المكررة
(نفس الرمز/النطاق/المرجع خلال 30 دقيقة) تُدمج بلا صفوف مزدحمة. النص الخام
يُقنَّع قبل التخزين (`sanitizeMessage` — لا توكنات في القاعدة).

### مركز الأخطاء — `/admin/publish/errors`

- قائمة غير المحلول أولاً + عدّاد مختصر (المفتوح / آخر 24 ساعة) وفلاتر
  `status/scope/code`.
- زر **«كيف أصلحه؟»** يفتح الإرشاد (`causeAr` + `fixAr`) للصف.
- **«أعد الوجهات الفاشلة»** (`POST /api/admin/social/publish-errors/retry`,
  `requireManager`): يعيد تشغيل المحرّك المتعدد للمنشور — الأهداف المُرسَلة
  تُتخطى بفضل المطالبة الذرّية، والفاشلة فقط تُعاد. لا إعادة كتابة أي محتوى.
- **وضع علامة محلول** (`POST …/publish-errors/[id]/resolve`, `requireManager`)
  مع تدقيق `publish_error_resolve` (409 إن كان محلولاً مسبقاً).

### الإشعارات — عبر `NotificationService` القائم

| النوع | المستلم | القنوات | التوقيت |
| --- | --- | --- | --- |
| `social_publish_failed` | المؤلف + مدراء المحتوى (moderator+) | in-app + بريد | فشل نهائي (نضوب المحاولات أو فشل كل الأهداف) |
| `social_publish_succeeded` | المؤلف | in-app فقط (خفيف قابل للكتم) | اكتمال **كل** الأهداف |
| `publish_degraded` | مدراء المحتوى | in-app + بريد | 3 فشل مفتوحة متتالية على الكيان نفسه (نبضة واحدة لكل شريحة) |
| `publish_digest` | مدراء المحتوى | in-app + بريد | كرون دوري (يومي/أسبوعي) |

فشل الإشعار **محايد**: لا يكسر مسار النشر أبداً. نوافذ التكرار في
`deduplication-policy.ts` (فشل 30 د، تدهور 60 د، نجاح/تقرير بلا تكرار).
القوالب مسوَّرة لكل الأنواع الأربعة في `in_app` و`email` عبر
`prisma/seed-notification-templates.ts`.

### تقرير الصحة — `GET /api/admin/social/health` (`requireAdmin`)

حالة كل بوت/وجهة/قاعدة توجيه (أخضر/أحمر) = الحالة الساكنة + التسليمات الفاشلة
خلال 24 ساعة + عدّاد الأحداث المفتوحة؛ أي كيان عنده 3+ أحداث مفتوحة يُعرض
أحمر مهما كانت حالته الساكنة. تظهر الخلاصة في بطاقة «صحة النشر» أعلى
`/admin/social/telegram`.

### التقرير الدوري — `publish-digest`

`GET|POST /api/cron/publish-digest?type=daily|weekly` (محمي بـ `CRON_SECRET`):
يجمع التسليمات الناجحة/الفاشلة، الأرشيفات، والأحداث المفتوحة، ويرسل إشعاراً
واحداً لكل مدير محتوى. `claimRun('publish-digest:<type>', <window>)` يجعل
النداء المكرر لنفس النافذة `skipped: 'duplicate'`. انظر `docs/CRON-JOBS.md`.

### الاختبارات

- `src/lib/__tests__/publish-errors.test.ts` — كتالوج الأخطاء + مصنّفات التصنيف.
- `src/lib/social/__tests__/publish-error-events.test.ts` — التسجيل/التدهور/الحل.
- `src/app/api/admin/social/publish-errors/__tests__/route.test.ts` — الصلاحيات والفلاتر.
- `src/app/api/cron/publish-digest/__tests__/route.test.ts` — الكرون والـ idempotency.

## Rollout تدريجي (Phase 7)

**لا يوجد علم ميزة (feature flag):** الميزة *إضافية* بالكامل — الهجرة تُنشئ
جدولاً جديداً فقط، وأنواع الإشعارات جديدة، والمسارات الجديدة لا تُستدعى من
أي مسار قديم. بذلك لا بد من ترتيب الهجرة قبل الكود (يفعلها `build`:
`prisma migrate deploy` ثم `next build`).

خطوات الإطلاق:

1. **الهجرة أولاً:** `prisma migrate deploy` (تُنفَّذ في `bun run build`) —
   تتحقق من سلامة `20261017000002_phase6_publish_errors`.
2. **بذر القوالب:** `npx tsx prisma/seed-notification-templates.ts` — بدونه لا
   تُعرض نصوص الإشعارات الأربعة الجديدة (إشعار بلا نص = بلا قيمة).
3. **تنسيق الكرون:** أضف `publish-digest?type=daily` و`?type=weekly` إلى
   المُجدِّل الخارجي (vercel.json لا يحتوي `crons` — انظر CRON-JOBS.md).
4. **بوابات القراءة/الكتابة:** مركز الأخطاء للقراءة `admin`؛ الإعادة/الحل
   `manager`؛ الصحة `admin`. لا منح صلاحية أوسع من الـ API.
5. **مراقبة أول 24 ساعة:** راقب `/admin/publish/errors` (معدل الأحداث المفتوحة)
   وبطاقة «صحة النشر». صفر أحداث مفتوحة + كل شيء أخضر = الإطلاق مستقر.

**قابلية التراجع (Rollback):** الهجرة إضافية خالصة (لا تعديل/حذف). التراجع عن
الكوميت يُلغي الكود وواجهات الاستخدام، ويبقى الجدول معطلاً بلا كسر. لا تُحذف
الأحداث السابقة — تُصبح غير مقروءة مؤقتاً فقط إن أُلغي التمرير.

**معايير القبول المحقَّقة:** كل فشل نشر له رمز + سبب + إصلاح + إشعار، صفر
`alert()` في مسارات النشر (إرشاد منظّم في محرّر المنشور وجدولة الأدمن)،
وبوابات CI خضراء (tsc الكامل + jest + biome على الملفات المتغيّرة).

## الربط العميق من سجل الإشعارات

صفحة `/admin/notifications/history` تقرأ المعامل `?channel=` **كمُهيّئ أولي فقط**:

- `/admin/notifications/history?channel=telegram` تفتح السجل مع تحديد قناة تيليجرام
  وتُدرجها في أول طلب.
- تغييرات المرشّح اللاحقة لا تُعيد كتابة الرابط.
- أي قيمة قناة غير معروفة تُتجاهل بهدوء (بدون فلترة).

## المنصات

| المنصة | الحالة | ملاحظات |
| --- | --- | --- |
| تيليجرام | مفعّل | منشورات + قوالب + إشعارات + جدولة |
| فيسبوك | قريباً | زر الإدارة معطّل بلا رابط (لا روابط ميتة) |
| يوتيوب | قريباً | زر الإدارة معطّل بلا رابط (لا روابط ميتة) |

## الاختبارات

- `src/__tests__/admin-pages-social.test.ts` — تسجيل الصفحات والصلاحيات.
- `src/__tests__/social-platform-card.test.ts` — مرآة المنصات ومنع الروابط الميتة.
- `src/__tests__/use-social.test.ts` — شكل البيانات التجريبية.
- `src/__tests__/social-hub-pages.test.tsx` — عقد الصفحات مع الخادم وسلوك `isMock`.
- `src/__tests__/notifications-history-page.test.tsx` — تهيئة مرشّح `?channel=`.

تشغيلها: `npx jest <المسار>`.
