import { getTenantDb } from "@/lib/tenant-db";
import { applyReceiving, undoReceiving, reflectPurchaseBatch } from "./actions";

export default async function ReceivingPage() {
  const db = await getTenantDb();
  const list = await db.purchaseOrder.findMany({
    include: { product: true, batch: { select: { id: true, key: true } } },
    orderBy: { createdAt: "asc" },
  });

  const batchMap = new Map<string, { key: string; rows: typeof list }>();
  for (const r of list) {
    if (!batchMap.has(r.batch.id)) batchMap.set(r.batch.id, { key: r.batch.key, rows: [] });
    batchMap.get(r.batch.id)!.rows.push(r);
  }
  const batches = [...batchMap.entries()]
    .map(([batchId, v]) => ({ batchId, ...v }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>발주 · 입고</h1>
      <p className="muted" style={{ marginTop: 0 }}>재고 부족분을 발주하고 입고로 재고를 채웁니다.</p>

      <div className="card">
        <div className="card-h">
          <h3>구매발주 · 입고 (재고 부족분)</h3>
          <a className="btn ghost sm" href="/api/purchase-orders/export">
            발주목록 내보내기
          </a>
        </div>
        <div style={{ padding: "4px 15px 14px" }}>
          {batches.length === 0 && (
            <div className="muted" style={{ textAlign: "center", padding: 24 }}>
              재고 부족 품목이 없습니다. Order·패킹에서 생성하면 표시됩니다.
            </div>
          )}
          {batches.map((b) => {
            const reflected = b.rows.every((r) => r.status === "REFLECTED");
            const appliedCount = b.rows.filter((r) => r.status !== "PENDING").length;
            const totalShort = b.rows.reduce((a, r) => a + r.shortQty, 0);
            return (
              <details className="dest" key={b.batchId}>
                <summary className="dest-h warn">
                  <span className="caret">▶</span>
                  <span className="nm mono">{b.key}</span>
                  <span className="ad">
                    부족 {b.rows.length}품목 · {totalShort.toLocaleString()}개
                  </span>
                  <span className="tg">
                    <span className="pill warn">
                      입고 {appliedCount}/{b.rows.length}
                    </span>
                    {reflected ? (
                      <span className="badge b-ship">반영완료</span>
                    ) : (
                      <form action={reflectPurchaseBatch}>
                        <input type="hidden" name="batchId" value={b.batchId} />
                        <button className="btn ghost sm" type="submit">
                          반영
                        </button>
                      </form>
                    )}
                  </span>
                </summary>
                <div className="dest-b">
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>상품번호</th>
                          <th>상품명</th>
                          <th className="num-c">부족수량</th>
                          <th className="num-c">입고수량</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.rows.map((r) => {
                          const locked = r.status === "REFLECTED";
                          const applied = r.status !== "PENDING";
                          return (
                            <tr key={r.id}>
                              <td className="mono">{r.product.code}</td>
                              <td>{r.product.name}</td>
                              <td className="num-c mono">{r.shortQty}</td>
                              <td className="num-c">
                                <form action={applyReceiving} style={{ display: "inline-flex", gap: 6 }}>
                                  <input type="hidden" name="id" value={r.id} />
                                  <input
                                    className="cell"
                                    name="qty"
                                    defaultValue={applied ? r.receivedQty : r.shortQty}
                                    disabled={applied || locked}
                                    style={{ width: 72, textAlign: "right" }}
                                  />
                                  <button className="btn sm" type="submit" disabled={applied || locked}>
                                    입고 반영
                                  </button>
                                </form>
                              </td>
                              <td>
                                <form action={undoReceiving}>
                                  <input type="hidden" name="id" value={r.id} />
                                  <button className="btn ghost sm" type="submit" disabled={!applied || locked || r.status === "REFLECTED"}>
                                    취소
                                  </button>
                                </form>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Order·패킹 파일(히스토리 키)별로 재고 부족 품목이 한 줄 요약으로 모입니다. 펼쳐서 입고수량을 넣고 &quot;입고
        반영&quot;을 누르면 재고가 늘어나고, 처리가 끝난 파일은 &quot;반영&quot;으로 마감하면 다시 한 줄 요약으로만
        남습니다.
      </p>
    </section>
  );
}
