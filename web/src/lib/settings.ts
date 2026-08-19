import { prisma } from "@/lib/prisma";

export async function getDefaultCap(): Promise<number> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return s?.defaultCap ?? 100;
}
