-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropTable
DROP TABLE "account";

-- DropTable
DROP TABLE "verification";
