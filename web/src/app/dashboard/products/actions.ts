"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function num(v: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function createProduct(formData: FormData) {
  const code = str(formData.get("code"));
  if (!code) return;

  await prisma.product.create({
    data: {
      code,
      barcode: str(formData.get("barcode")) || null,
      name: str(formData.get("name")) || code,
      weightG: num(formData.get("weightG"), 15),
      lengthMm: num(formData.get("lengthMm"), 150),
      widthMm: num(formData.get("widthMm"), 90),
      heightMm: num(formData.get("heightMm"), 20),
      price: num(formData.get("price"), 0),
      stock: { create: { quantity: num(formData.get("stock"), 0) } },
    },
  });

  revalidatePath("/dashboard/products");
}

export async function updateProduct(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;

  await prisma.product.update({
    where: { id },
    data: {
      barcode: str(formData.get("barcode")) || null,
      name: str(formData.get("name")),
      weightG: num(formData.get("weightG")),
      lengthMm: num(formData.get("lengthMm")),
      widthMm: num(formData.get("widthMm")),
      heightMm: num(formData.get("heightMm")),
      price: num(formData.get("price")),
      status: formData.get("discontinued") === "on" ? "DISCONTINUED" : "ACTIVE",
      stock: {
        upsert: {
          create: { quantity: num(formData.get("stock"), 0) },
          update: { quantity: num(formData.get("stock"), 0) },
        },
      },
    },
  });

  revalidatePath("/dashboard/products");
}

export async function deleteProduct(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await prisma.product.delete({ where: { id } });
  revalidatePath("/dashboard/products");
}
