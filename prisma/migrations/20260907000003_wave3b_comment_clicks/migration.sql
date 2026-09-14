-- CreateTable
CREATE TABLE "CommentSectionClick" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentSectionClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentSectionClick_modId_idx" ON "CommentSectionClick"("modId");

-- CreateIndex
CREATE INDEX "CommentSectionClick_modId_createdAt_idx" ON "CommentSectionClick"("modId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommentSectionClick" ADD CONSTRAINT "CommentSectionClick_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentSectionClick" ADD CONSTRAINT "CommentSectionClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
