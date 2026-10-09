-- Telegram Rich-Text — المرحلة 1: الحفظ فقط (قوالب + نسخ + وجهات + دفعات).
--
-- النطاق: أعمدة/جداول جديدة فقط. لا إرسال، لا واجهة، لا CI، ولا أي تغيير
-- على security (ملفات المصادقة/الحماية غير ملمسة)، والبث يبقى manager-only
-- عبر /api/admin/notifications/send (requireManager)، وميزات الدفع تبقى
-- معطّلة، والنصوص القديمة في lib/telegram-templates.ts و
-- lib/telegram-notifications.ts لم تُمسّ.
--
-- التحقق: prisma validate + prisma migrate diff --from-empty
--         --to-schema-datamodel (تطابق أعمدة/فهارس/قيود مع schema.prisma).
-- checklist prisma/migrations/README.md: additive-only — لا يُحذف جدول أو
-- عمود أو فهرس، وفهارس trgm الستة (GIN) تبقى كما هي دون أي مساس.

-- 1) notification_templates — أعمدة النص الغني. bodyTemplate/titleTemplate
--    القدامى لا يُعدَّلون إطلاقاً: parseMode NULL يعني القالب العادي القديم.
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "parseMode" TEXT;
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "richBodyTemplate" TEXT;

-- 2) notification_jobs — ربط الوجهة ووضع التنسيق المحجوز ودفعة البث.
ALTER TABLE "notification_jobs" ADD COLUMN IF NOT EXISTS "destination_id" TEXT;
ALTER TABLE "notification_jobs" ADD COLUMN IF NOT EXISTS "parse_mode" TEXT;
ALTER TABLE "notification_jobs" ADD COLUMN IF NOT EXISTS "batch_id" TEXT;

-- 3) الجداول الجديدة: أرشيف نسخ القوالب، وجهات Telegram، دفعات البث.

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title_template" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "rich_body_template" TEXT,
    "parse_mode" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "changed_by" TEXT,
    "change_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "telegram_destinations" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "chat_type" TEXT NOT NULL DEFAULT 'unknown',
    "username" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verification_status" TEXT NOT NULL DEFAULT 'unverified',
    "verification_method" TEXT,
    "verification_token" TEXT,
    "verification_token_used_at" TIMESTAMP(3),
    "verification_checked_at" TIMESTAMP(3),
    "last_verification_error" TEXT,
    "verified_at" TIMESTAMP(3),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "added_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_batches" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'broadcast',
    "type" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "parse_mode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" TEXT,
    "total_jobs" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_jobs_destination_id_idx" ON "notification_jobs"("destination_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_jobs_batch_id_idx" ON "notification_jobs"("batch_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_template_versions_type_channel_idx" ON "notification_template_versions"("type", "channel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_template_versions_created_at_idx" ON "notification_template_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_template_versions_template_id_version_key" ON "notification_template_versions"("template_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_destinations_chat_id_key" ON "telegram_destinations"("chat_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "telegram_destinations_status_verification_status_idx" ON "telegram_destinations"("status", "verification_status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "telegram_destinations_chat_type_idx" ON "telegram_destinations"("chat_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "telegram_destinations_created_at_idx" ON "telegram_destinations"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_batches_status_created_at_idx" ON "notification_batches"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_batches_type_idx" ON "notification_batches"("type");

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "telegram_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "notification_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
