"use client";

// 단일 계열(금액) 크기 비교이므로 순차(sequential) 단색(--brand) 하나만 사용.
// --brand(#0f6e56)는 --surface(#fff) 대비 6.2:1로 WCAG 통과 확인됨.

export type RankItem = { label: string; value: number; sub?: string };

function pct(v: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(v > 0 ? 2 : 0, Math.round((v / max) * 100));
}

export function RankBars({
  items,
  top = 8,
  unit = "",
}: {
  items: RankItem[];
  top?: number;
  unit?: string;
}) {
  const valueFormatter = (n: number) => n.toLocaleString() + unit;
  const shown = items.slice(0, top);
  const max = Math.max(0, ...items.map((i) => i.value));

  if (!items.length) return <p className="muted" style={{ padding: "8px 2px" }}>데이터가 없습니다.</p>;

  return (
    <div>
      <div className="rankbars">
        {shown.map((it) => (
          <div
            className="rankbar-row"
            key={it.label}
            tabIndex={0}
            title={`${it.label} · ${valueFormatter(it.value)}${it.sub ? " · " + it.sub : ""}`}
          >
            <div className="rankbar-label">{it.label}</div>
            <div className="rankbar-track">
              <div className="rankbar-fill" style={{ width: `${pct(it.value, max)}%` }} />
            </div>
            <div className="rankbar-value mono">{valueFormatter(it.value)}</div>
          </div>
        ))}
      </div>
      {items.length > top && (
        <details style={{ marginTop: 10 }}>
          <summary className="muted" style={{ fontSize: 13, cursor: "pointer" }}>
            전체 {items.length}건 표로 보기
          </summary>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>항목</th>
                  <th className="num-c">값</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.label}>
                    <td>{it.label}</td>
                    <td className="num-c mono">
                      {valueFormatter(it.value)}
                      {it.sub ? ` · ${it.sub}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

export type TrendPoint = { label: string; qty: number; amount: number; lines: number };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return <p className="muted" style={{ padding: "8px 2px" }}>데이터가 없습니다.</p>;

  const W = 100;
  const H = 36;
  const padTop = 6;
  const padBottom = 6;
  const plotH = H - padTop - padBottom;
  const maxAmount = Math.max(1, ...data.map((d) => d.amount));

  const xOf = (i: number) => (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W);
  const yOf = (v: number) => padTop + plotH - (v / maxAmount) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${yOf(d.amount)}`).join(" ");
  const areaPath = `${linePath} L ${xOf(data.length - 1)} ${padTop + plotH} L ${xOf(0)} ${padTop + plotH} Z`;

  const last = data[data.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 200, overflow: "visible" }}>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={0} x2={W} y1={padTop + plotH * (1 - t)} y2={padTop + plotH * (1 - t)} stroke="var(--line)" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
        ))}
        {data.length > 1 && <path d={areaPath} fill="var(--brand)" opacity={0.1} stroke="none" />}
        {data.length > 1 && (
          <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {data.map((d, i) => (
          <circle key={d.label} cx={xOf(i)} cy={yOf(d.amount)} r={4} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke">
            <title>{`${d.label} · ${d.amount.toLocaleString()}원 · 수량 ${d.qty.toLocaleString()} · 라인 ${d.lines.toLocaleString()}`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {data.map((d, i) => (
          <div key={d.label} className="muted mono" style={{ fontSize: 12, textAlign: i === 0 ? "left" : i === data.length - 1 ? "right" : "center", flex: 1 }}>
            {d.label}
          </div>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        최근({last.label}) <b style={{ color: "var(--ink)" }}>{last.amount.toLocaleString()}원</b> · 수량 {last.qty.toLocaleString()} · 라인 {last.lines.toLocaleString()}건
      </div>
      <details style={{ marginTop: 10 }}>
        <summary className="muted" style={{ fontSize: 13, cursor: "pointer" }}>월별 표로 보기</summary>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>월</th>
                <th className="num-c">발주 라인</th>
                <th className="num-c">발주 수량</th>
                <th className="num-c">발주 금액</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.label}>
                  <td className="mono">{d.label}</td>
                  <td className="num-c mono">{d.lines.toLocaleString()}</td>
                  <td className="num-c mono">{d.qty.toLocaleString()}</td>
                  <td className="num-c mono">{d.amount.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
