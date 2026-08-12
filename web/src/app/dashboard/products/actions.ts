"use server";

import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { normHeader, findCol, parseNum, boolish } from "@/lib/xlsx-common";

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

export async function bulkUpsertProducts(
  formData: FormData
): Promise<{ error?: string; added?: number; updated?: number }> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "파일을 선택하세요." };

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheetName = wb.SheetNames.includes("ProductInfo") ? "ProductInfo" : wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][];
  if (!aoa.length) return { error: "시트에서 데이터를 찾지 못했습니다." };

  const headers = (aoa[0] as unknown[]).map(normHeader);
  const ic = {
    code: findCol(headers, ["상품번호"]),
    bc: findCol(headers, ["바코드"]),
    name: findCol(headers, ["상품명", "상품이름"]),
    w: findCol(headers, ["무게"]),
    L: findCol(headers, ["가로"]),
    W: findCol(headers, ["세로"]),
    H: findCol(headers, ["높이"]),
    price: findCol(headers, ["가격", "단가"]),
    stock: findCol(headers, ["재고", "기초수량", "수량"]),
    hold: findCol(headers, ["단종", "Hold"]),
  };
  if (ic.code < 0) return { error: "상품번호 컬럼을 찾지 못했습니다." };

  let added = 0;
  let updated = 0;
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    const code = String(row[ic.code] ?? "").trim();
    if (!code) continue;

    const patch: Record<string, unknown> = {};
    if (ic.bc > -1) patch.barcode = String(row[ic.bc] ?? "").trim() || null;
    if (ic.name > -1) {
      const n = String(row[ic.name] ?? "").trim();
      if (n) patch.name = n;
    }
    if (ic.w > -1) patch.weightG = parseNum(row[ic.w]);
    if (ic.L > -1) patch.lengthMm = parseNum(row[ic.L]);
    if (ic.W > -1) patch.widthMm = parseNum(row[ic.W]);
    if (ic.H > -1) patch.heightMm = parseNum(row[ic.H]);
    if (ic.price > -1) patch.price = parseNum(row[ic.price]);
    if (ic.hold > -1) patch.status = boolish(row[ic.hold]) ? "DISCONTINUED" : "ACTIVE";
    const stockQty = ic.stock > -1 ? parseNum(row[ic.stock]) : null;

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) {
      await prisma.product.update({
        where: { code },
        data: {
          ...patch,
          ...(stockQty != null
            ? { stock: { upsert: { create: { quantity: stockQty }, update: { quantity: stockQty } } } }
            : {}),
        },
      });
      updated++;
    } else {
      await prisma.product.create({
        data: {
          code,
          barcode: (patch.barcode as string | null) ?? null,
          name: (patch.name as string) || code,
          weightG: (patch.weightG as number) ?? 15,
          lengthMm: (patch.lengthMm as number) ?? 150,
          widthMm: (patch.widthMm as number) ?? 90,
          heightMm: (patch.heightMm as number) ?? 20,
          price: (patch.price as number) ?? 0,
          status: (patch.status as string) ?? "ACTIVE",
          stock: { create: { quantity: stockQty ?? 0 } },
        },
      });
      added++;
    }
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  return { added, updated };
}
