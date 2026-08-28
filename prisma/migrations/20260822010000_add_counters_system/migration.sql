-- نظام العدادات المحصّنة: مشاهدات التعريبات + عداد ملف الفريق
-- تنفيذ يدوي آمن: إضافي بالكامل (لا يعدل أعمدة موجودة)

-- AlterTable: عداد مشاهدات صفحة الفريق
ALTER TABLE "Team" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: سجل المشاهدات الفريدة (بعد dedup عبر Redis)
CREATE TABLE "ModView" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModView_modId_idx" ON "ModView"("modId");
CREATE INDEX "ModView_userId_idx" ON "ModView"("userId");
CREATE INDEX "ModView_viewedAt_idx" ON "ModView"("viewedAt");

-- AddForeignKey
ALTER TABLE "ModView" ADD CONSTRAINT "ModView_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModView" ADD CONSTRAINT "ModView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: فرز الفرق حسب المشاهدات (Leaderboard)
CREATE INDEX "Team_views_idx" ON "Team"("views");
