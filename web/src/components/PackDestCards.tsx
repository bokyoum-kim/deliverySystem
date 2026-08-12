import type { BatchDestView, BatchBoxView, BatchHoldView, BatchBoxItemView } from "@/lib/batch-view";

function short2(n: string) {
  const s = n.replace(/^Pack_/, "");
  return s.length > 30 ? s.slice(0, 29) + "…" : s;
}
function won0(n: number) {
  return n.toLocaleString();
}
function groupByPo(items: BatchBoxItemView[]) {
  const order: string[] = [];
  const map = new Map<string, BatchBoxItemView[]>();
  for (const it of items) {
    const key = it.po || "";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(it);
  }
  return order.map((k) => ({ po: k, items: map.get(k)! }));
}

function BoxBlock({ dest, box }: { dest: string; box: BatchBoxView }) {
  const id = `${dest}-B${String(box.boxNo).padStart(2, "0")}`;
  const groups = groupByPo(box.items);
  const totQty = box.items.reduce((a, it) => a + it.qty, 0);
  const totWeight = box.items.reduce((a, it) => a + it.qty * it.weightG, 0);

  if (groups.length === 1) {
    const g = groups[0];
    const itemsText = g.items.map((it) => `${short2(it.name)} ×${it.qty}`).join(", ");
    return (
      <div className="box-blk">
        <div className="box-h">
          <span className="bid mono">
            {id}{" "}
            <span className="badge b-warn" style={{ fontWeight: 600 }}>
              {box.boxSpecName}
            </span>
          </span>
          <span className="bit">
            {g.po && (
              <b className="mono" style={{ color: "var(--brand)" }}>
                [{g.po}]{" "}
              </b>
            )}
            {itemsText}
          </span>
          <span className="bq mono">
            {totQty}개 · {won0(totWeight)}g
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="box-blk">
      <div className="box-h">
        <span className="bid mono">
          {id}{" "}
          <span className="badge b-warn" style={{ fontWeight: 600 }}>
            {box.boxSpecName}
          </span>
        </span>
        <span className="tot mono">
          박스 합계 {totQty}개 · {won0(totWeight)}g
        </span>
      </div>
      {groups.map((g, i) => {
        const itemsText = g.items.map((it) => `${short2(it.name)} ×${it.qty}`).join(", ");
        const sum = g.items.reduce((a, it) => a + it.qty, 0);
        const wt = g.items.reduce((a, it) => a + it.qty * it.weightG, 0);
        return (
          <div className="po-row" key={i}>
            <span className="bit">
              <b className="mono" style={{ color: "var(--brand)" }}>
                [{g.po || "PO미상"}]
              </b>{" "}
              {itemsText}
            </span>
            <span className="bq mono">
              {sum}개 · {won0(wt)}g
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PackDestCards({ dests }: { dests: BatchDestView[] }) {
  return (
    <>
      {dests.map((d) => {
        const palletMap = new Map<number, BatchBoxView[]>();
        const loose: BatchBoxView[] = [];
        for (const bx of d.boxes) {
          if (bx.palletNo != null) {
            if (!palletMap.has(bx.palletNo)) palletMap.set(bx.palletNo, []);
            palletMap.get(bx.palletNo)!.push(bx);
          } else loose.push(bx);
        }
        const palletEntries = [...palletMap.entries()].sort((a, b) => a[0] - b[0]);
        const pillTxt =
          (palletEntries.length
            ? `${palletEntries.length}팔레트${loose.length ? ` + 낱개 ${loose.length}박스` : ""} · `
            : "") + `${d.boxes.length}박스 · ${d.qty}개`;

        return (
          <details className="dest" key={d.dest}>
            <summary className="dest-h">
              <span className="caret">▶</span>
              <span className="nm">{d.dest}</span>
              <span className="tg">
                <span className="pill">{pillTxt}</span>
              </span>
            </summary>
            <div className="dest-b">
              {palletEntries.map(([palletNo, boxes]) => (
                <div className="pallet-blk" key={palletNo}>
                  <div className="pallet-h mono">
                    {d.dest}-PLT{String(palletNo).padStart(2, "0")}{" "}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      ({boxes.length}박스)
                    </span>
                  </div>
                  {boxes.map((bx) => (
                    <BoxBlock dest={d.dest} box={bx} key={bx.id} />
                  ))}
                </div>
              ))}
              {palletEntries.length > 0 && loose.length > 0 && (
                <div className="pallet-blk">
                  <div className="pallet-h mono">
                    낱개 박스{" "}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      ({loose.length}박스 · 팔레트 미포함)
                    </span>
                  </div>
                  {loose.map((bx) => (
                    <BoxBlock dest={d.dest} box={bx} key={bx.id} />
                  ))}
                </div>
              )}
              {palletEntries.length === 0 && loose.map((bx) => <BoxBlock dest={d.dest} box={bx} key={bx.id} />)}
            </div>
          </details>
        );
      })}
    </>
  );
}

export function HoldsTable({ holds }: { holds: BatchHoldView[] }) {
  if (!holds.length) return null;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-h">
        <h3>반송 대상 (단종)</h3>
        <span className="chip">{holds.length}라인</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>발주번호</th>
              <th>배송지</th>
              <th>상품</th>
              <th className="num-c">수량</th>
            </tr>
          </thead>
          <tbody>
            {holds.map((h, i) => (
              <tr key={i}>
                <td className="mono">{h.po || "-"}</td>
                <td>{h.dest}</td>
                <td>
                  {h.name} <span className="sku mono">{h.code}</span>
                </td>
                <td className="num-c mono">{h.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
