"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBoxSpec, deleteBoxSpec } from "./actions";

export type BoxRow = {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  maxWeightG: number;
  stockQty: number;
};

export default function BoxesTable({ boxes }: { boxes: BoxRow[] }) {
  return (
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
        {boxes.map((b) => (
          <Row key={b.id} box={b} />
        ))}
        {boxes.length === 0 && (
          <tr>
            <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>
              등록된 박스가 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Row({ box }: { box: BoxRow }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: box.name,
    lengthMm: box.lengthMm,
    widthMm: box.widthMm,
    heightMm: box.heightMm,
    maxWeightG: box.maxWeightG,
    stockQty: box.stockQty,
  });
  const effVol = Math.round((f.lengthMm * f.widthMm * f.heightMm * 0.8) / 1000);

  async function save() {
    const fd = new FormData();
    fd.set("id", box.id);
    fd.set("name", f.name);
    fd.set("lengthMm", String(f.lengthMm));
    fd.set("widthMm", String(f.widthMm));
    fd.set("heightMm", String(f.heightMm));
    fd.set("maxWeightG", String(f.maxWeightG));
    fd.set("stockQty", String(f.stockQty));
    await updateBoxSpec(fd);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`"${box.name}" 박스를 삭제할까요?`)) return;
    const fd = new FormData();
    fd.set("id", box.id);
    await deleteBoxSpec(fd);
    router.refresh();
  }

  function field(key: keyof typeof f, mono = true) {
    return (
      <input
        className="cell"
        style={mono ? undefined : { fontFamily: "inherit", textAlign: "left", width: "100%" }}
        value={f[key]}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        onBlur={save}
      />
    );
  }

  return (
    <tr>
      <td>{field("name", false)}</td>
      <td>{field("lengthMm")}</td>
      <td>{field("widthMm")}</td>
      <td>{field("heightMm")}</td>
      <td className="num-c">{field("maxWeightG")}</td>
      <td className="num-c mono muted">{effVol.toLocaleString()}</td>
      <td className="num-c">{field("stockQty")}</td>
      <td>
        <button className="btn danger sm" type="button" onClick={remove}>
          삭제
        </button>
      </td>
    </tr>
  );
}
