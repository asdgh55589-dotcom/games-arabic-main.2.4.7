-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Monitor',
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadClick" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "fileId" TEXT,
    "linkId" TEXT,
    "linkUrl" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Section_slug_key" ON "Section"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Section_key_key" ON "Section"("key");

-- CreateIndex
CREATE INDEX "Section_isActive_order_idx" ON "Section"("isActive", "order");

-- CreateIndex
CREATE INDEX "DownloadClick_modId_idx" ON "DownloadClick"("modId");

-- CreateIndex
CREATE INDEX "DownloadClick_createdAt_idx" ON "DownloadClick"("createdAt");

-- AddForeignKey
ALTER TABLE "DownloadClick" ADD CONSTRAINT "DownloadClick_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddColumn (nullable, backward-compatible)
ALTER TABLE "Mod" ADD COLUMN "sectionId" TEXT;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- CreateIndex
CREATE INDEX "Mod_sectionId_idx" ON "Mod"("sectionId");

-- SeedData: Insert the 7 existing platforms
INSERT INTO "Section" ("id", "slug", "name", "nameEn", "key", "icon", "color", "order", "isActive", "createdAt", "updatedAt") VALUES
('sec_pc', 'pc', 'PC ARABIC', 'PC Arabic', 'PC', 'PcIcon', '#66c0f4', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sec_x360', 'xbox-360', 'XBOX 360 ARABIC', 'Xbox 360 Arabic', 'X360', 'Xbox360Icon', '#107C10', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sec_ns', 'ns', 'NS ARABIC', 'NS Arabic', 'NS', 'NintendoSwitchIcon', '#E60012', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sec_ps4', 'ps4', 'PS4 ARABIC', 'PS4 Arabic', 'PS4', 'PlayStationIcon', '#0070D1', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sec_ps3', 'ps3', 'PS3 ARABIC', 'PS3 Arabic', 'PS3', 'PlayStationIcon', '#06b6d4', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sec_ps2', 'ps2', 'PS2 ARABIC', 'PS2 Arabic', 'PS2', 'PlayStationIcon', '#6366f1', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sec_ps1', 'ps1', 'PS1 ARABIC', 'PS1 Arabic', 'PS1', 'PlayStationIcon', '#94a3b8', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
