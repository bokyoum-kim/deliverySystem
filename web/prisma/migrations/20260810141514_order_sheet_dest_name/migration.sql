/*
  Warnings:

  - Added the required column `destName` to the `OrderSheet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderSheet" ADD COLUMN     "destName" TEXT NOT NULL;
