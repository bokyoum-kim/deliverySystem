import { prisma } from "@/lib/prisma";

export default async function DashboardHome() {
  const [productCount, stockAgg, discontinuedCount, boxStockAgg] = await Promise.all([
    prisma.product.count(),
    prisma.stock.aggregate({ _sum: { quantity: true } }),
    prisma.product.count({ where: { status: "DISCONTINUED" } }),
    prisma.boxSpec.aggregate({ _sum: { stockQty: true } }),
  ]);

  const stats = [
    { label: "상품 종수", value: productCount },
    { label: "총 재고수량", value: stockAgg._sum.quantity ?? 0 },
    { label: "단종 품목", value: discontinuedCount },
    { label: "박스 보유", value: boxStockAgg._sum.stockQty ?? 0 },
  ];

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>재고 현황</h1>
      <p className="muted" style={{ marginTop: 0 }}>현재 보유 재고와 상품 상태를 확인합니다.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          margin: "18px 0",
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div className="muted" style={{ fontSize: 12 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>
              {s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <p className="muted">
        상품·박스·배송지 탭에서 마스터 데이터를 등록·수정하고, Order·패킹에서 주문 엑셀을 올려 패킹 리스트를
        생성·출고 확정할 수 있습니다. 완료된 건은 오더패킹 히스토리에서, 재고 부족분은 발주·입고에서 확인하세요.
      </p>
    </section>
  );
}
