-- CreateTable
CREATE TABLE "StaffPageAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPageAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPageAccess_userId_page_key" ON "StaffPageAccess"("userId", "page");

-- CreateIndex
CREATE INDEX "StaffPageAccess_userId_idx" ON "StaffPageAccess"("userId");

-- AddForeignKey
ALTER TABLE "StaffPageAccess" ADD CONSTRAINT "StaffPageAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
