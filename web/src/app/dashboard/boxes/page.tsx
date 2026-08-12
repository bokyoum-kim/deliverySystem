import { prisma } from "@/lib/prisma";
import { createBoxSpec, updateBoxSpec, deleteBoxSpec } from "./actions";

export default async function BoxesPage() {
  const boxes = await prisma.boxSpec.findMany({ orderBy: { name: "asc" } });

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>박스</h1>
      <p className="muted" style={{ marginTop: 0 }}>포장에 사용할 보유 박스를 관리합니다.</p>

      <div className="card">
        <div className="card-h">
          <h3>박스</h3>
          <span className="muted" style={{ fontSize: 13 }}>{boxes.length}종</span>
        </div>

        <form
          action={createBoxSpec}
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "12px 18px",
            background: "var(--line-2)",
          }}
        >
          <input className="txt" name="name" placeholder="상자종류" style={{ width: 130 }} required />
          <input className="txt mono" name="lengthMm" placeholder="가로" style={{ width: 64 }} />
          <input className="txt mono" name="widthMm" placeholder="세로" style={{ width: 64 }} />
          <input className="txt mono" name="heightMm" placeholder="높이" style={{ width: 64 }} />
          <input className="txt mono" name="maxWeightG" placeholder="허용무게g" style={{ width: 84 }} />
          <input className="txt mono" name="stockQty" placeholder="보유수량" style={{ width: 78 }} />
          <button className="btn sm" type="submit">추가</button>
        </form>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>상자종류</th>
                <th>가로</th>
                <th>세로</th>
                <th>높이</th>
                <th className="num-c">허용무게(g)</th>
                <th className="num-c">유효용적(cm³, 충진율80%)</th>
                <th className="num-c">보유수량</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {boxes.map((b) => {
                const effVol = Math.round((b.lengthMm * b.widthMm * b.heightMm * 0.8) / 1000);
                return (
                  <tr key={b.id}>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <form action={updateBoxSpec} style={{ display: "flex", alignItems: "center" }}>
                        <input type="hidden" name="id" value={b.id} />
                        <Cell width={130}>
                          <input className="txt" name="name" defaultValue={b.name} style={{ width: "100%" }} />
                        </Cell>
                        <Cell width={64}>
                          <input className="txt mono" name="lengthMm" defaultValue={b.lengthMm} style={{ width: "100%" }} />
                        </Cell>
                        <Cell width={64}>
                          <input className="txt mono" name="widthMm" defaultValue={b.widthMm} style={{ width: "100%" }} />
                        </Cell>
                        <Cell width={64}>
                          <input className="txt mono" name="heightMm" defaultValue={b.heightMm} style={{ width: "100%" }} />
                        </Cell>
                        <Cell width={90}>
                          <input className="txt mono" name="maxWeightG" defaultValue={b.maxWeightG} style={{ width: "100%" }} />
                        </Cell>
                        <Cell width={150}>
                          <span className="mono muted">{effVol.toLocaleString()}</span>
                        </Cell>
                        <Cell width={80}>
                          <input className="txt mono" name="stockQty" defaultValue={b.stockQty} style={{ width: "100%" }} />
                        </Cell>
                        <Cell width={130}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn ghost sm" type="submit">저장</button>
                            <button className="btn ghost sm" type="submit" formAction={deleteBoxSpec}>삭제</button>
                          </div>
                        </Cell>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {boxes.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    등록된 박스가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        박스당 적재수는 부피(용적×충진율), 허용무게, 최대수량 중 가장 먼저 차는 기준으로 결정됩니다.
      </p>
    </section>
  );
}

function Cell({ children, width }: { children: React.ReactNode; width: number }) {
  return (
    <div style={{ padding: "6px 8px", width, flex: `0 0 ${width}px`, minWidth: 0 }}>
      {children}
    </div>
  );
}
