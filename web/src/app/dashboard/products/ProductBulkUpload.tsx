"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkUpsertProducts } from "./actions";

export default function ProductBulkUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ type: "err" | "load"; text: string } | null>(null);

  async function handleFile(file: File) {
    setMsg({ type: "load", text: "상품 데이터를 읽는 중…" });
    const fd = new FormData();
    fd.set("file", file);
    const res = await bulkUpsertProducts(fd);
    if (res.error) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    setMsg(null);
    router.refresh();
    if (inputRef.current) inputRef.current.value = "";
    alert(`상품 데이터 업로드 완료 (신규 ${res.added} · 갱신 ${res.updated})`);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button className="btn ghost sm" type="button" onClick={() => inputRef.current?.click()}>
        상품 대량 등록·수정
      </button>
      <a className="btn ghost sm" href="/api/templates/products">
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
