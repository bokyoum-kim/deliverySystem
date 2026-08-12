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

export async function createBoxSpec(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return;

  await prisma.boxSpec.create({
    data: {
      name,
      lengthMm: num(formData.get("lengthMm"), 500),
      widthMm: num(formData.get("widthMm"), 300),
      heightMm: num(formData.get("heightMm"), 400),
      maxWeightG: num(formData.get("maxWeightG"), 10000),
      stockQty: num(formData.get("stockQty"), 0),
    },
  });

  revalidatePath("/dashboard/boxes");
}

export async function updateBoxSpec(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;

  await prisma.boxSpec.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      lengthMm: num(formData.get("lengthMm")),
      widthMm: num(formData.get("widthMm")),
      heightMm: num(formData.get("heightMm")),
      maxWeightG: num(formData.get("maxWeightG")),
      stockQty: num(formData.get("stockQty")),
    },
  });

  revalidatePath("/dashboard/boxes");
}

export async function deleteBoxSpec(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await prisma.boxSpec.delete({ where: { id } });
  revalidatePath("/dashboard/boxes");
}
