"use client";

import { useState } from "react";

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// PackingList 엑셀의 "쉽먼트" 시트에 들어갈 입고 예정일은 어디에도 저장돼 있지 않아서,
// 내려받기 직전에 사용자에게 직접 입력받는다.
export default function ExportPackingListButton({ batchId }: { batchId: string }) {
  const [etaDate, setEtaDate] = useState(tomorrowDate);

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input
        type="date"
        className="txt"
        value={etaDate}
        onChange={(e) => setEtaDate(e.target.value)}
        aria-label="입고 예정일"
        title="쉽먼트 시트에 들어갈 입고 예정일"
      />
      <a className="btn ghost sm" href={`/api/batches/${batchId}/export?etaDate=${etaDate}`}>
        엑셀 내보내기
      </a>
    </span>
  );
}
