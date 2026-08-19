"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseOrderFile, SAMPLE_ORDER } from "@/lib/xlsx-parse";
import type { OrderLineInput } from "@/lib/packing";
import { generatePacking, updateDefaultCap } from "./actions";

type BoxSpecOpt = { id: string; name: string; lengthMm: number; widthMm: number; heightMm: number; stockQty: number };
type ProductOpt = { code: string; discontinued: boolean };

export default function UploadPanel({
  boxSpecs,
  products,
  defaultCap,
}: {
  boxSpecs: BoxSpecOpt[];
  products: ProductOpt[];
  defaultCap: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<OrderLineInput[] | null>(null);
  const [msg, setMsg] = useState<{ type: "err" | "load"; text: string } | null>(null);
  const [eta, setEta] = useState(80);
  const [cap, setCap] = useState(defaultCap);
  const [savingCap, setSavingCap] = useState(false);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set(boxSpecs.map((b) => b.id)));
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setMsg({ type: "load", text: "주문을 읽는 중…" });
    try {
      const parsed = await parseOrderFile(file);
      setLines(parsed);
      setMsg(null);
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "주문 오류" });
      setLines(null);
    }
  }

  function loadSample() {
    setLines(SAMPLE_ORDER);
    setMsg(null);
  }

  async function saveDefaultCap() {
    setSavingCap(true);
    const res = await updateDefaultCap(cap);
    setSavingCap(false);
    if (res.error) {
      alert(res.error);
      return;
    }
    router.refresh();
    alert(`박스당 최대 수량 기본값을 ${cap}(으)로 저장했습니다. 다음 업로드부터 이 값이 기본으로 채워집니다.`);
  }

  async function onGenerate() {
    if (!lines) return;
    setGenerating(true);
    const res = await generatePacking(lines, { eta, cap, enabledBoxSpecIds: [...enabledIds] });
    setGenerating(false);
    if (res.error) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    router.refresh();
  }

  if (!lines) {
    return (
      <div>
        <div
          className={"drop" + (dragOver ? " drag" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <h2 style={{ margin: "0 0 4px" }}>주문 파일(Order 시트)을 올리세요</h2>
          <p className="muted" style={{ margin: "0 0 14px" }}>또는 내장 샘플 주문으로 바로 확인 · .xlsx</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>파일 선택</button>
            <button className="btn ghost" type="button" onClick={loadSample}>샘플 주문 불러오기</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
        {msg && <div className={"msg " + msg.type}>{msg.text}</div>}
      </div>
    );
  }

  const poCount = new Set(lines.map((l) => l.po)).size;
  const destCount = new Set(lines.map((l) => l.dest)).size;
  const discontinuedByCode = new Map(products.map((p) => [p.code, p.discontinued]));
  const holdCount = lines.filter((l) => discontinuedByCode.get(l.code)).length;

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="l">발주</div>
          <div className="n mono">{poCount || "-"}</div>
        </div>
        <div className="stat">
          <div className="l">주문 라인</div>
          <div className="n mono">{lines.length}</div>
        </div>
        <div className="stat">
          <div className="l">배송지</div>
          <div className="n mono">{destCount}</div>
        </div>
        <div className="stat e">
          <div className="l">단종(반송)</div>
          <div className="n mono">{holdCount}</div>
        </div>
        <div className="stat">
          <div className="l">상품 종류</div>
          <div className="n mono">{products.length}</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-end",
          flexWrap: "wrap",
          margin: "6px 0 18px",
          padding: "14px 16px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
        }}
      >
        <div style={{ minWidth: 280, flex: 1 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>사용 박스 (여러 종류 혼용)</label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 5 }}>
            {boxSpecs.map((b) => (
              <label key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={enabledIds.has(b.id)}
                  onChange={(e) => {
                    const next = new Set(enabledIds);
                    if (e.target.checked) next.add(b.id);
                    else next.delete(b.id);
                    setEnabledIds(next);
                  }}
                />
                {b.name}{" "}
                <span className="muted mono" style={{ fontSize: 12 }}>
                  ({b.lengthMm}×{b.widthMm}×{b.heightMm} · {b.stockQty}개)
                </span>
              </label>
            ))}
            {boxSpecs.length === 0 && <span className="muted" style={{ fontSize: 13 }}>등록된 박스가 없습니다.</span>}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", display: "block" }}>충진율 %</label>
          <input className="txt mono" type="number" min={30} max={95} value={eta} onChange={(e) => setEta(Number(e.target.value) || 80)} style={{ width: 70 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", display: "block" }}>박스당 최대 수량</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="txt mono"
              type="number"
              min={1}
              value={cap}
              onChange={(e) => setCap(Number(e.target.value) || defaultCap)}
              style={{ width: 90 }}
            />
            <button
              className="btn ghost sm"
              type="button"
              disabled={savingCap || cap === defaultCap}
              onClick={saveDefaultCap}
              title="이 값을 다음 업로드부터 기본값으로 사용"
            >
              기본값으로 저장
            </button>
          </div>
        </div>
        <button className="btn" type="button" disabled={generating} onClick={onGenerate}>
          {generating ? "생성 중…" : "Packing List 생성"}
        </button>
        <button
          className="btn ghost sm"
          type="button"
          onClick={() => {
            setLines(null);
            setMsg(null);
          }}
        >
          다시 올리기
        </button>
      </div>

      {msg && <div className={"msg " + msg.type}>{msg.text}</div>}
    </div>
  );
}
