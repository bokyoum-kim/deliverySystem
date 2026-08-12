"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmShipment, undoShipment, reflectBatch, cancelDraft } from "./actions";

export default function BatchActions({
  batchId,
  status,
  hasPallets,
  hasHolds,
}: {
  batchId: string;
  status: string;
  hasPallets: boolean;
  hasHolds: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(fn: (id: string) => Promise<void>) {
    setBusy(true);
    await fn(batchId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
      {status === "DRAFT" && (
        <>
          <button className="btn" disabled={busy} onClick={() => run(confirmShipment)}>
            출고 확정 · 재고 차감
          </button>
          <button className="btn ghost sm" disabled={busy} onClick={() => run(cancelDraft)}>
            패킹 취소
          </button>
        </>
      )}
      {status === "CONFIRMED" && (
        <>
          <button className="btn" disabled>
            출고 확정 · 재고 차감
          </button>
          <button className="btn ghost sm" disabled={busy} onClick={() => run(undoShipment)}>
            차감 되돌리기
          </button>
          <button
            className="btn"
            disabled={busy}
            style={{ background: "var(--brand-d)", borderColor: "var(--brand-d)" }}
            onClick={() => run(reflectBatch)}
          >
            히스토리 반영 · 화면 초기화
          </button>
          <span className="badge b-ship">재고 차감 완료</span>
        </>
      )}
      <a className="btn ghost sm" href={`/api/batches/${batchId}/export`}>
        엑셀 내보내기
      </a>
      {hasPallets && (
        <a className="btn ghost sm" href={`/api/batches/${batchId}/export-pallets`}>
          팔레트 명세서 엑셀
        </a>
      )}
      {hasHolds && (
        <a className="btn ghost sm" href={`/api/batches/${batchId}/export-returns`}>
          반송 리스트 엑셀
        </a>
      )}
    </div>
  );
}
