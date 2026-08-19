import type { PrismaClient } from "@prisma/client";

export async function getDefaultCap(db: PrismaClient): Promise<number> {
  const s = await db.appSettings.findUnique({ where: { id: "singleton" } });
  return s?.defaultCap ?? 100;
}
