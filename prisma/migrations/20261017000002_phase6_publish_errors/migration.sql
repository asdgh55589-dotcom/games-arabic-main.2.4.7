-- Phase 6 — مركز أخطاء النشر (additive: جدول جديد فقط)
-- نطاقات الكتالوج: post | route | bot | destination | schedule.
-- resolvedAt null = غير محلول؛ resolvedBy null = حل تلقائي عند نجاح النشر.
CREATE TABLE "publish_error_events" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ref_id" TEXT,
    "message" TEXT,
    "cause_ar" TEXT NOT NULL,
    "fix_ar" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "notified_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_error_events_pkey" PRIMARY KEY ("id")
);

-- Indexes: قائمة غير المحلول + التقرير الدوري، نطاق/مرجع الكيان، ورمز الكتالوج.
CREATE INDEX "publish_error_events_resolved_at_created_at_idx" ON "publish_error_events"("resolved_at", "created_at");
CREATE INDEX "publish_error_events_scope_ref_id_idx" ON "publish_error_events"("scope", "ref_id");
CREATE INDEX "publish_error_events_code_idx" ON "publish_error_events"("code");
