import type { PrismaClient } from "@prisma/client";

export type MonthlyStat = { month: string; qty: number; amount: number; lines: number };
export type ProductStat = { code: string; name: string; qty: number; amount: number; lines: number };
export type DestStat = { dest: string; qty: number; amount: number; poCount: number; lines: number };

export type OrderStats = {
  totalLines: number;
  totalQty: number;
  totalAmount: number;
  totalBatches: number;
  totalPos: number;
  totalDests: number;
  totalProducts: number;
  monthly: MonthlyStat[];
  topProductsByAmount: ProductStat[];
  topProductsByQty: ProductStat[];
  destStats: DestStat[];
};

const EMPTY: OrderStats = {
  totalLines: 0,
  totalQty: 0,
  totalAmount: 0,
  totalBatches: 0,
  totalPos: 0,
  totalDests: 0,
  totalProducts: 0,
  monthly: [],
  topProductsByAmount: [],
  topProductsByQty: [],
  destStats: [],
};

// 전체 누적(DRAFT 포함) 발주 통계 — 오더패킹 히스토리 상태와 무관하게 지금까지 들어온 모든 발주 라인을 집계한다.
export async function getOrderStats(db: PrismaClient): Promise<OrderStats> {
  const [totalBatches, lines] = await Promise.all([
    db.orderBatch.count(),
    db.orderLine.findMany({
      select: {
        orderedQty: true,
        totalAmount: true,
        product: { select: { code: true, name: true } },
        sheet: { select: { poNumber: true, destName: true, batch: { select: { dateKey: true } } } },
      },
    }),
  ]);

  if (!lines.length) return { ...EMPTY, totalBatches };

  const poSet = new Set<string>();
  const destSet = new Set<string>();
  const productSet = new Set<string>();
  let totalQty = 0;
  let totalAmount = 0;

  const monthlyMap = new Map<string, MonthlyStat>();
  const productMap = new Map<string, ProductStat>();
  const destMap = new Map<string, DestStat & { _poSet: Set<string> }>();

  for (const l of lines) {
    totalQty += l.orderedQty;
    totalAmount += l.totalAmount;
    poSet.add(l.sheet.poNumber);
    destSet.add(l.sheet.destName);
    productSet.add(l.product.code);

    const month = l.sheet.batch.dateKey.slice(0, 6) || "미상";
    const m = monthlyMap.get(month) ?? { month, qty: 0, amount: 0, lines: 0 };
    m.qty += l.orderedQty;
    m.amount += l.totalAmount;
    m.lines += 1;
    monthlyMap.set(month, m);

    const p = productMap.get(l.product.code) ?? { code: l.product.code, name: l.product.name, qty: 0, amount: 0, lines: 0 };
    p.qty += l.orderedQty;
    p.amount += l.totalAmount;
    p.lines += 1;
    productMap.set(l.product.code, p);

    const d = destMap.get(l.sheet.destName) ?? {
      dest: l.sheet.destName,
      qty: 0,
      amount: 0,
      poCount: 0,
      lines: 0,
      _poSet: new Set<string>(),
    };
    d.qty += l.orderedQty;
    d.amount += l.totalAmount;
    d.lines += 1;
    d._poSet.add(l.sheet.poNumber);
    destMap.set(l.sheet.destName, d);
  }

  const monthly = [...monthlyMap.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
  const products = [...productMap.values()];
  const destStats: DestStat[] = [...destMap.values()]
    .map(({ _poSet, ...rest }) => ({ ...rest, poCount: _poSet.size }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalLines: lines.length,
    totalQty,
    totalAmount,
    totalBatches,
    totalPos: poSet.size,
    totalDests: destSet.size,
    totalProducts: productSet.size,
    monthly,
    topProductsByAmount: [...products].sort((a, b) => b.amount - a.amount).slice(0, 20),
    topProductsByQty: [...products].sort((a, b) => b.qty - a.qty).slice(0, 20),
    destStats,
  };
}
