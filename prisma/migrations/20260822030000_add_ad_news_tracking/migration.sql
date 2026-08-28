-- تتبع النقرات للإعلانات والإحصائيات للأخبار

-- AlterTable: إضافة عداد النقرات للإعلانات
ALTER TABLE "HomepageAd" ADD COLUMN "clicksCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "HomepageAd_clicksCount_idx" ON "HomepageAd"("clicksCount");

-- AlterTable: إضافة عداد النقرات للأخبار
ALTER TABLE "News" ADD COLUMN "clicksCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "News_clicksCount_idx" ON "News"("clicksCount");

-- CreateTable: نقرات الإعلانات
CREATE TABLE "AdClick" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdClick_adId_idx" ON "AdClick"("adId");
CREATE INDEX "AdClick_clickedAt_idx" ON "AdClick"("clickedAt");
CREATE INDEX "AdClick_userId_idx" ON "AdClick"("userId");
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_adId_fkey" FOREIGN KEY ("adId") REFERENCES "HomepageAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: مشاهدات الأخبار
CREATE TABLE "NewsView" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NewsView_newsId_idx" ON "NewsView"("newsId");
CREATE INDEX "NewsView_viewedAt_idx" ON "NewsView"("viewedAt");
CREATE INDEX "NewsView_userId_idx" ON "NewsView"("userId");
ALTER TABLE "NewsView" ADD CONSTRAINT "NewsView_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsView" ADD CONSTRAINT "NewsView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: نقرات الأخبار
CREATE TABLE "NewsClick" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NewsClick_newsId_idx" ON "NewsClick"("newsId");
CREATE INDEX "NewsClick_clickedAt_idx" ON "NewsClick"("clickedAt");
CREATE INDEX "NewsClick_userId_idx" ON "NewsClick"("userId");
ALTER TABLE "NewsClick" ADD CONSTRAINT "NewsClick_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsClick" ADD CONSTRAINT "NewsClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
