"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { runPacking, type OrderLineInput, type ProductLite, type BoxSpecLite } from "@/lib/packing";
import { revalidatePath } from "next/cache";

async function genBatchKey() {
  const d = new Date();
  const dateKey =
    d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const count = await prisma.orderBatch.count({ where: { dateKey } });
  const seq = count + 1;
  return { dateKey, key: `${dateKey}-${String(seq).padStart(3, "0")}` };
}

export async function getActiveBatch() {
  return prisma.orderBatch.findFirst({
    where: { status: { in: ["DRAFT", "CONFIRMED"] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function generatePacking(
  lines: OrderLineInput[],
  opts: { eta: number; cap: number; enabledBoxSpecIds?: string[] }
): Promise<{ error?: string; batchKey?: string }> {
  if (!lines.length) return { error: "주문 라인이 없습니다." };

  const active = await getActiveBatch();
  if (active) return { error: "이미 생성된 패킹 리스트가 있습니다. 먼저 출고 확정·히스토리 반영(또는 취소)을 해주세요." };

  const [dbProducts, dbBoxSpecs, dbWarehouses] = await Promise.all([
    prisma.product.findMany({ include: { stock: true } }),
    prisma.boxSpec.findMany(),
    prisma.warehouse.findMany(),
  ]);

  const productMap = new Map<string, ProductLite>();
  const productIdByCode = new Map<string, string>();
  for (const p of dbProducts) {
    productMap.set(p.code, {
      code: p.code,
      name: p.name,
      weightG: p.weightG,
      lengthMm: p.lengthMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      stock: p.stock?.quantity ?? 0,
      discontinued: p.status === "DISCONTINUED",
    });
    productIdByCode.set(p.code, p.id);
  }

  // 주문에 있지만 상품 마스터에 없는 코드는 최소 정보로 즉석 등록 (프로토타입과 동일한 동작)
  for (const l of lines) {
    if (productMap.has(l.code)) continue;
    const created = await prisma.product.create({
      data: {
        code: l.code,
        name: l.name || l.code,
        weightG: 15,
        lengthMm: 150,
        widthMm: 90,
        heightMm: 20,
        price: 0,
        stock: { create: { quantity: 0 } },
      },
    });
    productMap.set(l.code, {
      code: l.code,
      name: created.name,
      weightG: 15,
      lengthMm: 150,
      widthMm: 90,
      heightMm: 20,
      stock: 0,
      discontinued: false,
    });
    productIdByCode.set(l.code, created.id);
  }

  const boxSpecsLite: BoxSpecLite[] = dbBoxSpecs
    .filter((b) => !opts.enabledBoxSpecIds || opts.enabledBoxSpecIds.includes(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      lengthMm: b.lengthMm,
      widthMm: b.widthMm,
      heightMm: b.heightMm,
      maxWeightG: b.maxWeightG,
      stockQty: b.stockQty,
    }));
  if (!boxSpecsLite.length) return { error: "사용할 박스를 하나 이상 선택하세요." };

  const warehouseByName = new Map(dbWarehouses.map((w) => [w.name, w]));

  const result = runPacking(lines, productMap, boxSpecsLite, { eta: opts.eta, cap: opts.cap });
  const bk = await genBatchKey();

  // 발주번호별 대표 배송지 (1 PO = 1 FC 규칙)
  const poToDest = new Map<string, string>();
  for (const l of lines) if (!poToDest.has(l.po)) poToDest.set(l.po, l.dest);

  await prisma.$transaction(
    async (tx) => {
      const batch = await tx.orderBatch.create({
        data: {
          key: bk.key,
          dateKey: bk.dateKey,
          status: "DRAFT",
          eta: opts.eta,
          cap: opts.cap,
          createdById: (await auth())?.user?.id,
        },
      });

      const sheetIdByPo = new Map<string, string>();
      for (const [po, dest] of poToDest.entries()) {
        const wh = warehouseByName.get(dest);
        const sheet = await tx.orderSheet.create({
          data: { batchId: batch.id, poNumber: po, destName: dest, warehouseId: wh?.id },
        });
        sheetIdByPo.set(po, sheet.id);
      }

      for (const l of lines) {
        const sheetId = sheetIdByPo.get(l.po);
        const productId = productIdByCode.get(l.code);
        if (!sheetId || !productId) continue;
        const isHold = productMap.get(l.code)?.discontinued;
        await tx.orderLine.create({
          data: {
            sheetId,
            productId,
            orderedQty: l.qty,
            confirmedQty: l.qty,
            status: isHold ? "RETURN" : "SHIP",
          },
        });
      }

      for (const d of result.dests) {
        const sheetIdOf = (po: string) => sheetIdByPo.get(po)!;
        const boxIdByBoxNo = new Map<number, string>();
        for (const bx of d.boxes) {
          const po = bx.items[0]?.po ?? "";
          const box = await tx.box.create({
            data: {
              sheetId: sheetIdOf(po),
              boxSpecId: bx.boxSpecId,
              boxNo: bx.boxNo,
            },
          });
          boxIdByBoxNo.set(bx.boxNo, box.id);
          for (const it of bx.items) {
            const productId = productIdByCode.get(it.code);
            if (!productId) continue;
            await tx.boxItem.create({ data: { boxId: box.id, productId, qty: it.qty } });
          }
        }
        if (d.pallets) {
          for (const plt of d.pallets) {
            const pallet = await tx.pallet.create({
              data: {
                batchId: batch.id,
                palletSpecId: "default-pallet-spec",
                destKey: d.dest,
                palletNo: plt.palletNo,
              },
            });
            for (const boxNo of plt.boxNos) {
              const boxId = boxIdByBoxNo.get(boxNo);
              if (boxId) await tx.box.update({ where: { id: boxId }, data: { palletId: pallet.id } });
            }
          }
        }
      }

      for (const s of result.shorts) {
        const productId = productIdByCode.get(s.code);
        if (!productId) continue;
        await tx.purchaseOrder.create({
          data: { batchId: batch.id, productId, shortQty: s.short, receivedQty: 0, status: "PENDING" },
        });
      }
    },
    { timeout: 30000 }
  );

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/receiving");
  return { batchKey: bk.key };
}

export async function cancelDraft(batchId: string) {
  const batch = await prisma.orderBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.status !== "DRAFT") return;
  await prisma.orderBatch.delete({ where: { id: batchId } });
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/receiving");
}

export async function confirmShipment(batchId: string) {
  const batch = await prisma.orderBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.status !== "DRAFT") return;

  await prisma.$transaction(async (tx) => {
    const boxItems = await tx.boxItem.findMany({
      where: { box: { sheet: { batchId } } },
      select: { productId: true, qty: true },
    });
    const need: Record<string, number> = {};
    for (const bi of boxItems) need[bi.productId] = (need[bi.productId] || 0) + bi.qty;

    const boxes = await tx.box.findMany({ where: { sheet: { batchId } }, select: { boxSpecId: true } });
    const boxUsed: Record<string, number> = {};
    for (const b of boxes) boxUsed[b.boxSpecId] = (boxUsed[b.boxSpecId] || 0) + 1;

    const stockDeltas: Record<string, number> = {};
    for (const [productId, needQty] of Object.entries(need)) {
      const stock = await tx.stock.findUnique({ where: { productId } });
      const take = Math.min(stock?.quantity ?? 0, needQty);
      if (take > 0) {
        await tx.stock.update({ where: { productId }, data: { quantity: { decrement: take } } });
        stockDeltas[productId] = take;
      }
    }

    const boxDeltas: Record<string, number> = {};
    for (const [boxSpecId, usedQty] of Object.entries(boxUsed)) {
      const spec = await tx.boxSpec.findUnique({ where: { id: boxSpecId } });
      const take = Math.min(spec?.stockQty ?? 0, usedQty);
      await tx.boxSpec.update({
        where: { id: boxSpecId },
        data: { stockQty: Math.max(0, (spec?.stockQty ?? 0) - usedQty) },
      });
      boxDeltas[boxSpecId] = take;
    }

    await tx.orderBatch.update({
      where: { id: batchId },
      data: { status: "CONFIRMED", confirmedAt: new Date(), stockDeltas, boxDeltas },
    });
  }, { timeout: 30000 });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
}

export async function undoShipment(batchId: string) {
  const batch = await prisma.orderBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.status !== "CONFIRMED") return;

  const stockDeltas = (batch.stockDeltas as Record<string, number> | null) ?? {};
  const boxDeltas = (batch.boxDeltas as Record<string, number> | null) ?? {};

  await prisma.$transaction(async (tx) => {
    for (const [productId, qty] of Object.entries(stockDeltas)) {
      await tx.stock.update({ where: { productId }, data: { quantity: { increment: qty } } });
    }
    for (const [boxSpecId, qty] of Object.entries(boxDeltas)) {
      await tx.boxSpec.update({ where: { id: boxSpecId }, data: { stockQty: { increment: qty } } });
    }
    await tx.orderBatch.update({
      where: { id: batchId },
      data: { status: "DRAFT", confirmedAt: null },
    });
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
}

export async function reflectBatch(batchId: string) {
  const batch = await prisma.orderBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.status !== "CONFIRMED") return;
  await prisma.orderBatch.update({
    where: { id: batchId },
    data: { status: "REFLECTED", reflectedAt: new Date() },
  });
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/history");
  revalidatePath("/dashboard/receiving");
}
