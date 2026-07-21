-- CreateTable
CREATE TABLE "UserTrustScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "reportAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "confirmedReports" INTEGER NOT NULL DEFAULT 0,
    "rejectedReports" INTEGER NOT NULL DEFAULT 0,
    "reportsReceived" INTEGER NOT NULL DEFAULT 0,
    "reportsReceivedConfirmed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFraudSignal" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFraudSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTrustScore_userId_key" ON "UserTrustScore"("userId");

-- CreateIndex
CREATE INDEX "UserTrustScore_userId_idx" ON "UserTrustScore"("userId");

-- CreateIndex
CREATE INDEX "UserTrustScore_score_idx" ON "UserTrustScore"("score");

-- CreateIndex
CREATE INDEX "ReportFraudSignal_reportId_idx" ON "ReportFraudSignal"("reportId");

-- CreateIndex
CREATE INDEX "ReportFraudSignal_signalType_idx" ON "ReportFraudSignal"("signalType");

-- AlterTable
ALTER TABLE "Report" ADD COLUMN "fraudScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "repeatOffenseLevel" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "UserTrustScore" ADD CONSTRAINT "UserTrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFraudSignal" ADD CONSTRAINT "ReportFraudSignal_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
