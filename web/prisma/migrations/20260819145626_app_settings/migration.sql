-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultCap" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
