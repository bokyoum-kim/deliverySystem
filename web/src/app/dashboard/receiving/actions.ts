"use server";

import { getTenantDb } from "@/lib/tenant-db";
import { revalidatePath } from "next/cache";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function num(v: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function applyReceiving(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  const qty = Math.max(0, num(formData.get("qty")));

  const db = await getTenantDb();
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.status !== "PENDING") return;

  await db.$transaction([
    db.stock.update({ where: { productId: po.productId }, data: { quantity: { increment: qty } } }),
    db.purchaseOrder.update({ where: { id }, data: { receivedQty: qty, status: "RECEIVED" } }),
  ]);

  revalidatePath("/dashboard/receiving");
  revalidatePath("/dashboard");
}

export async function undoReceiving(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;

  const db = await getTenantDb();
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.status !== "RECEIVED") return;

  await db.$transaction([
    db.stock.update({ where: { productId: po.productId }, data: { quantity: { decrement: po.receivedQty } } }),
    db.purchaseOrder.update({ where: { id }, data: { receivedQty: 0, status: "PENDING" } }),
  ]);

  revalidatePath("/dashboard/receiving");
  revalidatePath("/dashboard");
}

export async function reflectPurchaseBatch(formData: FormData) {
  const batchId = str(formData.get("batchId"));
  if (!batchId) return;
  const db = await getTenantDb();
  await db.purchaseOrder.updateMany({
    where: { batchId },
    data: { status: "REFLECTED" },
  });
  revalidatePath("/dashboard/receiving");
}
