-- DropForeignKey
ALTER TABLE "OrderBatch" DROP CONSTRAINT "OrderBatch_createdById_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_schemaName_key" ON "Company"("schemaName");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
-- companyId가 NULL인 SUPERADMIN 계정끼리는 위 복합 유니크 인덱스로 이메일 중복이 안 걸러진다
-- (Postgres는 NULL을 서로 다른 값으로 취급하므로). 부분 유니크 인덱스로 별도 보강.
CREATE UNIQUE INDEX "User_superadmin_email_key" ON "User"("email") WHERE "companyId" IS NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
