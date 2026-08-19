import { getOrderStats } from "@/lib/stats";
import { getTenantDb } from "@/lib/tenant-db";
import { RankBars, TrendChart } from "./charts";

function won(n: number) {
  return n.toLocaleString() + "원";
}
function monthLabel(m: string) {
  return m.length === 6 ? `${m.slice(0, 4)}-${m.slice(4, 6)}` : m;
}

export default async function StatsPage() {
  const db = await getTenantDb();
  const stats = await getOrderStats(db);

  const trendData = [...stats.monthly].reverse().map((m) => ({
    label: monthLabel(m.month),
    qty: m.qty,
    amount: m.amount,
    lines: m.lines,
  }));
  const productItems = stats.topProductsByAmount.map((p) => ({
    label: `${p.name} (${p.code})`,
    value: p.amount,
    sub: `수량 ${p.qty.toLocaleString()}`,
  }));
  const destItems = stats.destStats.map((d) => ({
    label: d.dest,
    value: d.amount,
    sub: `발주 ${d.poCount}건 · 수량 ${d.qty.toLocaleString()}`,
  }));

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>통계</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        지금까지 들어온 모든 발주 파일(진행 중 포함)을 누적 집계한 물량·금액 통계입니다.
      </p>

      <div className="stats">
        <div className="stat s">
          <div className="l">총 발주 수량</div>
          <div className="n mono">{stats.totalQty.toLocaleString()}</div>
        </div>
        <div className="stat s">
          <div className="l">총 발주 금액</div>
          <div className="n mono">{won(stats.totalAmount)}</div>
        </div>
        <div className="stat">
          <div className="l">발주서(파일) 건수</div>
          <div className="n mono">{stats.totalBatches}</div>
        </div>
        <div className="stat">
          <div className="l">발주번호 수</div>
          <div className="n mono">{stats.totalPos}</div>
        </div>
        <div className="stat">
          <div className="l">배송지 수</div>
          <div className="n mono">{stats.totalDests}</div>
        </div>
        <div className="stat">
          <div className="l">상품 종류</div>
          <div className="n mono">{stats.totalProducts}</div>
        </div>
      </div>

      {stats.totalLines === 0 ? (
        <div className="card">
          <p className="muted" style={{ padding: 18 }}>아직 집계할 발주 데이터가 없습니다. Order · 패킹에서 주문을 올리면 여기 반영됩니다.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-h">
              <h3>월별 발주 금액 추이</h3>
              <span className="muted" style={{ fontSize: 13 }}>{stats.monthly.length}개월</span>
            </div>
            <div style={{ padding: "6px 18px 18px" }}>
              <TrendChart data={trendData} />
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>상품별 발주 TOP 8 (금액 기준)</h3>
              <span className="muted" style={{ fontSize: 13 }}>전체 {stats.totalProducts}종</span>
            </div>
            <div style={{ padding: "6px 18px 18px" }}>
              <RankBars items={productItems} top={8} unit="원" />
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>배송지별 발주 금액</h3>
              <span className="muted" style={{ fontSize: 13 }}>{stats.destStats.length}곳</span>
            </div>
            <div style={{ padding: "6px 18px 18px" }}>
              <RankBars items={destItems} top={8} unit="원" />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
