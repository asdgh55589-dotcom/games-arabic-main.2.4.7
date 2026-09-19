-- CreateTable
CREATE TABLE "ModChangelog" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'edit',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "changedById" TEXT NOT NULL,
    "changedByRole" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModChangelog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModChangelog_modId_idx" ON "ModChangelog"("modId");

-- CreateIndex
CREATE INDEX "ModChangelog_modId_createdAt_idx" ON "ModChangelog"("modId", "createdAt");

-- AddForeignKey
ALTER TABLE "ModChangelog" ADD CONSTRAINT "ModChangelog_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModChangelog" ADD CONSTRAINT "ModChangelog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
