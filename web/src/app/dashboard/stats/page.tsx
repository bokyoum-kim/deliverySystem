import { getOrderStats } from "@/lib/stats";

function won(n: number) {
  return n.toLocaleString() + "원";
}
function monthLabel(m: string) {
  return m.length === 6 ? `${m.slice(0, 4)}-${m.slice(4, 6)}` : m;
}
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function StatsPage() {
  const stats = await getOrderStats();
  const maxMonthlyAmount = Math.max(0, ...stats.monthly.map((m) => m.amount));
  const maxProductAmount = Math.max(0, ...stats.topProductsByAmount.map((p) => p.amount));
  const maxDestAmount = Math.max(0, ...stats.destStats.map((d) => d.amount));

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
              <h3>월별 발주 추이</h3>
              <span className="muted" style={{ fontSize: 13 }}>{stats.monthly.length}개월</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>월</th>
                    <th className="num-c">발주 라인</th>
                    <th className="num-c">발주 수량</th>
                    <th className="num-c">발주 금액</th>
                    <th style={{ width: 160 }}>비중</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.monthly.map((m) => (
                    <tr key={m.month}>
                      <td className="mono">{monthLabel(m.month)}</td>
                      <td className="num-c mono">{m.lines.toLocaleString()}</td>
                      <td className="num-c mono">{m.qty.toLocaleString()}</td>
                      <td className="num-c mono">{won(m.amount)}</td>
                      <td><Bar value={m.amount} max={maxMonthlyAmount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>상품별 발주 TOP 20 (금액 기준)</h3>
              <span className="muted" style={{ fontSize: 13 }}>전체 {stats.totalProducts}종</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>상품번호</th>
                    <th>상품명</th>
                    <th className="num-c">발주 라인</th>
                    <th className="num-c">발주 수량</th>
                    <th className="num-c">발주 금액</th>
                    <th style={{ width: 160 }}>비중</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProductsByAmount.map((p) => (
                    <tr key={p.code}>
                      <td className="mono">{p.code}</td>
                      <td>{p.name}</td>
                      <td className="num-c mono">{p.lines.toLocaleString()}</td>
                      <td className="num-c mono">{p.qty.toLocaleString()}</td>
                      <td className="num-c mono">{won(p.amount)}</td>
                      <td><Bar value={p.amount} max={maxProductAmount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>배송지별 발주 현황</h3>
              <span className="muted" style={{ fontSize: 13 }}>{stats.destStats.length}곳</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>배송지</th>
                    <th className="num-c">발주번호</th>
                    <th className="num-c">발주 라인</th>
                    <th className="num-c">발주 수량</th>
                    <th className="num-c">발주 금액</th>
                    <th style={{ width: 160 }}>비중</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.destStats.map((d) => (
                    <tr key={d.dest}>
                      <td>{d.dest}</td>
                      <td className="num-c mono">{d.poCount.toLocaleString()}</td>
                      <td className="num-c mono">{d.lines.toLocaleString()}</td>
                      <td className="num-c mono">{d.qty.toLocaleString()}</td>
                      <td className="num-c mono">{won(d.amount)}</td>
                      <td><Bar value={d.amount} max={maxDestAmount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
