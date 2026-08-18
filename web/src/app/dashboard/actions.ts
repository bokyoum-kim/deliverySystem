"use server";

import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { normHeader, findCol, parseNum } from "@/lib/xlsx-common";

function sheetAoa(wb: XLSX.WorkBook, names: string[]): unknown[][] | null {
  for (const n of names) {
    if (wb.SheetNames.includes(n)) {
      return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" }) as unknown[][];
    }
  }
  return null;
}

export async function bulkUpdateStock(formData: FormData): Promise<{ error?: string; added?: number; updated?: number }> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "파일을 선택하세요." };

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheetName = wb.SheetNames.includes("InStock") ? "InStock" : wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][];
  if (!aoa.length) return { error: "시트에서 데이터를 찾지 못했습니다." };

  const headers = (aoa[0] as unknown[]).map(normHeader);
  const ic = {
    code: findCol(headers, ["상품번호"]),
    qty: findCol(headers, ["재고수량", "기초수량", "재고", "수량"]),
    name: findCol(headers, ["상품명", "상품이름"]),
  };
  if (ic.code < 0 || ic.qty < 0) return { error: "필수 컬럼(상품번호·재고수량)을 찾지 못했습니다." };

  let added = 0;
  let updated = 0;
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    const code = String(row[ic.code] ?? "").trim();
    if (!code) continue;
    const qty = Math.max(0, parseNum(row[ic.qty]));
    const name = ic.name > -1 ? String(row[ic.name] ?? "").trim() : "";

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) {
      await prisma.stock.upsert({
        where: { productId: existing.id },
        create: { productId: existing.id, quantity: qty },
        update: { quantity: qty },
      });
      updated++;
    } else {
      await prisma.product.create({
        data: {
          code,
          name: name || code,
          weightG: 15,
          lengthMm: 150,
          widthMm: 90,
          heightMm: 20,
          price: 0,
          stock: { create: { quantity: qty } },
        },
      });
      added++;
    }
  }

  revalidatePath("/dashboard");
  return { added, updated };
}

