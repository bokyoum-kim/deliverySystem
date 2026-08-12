"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function createWarehouse(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return;

  await prisma.warehouse.create({
    data: {
      code: name,
      name,
      region: str(formData.get("region")) || null,
      area: str(formData.get("area")) || null,
      address: str(formData.get("address")) || null,
    },
  });

  revalidatePath("/dashboard/destinations");
}

export async function deleteWarehouse(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await prisma.warehouse.delete({ where: { id } });
  revalidatePath("/dashboard/destinations");
}
