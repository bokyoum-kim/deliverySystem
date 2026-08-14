"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { runPacking, type OrderLineInput, type ProductLite, type BoxSpecLite } from "@/lib/packing";
import { revalidatePath } from "next/cache";

// 실제 발주서는 수천 라인·수백 박스 규모라 행 단위 순차 insert는 트랜잭션 타임아웃을 유발한다.
// createMany 계열로 한 번에 밀어넣어 라운드트립 수를 데이터 규모와 무관하게 상수로 유지한다.

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
  // 대량 주문에서도 빠르도록 코드당 1건씩이 아니라 한 번에 bulk insert
  const nameByCode = new Map<string, string>();
  for (const l of lines) if (!nameByCode.has(l.code)) nameByCode.set(l.code, l.name);
  const missingCodes = [...nameByCode.keys()].filter((code) => !productMap.has(code));
  if (missingCodes.length) {
    const createdProducts = await prisma.product.createManyAndReturn({
      data: missingCodes.map((code) => ({
        code,
        name: nameByCode.get(code) || code,
        weightG: 15,
        lengthMm: 150,
        widthMm: 90,
        heightMm: 20,
        price: 0,
      })),
    });
    await prisma.stock.createMany({
      data: createdProducts.map((p) => ({ productId: p.id, quantity: 0 })),
    });
    for (const p of createdProducts) {
      productMap.set(p.code, {
        code: p.code,
        name: p.name,
        weightG: p.weightG,
        lengthMm: p.lengthMm,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        stock: 0,
        discontinued: false,
      });
      productIdByCode.set(p.code, p.id);
    }
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

      const sheetRows = [...poToDest.entries()].map(([po, dest]) => ({
        batchId: batch.id,
        poNumber: po,
        destName: dest,
        warehouseId: warehouseByName.get(dest)?.id,
      }));
      const createdSheets = sheetRows.length ? await tx.orderSheet.createManyAndReturn({ data: sheetRows }) : [];
      const sheetIdByPo = new Map(createdSheets.map((s) => [s.poNumber, s.id]));

      const lineRows = lines
        .map((l) => {
          const sheetId = sheetIdByPo.get(l.po);
          const productId = productIdByCode.get(l.code);
          if (!sheetId || !productId) return null;
          const isHold = productMap.get(l.code)?.discontinued;
          return {
            sheetId,
            productId,
            orderedQty: l.qty,
            confirmedQty: l.qty,
            status: isHold ? "RETURN" : "SHIP",
            unitCost: l.unitCost ?? 0,
            supplyPrice: l.supplyPrice ?? 0,
            vat: l.vat ?? 0,
            totalAmount: l.totalAmount ?? 0,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (lineRows.length) await tx.orderLine.createMany({ data: lineRows });

      // 팔레트를 박스보다 먼저 만들어 박스 insert 시 palletId를 바로 채워 넣는다 (박스별 update 왕복을 없앰)
      const palletIdByDestNo = new Map<string, string>();
      const palletRows: { batchId: string; palletSpecId: string; destKey: string; palletNo: number }[] = [];
      for (const d of result.dests) {
        if (!d.pallets) continue;
        for (const plt of d.pallets) {
          palletRows.push({ batchId: batch.id, palletSpecId: "default-pallet-spec", destKey: d.dest, palletNo: plt.palletNo });
        }
      }
      if (palletRows.length) {
        const createdPallets = await tx.pallet.createManyAndReturn({ data: palletRows });
        for (const p of createdPallets) palletIdByDestNo.set(`${p.destKey}::${p.palletNo}`, p.id);
      }
      const boxNoToPalletId = new Map<string, string>();
      for (const d of result.dests) {
        if (!d.pallets) continue;
        for (const plt of d.pallets) {
          const palletId = palletIdByDestNo.get(`${d.dest}::${plt.palletNo}`);
          if (!palletId) continue;
          for (const boxNo of plt.boxNos) boxNoToPalletId.set(`${d.dest}::${boxNo}`, palletId);
        }
      }

      const boxRows: { sheetId: string; boxSpecId: string; boxNo: number; palletId?: string }[] = [];
      for (const d of result.dests) {
        for (const bx of d.boxes) {
          const po = bx.items[0]?.po ?? "";
          const sheetId = sheetIdByPo.get(po);
          if (!sheetId) continue;
          const palletId = boxNoToPalletId.get(`${d.dest}::${bx.boxNo}`);
          boxRows.push({ sheetId, boxSpecId: bx.boxSpecId, boxNo: bx.boxNo, ...(palletId ? { palletId } : {}) });
        }
      }
      const createdBoxes = boxRows.length ? await tx.box.createManyAndReturn({ data: boxRows }) : [];
      const boxIdBySheetBoxNo = new Map(createdBoxes.map((b) => [`${b.sheetId}::${b.boxNo}`, b.id]));

      const boxItemRows: { boxId: string; productId: string; qty: number }[] = [];
      for (const d of result.dests) {
        for (const bx of d.boxes) {
          const po = bx.items[0]?.po ?? "";
          const sheetId = sheetIdByPo.get(po);
          if (!sheetId) continue;
          const boxId = boxIdBySheetBoxNo.get(`${sheetId}::${bx.boxNo}`);
          if (!boxId) continue;
          for (const it of bx.items) {
            const productId = productIdByCode.get(it.code);
            if (!productId) continue;
            boxItemRows.push({ boxId, productId, qty: it.qty });
          }
        }
      }
      if (boxItemRows.length) await tx.boxItem.createMany({ data: boxItemRows });

      const shortRows = result.shorts
        .map((s) => {
          const productId = productIdByCode.get(s.code);
          if (!productId) return null;
          return { batchId: batch.id, productId, shortQty: s.short, receivedQty: 0, status: "PENDING" };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (shortRows.length) await tx.purchaseOrder.createMany({ data: shortRows });
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

  // 상품 종류가 많은(수백~수천 라인) 주문에서도 빠르도록 조회는 bulk로 한 번에,
  // 쓰기는 개별 오퍼레이션을 배열로 모아 하나의 배치 트랜잭션으로 보낸다.
  const boxItems = await prisma.boxItem.findMany({
    where: { box: { sheet: { batchId } } },
    select: { productId: true, qty: true },
  });
  const need: Record<string, number> = {};
  for (const bi of boxItems) need[bi.productId] = (need[bi.productId] || 0) + bi.qty;

  const boxes = await prisma.box.findMany({ where: { sheet: { batchId } }, select: { boxSpecId: true } });
  const boxUsed: Record<string, number> = {};
  for (const b of boxes) boxUsed[b.boxSpecId] = (boxUsed[b.boxSpecId] || 0) + 1;

  const stocks = await prisma.stock.findMany({ where: { productId: { in: Object.keys(need) } } });
  const stockByProduct = new Map(stocks.map((s) => [s.productId, s.quantity]));
  const stockDeltas: Record<string, number> = {};
  const stockOps = [];
  for (const [productId, needQty] of Object.entries(need)) {
    const take = Math.min(stockByProduct.get(productId) ?? 0, needQty);
    if (take > 0) {
      stockDeltas[productId] = take;
      stockOps.push(prisma.stock.update({ where: { productId }, data: { quantity: { decrement: take } } }));
    }
  }

  const specs = await prisma.boxSpec.findMany({ where: { id: { in: Object.keys(boxUsed) } } });
  const specById = new Map(specs.map((s) => [s.id, s.stockQty]));
  const boxDeltas: Record<string, number> = {};
  const boxOps = [];
  for (const [boxSpecId, usedQty] of Object.entries(boxUsed)) {
    const cur = specById.get(boxSpecId) ?? 0;
    const take = Math.min(cur, usedQty);
    boxDeltas[boxSpecId] = take;
    boxOps.push(prisma.boxSpec.update({ where: { id: boxSpecId }, data: { stockQty: Math.max(0, cur - usedQty) } }));
  }

  await prisma.$transaction([
    ...stockOps,
    ...boxOps,
    prisma.orderBatch.update({
      where: { id: batchId },
      data: { status: "CONFIRMED", confirmedAt: new Date(), stockDeltas, boxDeltas },
    }),
  ]);

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
}

export async function undoShipment(batchId: string) {
  const batch = await prisma.orderBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.status !== "CONFIRMED") return;

  const stockDeltas = (batch.stockDeltas as Record<string, number> | null) ?? {};
  const boxDeltas = (batch.boxDeltas as Record<string, number> | null) ?? {};

  await prisma.$transaction([
    ...Object.entries(stockDeltas).map(([productId, qty]) =>
      prisma.stock.update({ where: { productId }, data: { quantity: { increment: qty } } })
    ),
    ...Object.entries(boxDeltas).map(([boxSpecId, qty]) =>
      prisma.boxSpec.update({ where: { id: boxSpecId }, data: { stockQty: { increment: qty } } })
    ),
    prisma.orderBatch.update({
      where: { id: batchId },
      data: { status: "DRAFT", confirmedAt: null },
    }),
  ]);

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

// 오더패킹 히스토리 화면의 <form action> 버튼에서 바로 쓰는 최소 래퍼 (batchId를 FormData로 받음)
export async function reflectBatchForm(formData: FormData) {
  const batchId = String(formData.get("batchId") ?? "");
  if (!batchId) return;
  await reflectBatch(batchId);
}