export async function loadMasterExcel(
  formData: FormData
): Promise<{ error?: string; products?: number; warehouses?: number; boxes?: number }> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "파일을 선택하세요." };

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });

  const pi = sheetAoa(wb, ["ProductInfo"]);
  const ins = sheetAoa(wb, ["InStock"]);
  const hi = sheetAoa(wb, ["HoldItem"]);
  const de = sheetAoa(wb, ["Destination"]);
  const bx = sheetAoa(wb, ["Box"]);

  if (!pi || !pi.length) return { error: "ProductInfo 시트를 찾지 못했습니다." };

  const stockByCode = new Map<string, number>();
  if (ins && ins.length) {
    const h = (ins[0] as unknown[]).map(normHeader);
    const ciCode = findCol(h, ["상품번호"]);
    const ciQty = findCol(h, ["기초수량", "재고", "수량"]);
    for (let r = 1; r < ins.length; r++) {
      const code = String(ins[r][ciCode] ?? "").trim();
      if (code) stockByCode.set(code, parseNum(ins[r][ciQty]));
    }
  }
  const holdSet = new Set<string>();
  if (hi && hi.length) {
    const h = (hi[0] as unknown[]).map(normHeader);
    const ciCode = findCol(h, ["상품번호"]);
    for (let r = 1; r < hi.length; r++) {
      const code = String(hi[r][ciCode] ?? "").trim();
      if (code) holdSet.add(code);
    }
  }

  let productCount = 0;
  {
    const h = (pi[0] as unknown[]).map(normHeader);
    const ic = {
      code: findCol(h, ["상품번호"]),
      bc: findCol(h, ["바코드"]),
      name: findCol(h, ["상품명", "상품이름"]),
      pack: findCol(h, ["포장수량"]),
      w: findCol(h, ["무게"]),
      L: findCol(h, ["가로"]),
      W: findCol(h, ["세로"]),
      H: findCol(h, ["높이"]),
      price: findCol(h, ["가격", "단가"]),
    };
    for (let r = 1; r < pi.length; r++) {
      const row = pi[r];
      const code = String(row[ic.code] ?? "").trim();
      if (!code) continue;
      const data = {
        barcode: ic.bc > -1 ? String(row[ic.bc] ?? "").trim() || null : null,
        name: ic.name > -1 ? String(row[ic.name] ?? "").trim() || code : code,
        packQty: ic.pack > -1 && parseNum(row[ic.pack]) > 0 ? parseNum(row[ic.pack]) : 1,
        weightG: ic.w > -1 ? parseNum(row[ic.w]) : 0,
        lengthMm: ic.L > -1 ? parseNum(row[ic.L]) : 0,
        widthMm: ic.W > -1 ? parseNum(row[ic.W]) : 0,
        heightMm: ic.H > -1 ? parseNum(row[ic.H]) : 0,
        price: ic.price > -1 ? parseNum(row[ic.price]) : 0,
        status: holdSet.has(code) ? "DISCONTINUED" : "ACTIVE",
      };
      const stockQty = stockByCode.get(code) ?? 0;
      const existing = await prisma.product.findUnique({ where: { code } });
      if (existing) {
        await prisma.product.update({
          where: { code },
          data: { ...data, stock: { upsert: { create: { quantity: stockQty }, update: { quantity: stockQty } } } },
        });
      } else {
        await prisma.product.create({ data: { code, ...data, stock: { create: { quantity: stockQty } } } });
      }
      productCount++;
    }
  }

  let whCount = 0;
  if (de && de.length) {
    const h = (de[0] as unknown[]).map(normHeader);
    const ic = {
      region: findCol(h, ["통합지역"]),
      area: findCol(h, ["지역"]),
      name: findCol(h, ["명칭", "물류센터", "배송지"]),
      addr: findCol(h, ["주소"]),
    };
    for (let r = 1; r < de.length; r++) {
      const row = de[r];
      const name = String(row[ic.name] ?? "").trim();
      if (!name) continue;
      await prisma.warehouse.upsert({
        where: { code: name },
        create: {
          code: name,
          name,
          region: ic.region > -1 ? String(row[ic.region] ?? "").trim() || null : null,
          area: ic.area > -1 ? String(row[ic.area] ?? "").trim() || null : null,
          address: ic.addr > -1 ? String(row[ic.addr] ?? "").trim() || null : null,
        },
        update: {
          region: ic.region > -1 ? String(row[ic.region] ?? "").trim() || null : null,
          area: ic.area > -1 ? String(row[ic.area] ?? "").trim() || null : null,
          address: ic.addr > -1 ? String(row[ic.addr] ?? "").trim() || null : null,
        },
      });
      whCount++;
    }
  }

  let boxCount = 0;
  if (bx && bx.length) {
    const h = (bx[0] as unknown[]).map(normHeader);
    const ic = {
      name: findCol(h, ["상자종류", "박스"]),
      L: findCol(h, ["가로"]),
      W: findCol(h, ["세로"]),
      H: findCol(h, ["높이"]),
      mw: findCol(h, ["Hold", "허용무게", "무게"]),
      st: findCol(h, ["보유수량", "수량"]),
    };
    for (let r = 1; r < bx.length; r++) {
      const row = bx[r];
      const name = String(row[ic.name] ?? "").trim();
      if (!name) continue;
      const data = {
        lengthMm: parseNum(row[ic.L]),
        widthMm: parseNum(row[ic.W]),
        heightMm: parseNum(row[ic.H]),
        maxWeightG: parseNum(row[ic.mw]),
        stockQty: parseNum(row[ic.st]),
      };
      const existing = await prisma.boxSpec.findFirst({ where: { name } });
      if (existing) await prisma.boxSpec.update({ where: { id: existing.id }, data: { ...data, archived: false } });
      else await prisma.boxSpec.create({ data: { name, ...data } });
      boxCount++;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard/destinations");
  return { products: productCount, warehouses: whCount, boxes: boxCount };
}
