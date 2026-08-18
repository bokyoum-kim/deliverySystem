import { prisma } from "@/lib/prisma";
import { createBoxSpec } from "./actions";
import BoxesTable from "./BoxesTable";

export default async function BoxesPage() {
  const boxes = await prisma.boxSpec.findMany({ where: { archived: false }, orderBy: { name: "asc" } });

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
          <BoxesTable boxes={boxes} />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        박스당 적재수는 부피(용적×충진율), 허용무게, 최대수량 중 가장 먼저 차는 기준으로 결정됩니다.
      </p>
    </section>
  );
}
