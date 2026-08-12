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
        상품 탭에서 마스터 데이터를 등록·수정할 수 있습니다. 나머지 화면(박스·배송지·Order·패킹·히스토리·발주입고)은
        다음 단계에서 이 데이터베이스 기반으로 이식됩니다.
      </p>
    </section>
  );
}
