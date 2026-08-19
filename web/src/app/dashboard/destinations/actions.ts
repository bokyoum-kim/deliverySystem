"use server";

import { getTenantDb } from "@/lib/tenant-db";
import { revalidatePath } from "next/cache";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function createWarehouse(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return;

  const db = await getTenantDb();
  await db.warehouse.create({
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
  const db = await getTenantDb();
  await db.warehouse.delete({ where: { id } });
  revalidatePath("/dashboard/destinations");
}
