import { prisma } from "@/lib/prisma";
import { createWarehouse, deleteWarehouse } from "./actions";

export default async function DestinationsPage() {
  const dests = await prisma.warehouse.findMany({ orderBy: { name: "asc" } });

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>배송지</h1>
      <p className="muted" style={{ marginTop: 0 }}>물류창고(배송지)와 지역·주소를 관리합니다.</p>

      <div className="card">
        <div className="card-h">
          <h3>배송지 (물류창고)</h3>
          <span className="muted" style={{ fontSize: 13 }}>{dests.length}곳</span>
        </div>

        <form
          action={createWarehouse}
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "12px 18px",
            background: "var(--line-2)",
          }}
        >
          <input className="txt" name="region" placeholder="통합지역" style={{ width: 110 }} />
          <input className="txt" name="area" placeholder="지역" style={{ width: 100 }} />
          <input className="txt" name="name" placeholder="명칭" style={{ width: 120 }} required />
          <input className="txt" name="address" placeholder="주소" style={{ width: 240 }} />
          <button className="btn sm" type="submit">추가</button>
        </form>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>통합지역</th>
                <th>지역</th>
                <th>명칭</th>
                <th>주소</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dests.map((d) => (
                <tr key={d.id}>
                  <td>{d.region || "—"}</td>
                  <td>{d.area || "—"}</td>
                  <td>
                    <b>{d.name}</b>
                  </td>
                  <td className="muted">{d.address || "—"}</td>
                  <td>
                    <form action={deleteWarehouse}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="btn danger sm" type="submit">삭제</button>
                    </form>
                  </td>
                </tr>
              ))}
              {dests.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 22 }}>
                    배송지가 없습니다.
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
