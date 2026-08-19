import Link from "next/link";
import { getTenantDb } from "@/lib/tenant-db";
import { reflectBatchForm } from "../orders/actions";

export default async function HistoryPage() {
  const db = await getTenantDb();
  const batches = await db.orderBatch.findMany({
    where: { status: { in: ["REFLECTED", "CONFIRMED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      orderSheets: { select: { poNumber: true } },
      purchaseOrders: { select: { id: true } },
      _count: { select: { pallets: true } },
    },
  });

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>오더패킹 히스토리</h1>
      <p className="muted" style={{ marginTop: 0 }}>출고 확정된 거래를 날짜+순번 키로 확인합니다.</p>

      <div className="card">
        <div className="card-h">
          <h3>오더패킹 히스토리</h3>
          <span className="chip mono">{batches.length}건</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>키</th>
                <th>일시</th>
                <th className="num-c">발주</th>
                <th className="num-c">팔레트</th>
                <th className="num-c">재고부족</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const poCount = new Set(b.orderSheets.map((s) => s.poNumber)).size;
                const reflected = b.status === "REFLECTED";
                return (
                  <tr key={b.id}>
                    <td className="mono">{b.key}</td>
                    <td className="mono">
                      {reflected ? b.reflectedAt?.toLocaleString("ko-KR") : <span className="badge b-warn">미반영</span>}
                    </td>
                    <td className="num-c mono">{poCount}</td>
                    <td className="num-c mono">{b._count.pallets || "-"}</td>
                    <td className="num-c mono">{b.purchaseOrders.length}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      {!reflected && (
                        <form action={reflectBatchForm}>
                          <input type="hidden" name="batchId" value={b.id} />
                          <button className="btn sm" type="submit">
                            반영
                          </button>
                        </form>
                      )}
                      <Link className="btn ghost sm" href={`/dashboard/history/${b.id}`}>
                        상세
                      </Link>
                      <a className="btn ghost sm" href={`/api/batches/${b.id}/export`}>
                        엑셀
                      </a>
                    </td>
                  </tr>
                );
              })}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    아직 마무리된 출고 건이 없습니다. Order·패킹에서 &quot;히스토리 반영&quot;을 하면 여기 기록됩니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
