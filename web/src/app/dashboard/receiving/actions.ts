"use server";

import { prisma } from "@/lib/prisma";
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

  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.status !== "PENDING") return;

  await prisma.$transaction([
    prisma.stock.update({ where: { productId: po.productId }, data: { quantity: { increment: qty } } }),
    prisma.purchaseOrder.update({ where: { id }, data: { receivedQty: qty, status: "RECEIVED" } }),
  ]);

  revalidatePath("/dashboard/receiving");
  revalidatePath("/dashboard");
}

export async function undoReceiving(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;

  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.status !== "RECEIVED") return;

  await prisma.$transaction([
    prisma.stock.update({ where: { productId: po.productId }, data: { quantity: { decrement: po.receivedQty } } }),
    prisma.purchaseOrder.update({ where: { id }, data: { receivedQty: 0, status: "PENDING" } }),
  ]);

  revalidatePath("/dashboard/receiving");
  revalidatePath("/dashboard");
}

export async function reflectPurchaseBatch(formData: FormData) {
  const batchId = str(formData.get("batchId"));
  if (!batchId) return;
  await prisma.purchaseOrder.updateMany({
    where: { batchId },
    data: { status: "REFLECTED" },
  });
  revalidatePath("/dashboard/receiving");
}
