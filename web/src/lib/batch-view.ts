import { prisma } from "@/lib/prisma";

export type BatchBoxItemView = {
  code: string;
  name: string;
  po: string;
  qty: number;
  weightG: number; // 포장(팩) 1개 기준 무게 — 실제 중량은 packQty로 나눈 팩 수만큼만 곱해야 함
  packQty: number;
  barcode: string | null;
};
export type BatchBoxView = {
  id: string;
  boxNo: number;
  boxSpecName: string;
  items: BatchBoxItemView[];
  palletNo: number | null;
};
export type BatchDestView = {
  dest: string;
  qty: number;
  boxes: BatchBoxView[];
};
export type BatchHoldView = { po: string; dest: string; code: string; name: string; qty: number };
export type BatchShortView = { code: string; name: string; short: number };
export type BatchBoxUsageView = { boxSpecId: string | null; name: string; count: number };

export type BatchDetail = {
  id: string;
  key: string;
  status: string;
  createdAt: Date;
  confirmedAt: Date | null;
  reflectedAt: Date | null;
  eta: number;
  cap: number;
  dests: BatchDestView[];
  holds: BatchHoldView[];
  shorts: BatchShortView[];
  poCount: number;
  boxesUsed: number;
  palletTotal: number;
  shipTotal: number;
  boxUsage: BatchBoxUsageView[];
};

export async function getBatchDetail(batchId: string): Promise<BatchDetail | null> {
  const batch = await prisma.orderBatch.findUnique({
    where: { id: batchId },
    include: {
      orderSheets: {
        include: {
          lines: { include: { product: true } },
          boxes: {
            include: { items: { include: { product: true } }, pallet: true, boxSpec: true },
            orderBy: { boxNo: "asc" },
          },
        },
      },
      purchaseOrders: { include: { product: true } },
    },
  });
  if (!batch) return null;

  const destMap = new Map<string, BatchDestView>();
  const holds: BatchHoldView[] = [];
  let shipTotal = 0;
  let boxesUsed = 0;
  const palletNos = new Set<string>();
  const boxUsageMap = new Map<string, BatchBoxUsageView>();

  for (const sheet of batch.orderSheets) {
    if (!destMap.has(sheet.destName)) destMap.set(sheet.destName, { dest: sheet.destName, qty: 0, boxes: [] });
    const destView = destMap.get(sheet.destName)!;

    for (const line of sheet.lines) {
      if (line.status === "RETURN") {
        holds.push({
          po: sheet.poNumber,
          dest: sheet.destName,
          code: line.product.code,
          name: line.product.name,
          qty: line.confirmedQty,
        });
      } else {
        shipTotal += line.confirmedQty;
      }
    }

    for (const box of sheet.boxes) {
      boxesUsed++;
      const usageKey = box.boxSpecId;
      const usageName = box.boxSpec?.name ?? "";
      const usage = boxUsageMap.get(usageKey) ?? { boxSpecId: usageKey, name: usageName, count: 0 };
      usage.count++;
      boxUsageMap.set(usageKey, usage);
      destView.boxes.push({
        id: box.id,
        boxNo: box.boxNo,
        boxSpecName: box.boxSpec?.name ?? "",
        palletNo: box.pallet?.palletNo ?? null,
        items: box.items.map((it) => ({
          code: it.product.code,
          name: it.product.name,
          po: sheet.poNumber,
          qty: it.qty,
          weightG: it.product.weightG,
          packQty: it.product.packQty,
          barcode: it.product.barcode,
        })),
      });
      if (box.pallet) palletNos.add(box.pallet.id);
    }
  }

  for (const d of destMap.values()) {
    d.qty = d.boxes.reduce((a, b) => a + b.items.reduce((x, it) => x + it.qty, 0), 0);
  }

  const dests = [...destMap.values()].sort((a, b) => b.boxes.length - a.boxes.length);

  const shorts: BatchShortView[] = batch.purchaseOrders.map((po) => ({
    code: po.product.code,
    name: po.product.name,
    short: po.shortQty,
  }));

  const poSet = new Set(batch.orderSheets.map((s) => s.poNumber));

  return {
    id: batch.id,
    key: batch.key,
    status: batch.status,
    createdAt: batch.createdAt,
    confirmedAt: batch.confirmedAt,
    reflectedAt: batch.reflectedAt,
    eta: batch.eta,
    cap: batch.cap,
    dests,
    holds,
    shorts,
    poCount: poSet.size,
    boxesUsed,
    palletTotal: palletNos.size,
    shipTotal,
    boxUsage: [...boxUsageMap.values()],
  };
}
