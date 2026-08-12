import { prisma } from "@/lib/prisma";
import SearchBox from "./SearchBox";
import BulkUploadButtons from "./BulkUploadButtons";

function won(n: number) {
  return n.toLocaleString() + "원";
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [allProducts, discontinuedCount, boxStockAgg] = await Promise.all([
    prisma.product.findMany({ include: { stock: true }, orderBy: { code: "asc" } }),
    prisma.product.count({ where: { status: "DISCONTINUED" } }),
    prisma.boxSpec.aggregate({ _sum: { stockQty: true } }),
  ]);

  const totQty = allProducts.reduce((a, p) => a + (p.stock?.quantity ?? 0), 0);
  const totValue = allProducts.reduce((a, p) => a + (p.stock?.quantity ?? 0) * p.price, 0);

  const query = (q ?? "").toLowerCase().trim();
  const filtered = query
    ? allProducts.filter(
        (p) => p.code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
      )
    : allProducts;

  const stats = [
    { label: "상품 종수", value: allProducts.length.toLocaleString(), cls: "" },
    { label: "총 재고수량", value: totQty.toLocaleString(), cls: "s" },
    { label: "재고 가치", value: won(totValue), cls: "" },
    { label: "단종 품목", value: discontinuedCount.toLocaleString(), cls: "e" },
    { label: "박스 보유", value: (boxStockAgg._sum.stockQty ?? 0).toLocaleString(), cls: "" },
  ];

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>재고 현황</h1>
      <p className="muted" style={{ marginTop: 0 }}>현재 보유 재고와 상품 상태를 확인합니다.</p>

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className={"stat " + s.cls}>
            <div className="l">{s.label}</div>
            <div className="n mono">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h">
          <h3>재고 현황</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <SearchBox placeholder="상품명·번호 검색" />
            <BulkUploadButtons />
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>상품번호</th>
                <th>상품명</th>
                <th>규격(mm)</th>
                <th className="num-c">무게(g)</th>
                <th className="num-c">단가</th>
                <th className="num-c">현재고</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stockQty = p.stock?.quantity ?? 0;
                return (
                  <tr key={p.id}>
                    <td className="mono">{p.code}</td>
                    <td>{p.name}</td>
                    <td className="mono muted">
                      {p.lengthMm}×{p.widthMm}×{p.heightMm}
                    </td>
                    <td className="num-c mono">{p.weightG}</td>
                    <td className="num-c mono">{p.price.toLocaleString()}</td>
                    <td
                      className="num-c mono"
                      style={{ fontWeight: 600, color: stockQty <= 0 ? "var(--err)" : undefined }}
                    >
                      {stockQty.toLocaleString()}
                    </td>
                    <td>
                      {p.status === "DISCONTINUED" ? (
                        <span className="badge b-err">단종</span>
                      ) : (
                        <span className="badge b-ship">판매중</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="hint">
        마스터 엑셀(ProductInfo·InStock·HoldItem·Destination·Box 시트)을 불러오면 있는 상품번호는
        값을 갱신하고 없는 상품번호는 새로 추가합니다(배송지·박스도 동일). 재고 대량 업데이트는
        상품번호·재고수량 컬럼만으로 재고 수치만 갱신합니다. 출고 확정 시 여기 재고가 차감됩니다.
      </p>
    </section>
  );
}
