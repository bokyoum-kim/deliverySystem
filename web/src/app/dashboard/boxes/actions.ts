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

export async function deleteBoxSpec(formData: FormData): Promise<{ error?: string; archived?: boolean }> {
  const id = str(formData.get("id"));
  if (!id) return {};

  const usedCount = await prisma.box.count({ where: { boxSpecId: id } });
  if (usedCount > 0) {
    // 과거 패킹 이력(박스 내역)이 이 박스종류를 참조하고 있어 완전히 지우면 그 기록이 깨진다.
    // 화면·선택 목록에서만 숨기고(보관 처리) DB에서는 남겨 이력을 보존한다.
    await prisma.boxSpec.update({ where: { id }, data: { archived: true } });
    revalidatePath("/dashboard/boxes");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard");
    return { archived: true };
  }

  await prisma.boxSpec.delete({ where: { id } });
  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return {};
}
