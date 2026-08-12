"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateStock, loadMasterExcel } from "./actions";

export default function BulkUploadButtons() {
  const router = useRouter();
  const stockInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ type: "err" | "load"; text: string } | null>(null);

  async function handleStockFile(file: File) {
    setMsg({ type: "load", text: "재고 데이터를 읽는 중…" });
    const fd = new FormData();
    fd.set("file", file);
    const res = await bulkUpdateStock(fd);
    if (res.error) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    setMsg(null);
    router.refresh();
    if (stockInputRef.current) stockInputRef.current.value = "";
    alert(`재고 업데이트 완료 (신규 ${res.added} · 갱신 ${res.updated})`);
  }

  async function handleMasterFile(file: File) {
    setMsg({ type: "load", text: "마스터를 읽는 중…" });
    const fd = new FormData();
    fd.set("file", file);
    const res = await loadMasterExcel(fd);
    if (res.error) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    setMsg(null);
    router.refresh();
    if (masterInputRef.current) masterInputRef.current.value = "";
    alert(`마스터를 불러왔습니다 (상품 ${res.products} · 배송지 ${res.warehouses} · 박스 ${res.boxes})`);
  }

  return (
    <>
      <input
        ref={masterInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleMasterFile(f);
        }}
      />
      <button className="btn ghost sm" type="button" onClick={() => masterInputRef.current?.click()}>
        마스터 엑셀 불러오기
      </button>

      <input
        ref={stockInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleStockFile(f);
        }}
      />
      <button className="btn ghost sm" type="button" onClick={() => stockInputRef.current?.click()}>
        재고 대량 업데이트
      </button>
      <a className="btn ghost sm" href="/api/templates/stock">
        템플릿 다운로드
      </a>

      {msg && (
        <span className={"msg " + msg.type} style={{ display: "inline-block", marginTop: 0 }}>
          {msg.text}
        </span>
      )}
    </>
  );
}
