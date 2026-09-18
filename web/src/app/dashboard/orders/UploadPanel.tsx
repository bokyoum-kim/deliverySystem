"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseOrderFile, SAMPLE_ORDER } from "@/lib/xlsx-parse";
import type { OrderLineInput } from "@/lib/packing";
import { generatePacking, updateDefaultCap, registerMissingProducts } from "./actions";

type BoxSpecOpt = { id: string; name: string; lengthMm: number; widthMm: number; heightMm: number; stockQty: number };
type ProductOpt = { code: string; discontinued: boolean };

// 미등록 상품 등록 폼의 입력값(문자열 상태). 서버로 보낼 때 숫자로 바꾼다.
type Draft = { name: string; barcode: string; packQty: string; weightG: string; lengthMm: string; widthMm: string; heightMm: string; price: string };
const DRAFT_FIELDS: { key: keyof Draft; label: string; width: number; mono?: boolean; hint?: string }[] = [
  { key: "name", label: "상품명", width: 220 },
  { key: "barcode", label: "바코드", width: 130, mono: true, hint: "선택" },
  { key: "packQty", label: "포장수량", width: 74, mono: true },
  { key: "weightG", label: "무게(g)", width: 80, mono: true, hint: "포장 1개 기준" },
  { key: "lengthMm", label: "가로(mm)", width: 80, mono: true, hint: "포장 1개 기준" },
  { key: "widthMm", label: "세로(mm)", width: 80, mono: true, hint: "포장 1개 기준" },
  { key: "heightMm", label: "높이(mm)", width: 80, mono: true, hint: "포장 1개 기준" },
  { key: "price", label: "단가(원)", width: 90, mono: true },
];

function MissingProductsForm({
  missing,
  drafts,
  onChange,
  onSubmit,
  busy,
}: {
  missing: { code: string; name: string; lineCount: number }[];
  drafts: Record<string, Draft>;
  onChange: (code: string, key: keyof Draft, value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <div
      style={{
        margin: "6px 0 18px",
        padding: "14px 16px",
        background: "var(--surface)",
        border: "1px solid var(--err)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span className="badge b-err">상품 등록 필요</span>
        <b>주문 파일에는 있지만 상품 마스터에 없는 상품이 {missing.length}종 있습니다.</b>
        <span className="muted" style={{ fontSize: 13 }}>
          크기·무게는 패킹 계산에 그대로 쓰이니 <b>포장수량 단위(포장 1개)</b> 기준으로 입력하세요. 모두 등록해야 Packing List를 만들 수 있습니다.
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>상품번호</th>
              {DRAFT_FIELDS.map((f) => (
                <th key={f.key}>
                  {f.label}
                  {f.hint && (
                    <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>
                      {" "}
                      ({f.hint})
                    </span>
                  )}
                </th>
              ))}
              <th className="num-c">주문 라인</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((m) => {
              const d = drafts[m.code];
              if (!d) return null;
              return (
                <tr key={m.code}>
                  <td className="mono">{m.code}</td>
                  {DRAFT_FIELDS.map((f) => (
                    <td key={f.key}>
                      <input
                        className={"txt" + (f.mono ? " mono" : "")}
                        style={{ width: f.width }}
                        type={f.key === "name" || f.key === "barcode" ? "text" : "number"}
                        min={f.key === "packQty" ? 1 : 0}
                        step={f.key === "packQty" ? 1 : "any"}
                        value={d[f.key]}
                        required={f.key !== "barcode"}
                        onChange={(e) => onChange(m.code, f.key, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="num-c mono">{m.lineCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <button className="btn" type="button" disabled={busy} onClick={onSubmit}>
          {busy ? "등록 중…" : `${missing.length}종 상품 등록`}
        </button>
      </div>
    </div>
  );
}

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
  const [eta, setEta] = useState(100); // 충진율 % 기본값 (2026-09: 80 → 100)
  const [cap, setCap] = useState(defaultCap);
  const [savingCap, setSavingCap] = useState(false);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set(boxSpecs.map((b) => b.id)));
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // 미등록 상품 등록 상태: 입력 중인 값, 이 화면에서 방금 등록한 코드(서버 목록이 갱신되기 전에도 반영)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [registeredCodes, setRegisteredCodes] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);

  const knownCodes = new Set<string>(products.map((p) => p.code));
  for (const c of registeredCodes) knownCodes.add(c);

  function acceptLines(parsed: OrderLineInput[]) {
    const nextDrafts: Record<string, Draft> = {};
    for (const l of parsed) {
      if (knownCodes.has(l.code) || nextDrafts[l.code]) continue;
      nextDrafts[l.code] = { name: l.name || "", barcode: "", packQty: "1", weightG: "", lengthMm: "", widthMm: "", heightMm: "", price: "" };
    }
    setDrafts(nextDrafts);
    setLines(parsed);
    setMsg(null);
  }

  async function handleFile(file: File) {
    setMsg({ type: "load", text: "주문을 읽는 중…" });
    try {
      acceptLines(await parseOrderFile(file));
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "주문 오류" });
      setLines(null);
    }
  }

  function loadSample() {
    acceptLines(SAMPLE_ORDER);
  }

  async function submitMissing(codes: string[]) {
    setRegistering(true);
    const items = codes.map((code) => {
      const d = drafts[code];
      return {
        code,
        name: d.name,
        barcode: d.barcode,
        packQty: Number(d.packQty),
        weightG: Number(d.weightG),
        lengthMm: Number(d.lengthMm),
        widthMm: Number(d.widthMm),
        heightMm: Number(d.heightMm),
        price: Number(d.price === "" ? 0 : d.price),
      };
    });
    const res = await registerMissingProducts(items);
    setRegistering(false);
    if (res.error) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    const next = new Set(registeredCodes);
    for (const c of res.registered ?? []) next.add(c);
    setRegisteredCodes(next);
    setMsg(null);
    router.refresh();
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
    const res = await generatePacking(lines, {
      eta,
      cap,
      enabledBoxSpecIds: [...enabledIds],
      newlyRegisteredCodes: [...registeredCodes],
    });
    setGenerating(false);
    if (res.error) {
      // 서버 기준으로 아직 미등록인 상품이 있으면(다른 탭에서 삭제됐다든지) 그 코드만 다시 등록 폼에 올린다
      if (res.missingCodes?.length) {
        const shrunk = new Set(registeredCodes);
        for (const c of res.missingCodes) shrunk.delete(c);
        setRegisteredCodes(shrunk);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const c of res.missingCodes!) {
            if (!next[c]) {
              const l = lines.find((x) => x.code === c);
              next[c] = { name: l?.name || "", barcode: "", packQty: "1", weightG: "", lengthMm: "", widthMm: "", heightMm: "", price: "" };
            }
          }
          return next;
        });
      }
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

  // 주문 파일에는 있는데 상품 마스터(+이 화면에서 방금 등록한 것)에 없는 상품 — 전부 등록해야 생성 가능
  const missingMap = new Map<string, { code: string; name: string; lineCount: number }>();
  for (const l of lines) {
    if (knownCodes.has(l.code)) continue;
    const m = missingMap.get(l.code);
    if (m) m.lineCount++;
    else missingMap.set(l.code, { code: l.code, name: l.name, lineCount: 1 });
  }
  const missing = [...missingMap.values()];

  return (
    <div>
      {missing.length > 0 && (
        <MissingProductsForm
          missing={missing}
          drafts={drafts}
          busy={registering}
          onChange={(code, key, value) => setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], [key]: value } }))}
          onSubmit={() => submitMissing(missing.map((m) => m.code))}
        />
      )}
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
          <input className="txt mono" type="number" min={30} max={100} value={eta} onChange={(e) => setEta(Number(e.target.value) || 100)} style={{ width: 70 }} />
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
        <button
          className="btn"
          type="button"
          disabled={generating || missing.length > 0}
          title={missing.length > 0 ? "미등록 상품을 먼저 등록하세요" : undefined}
          onClick={onGenerate}
        >
          {generating ? "생성 중…" : missing.length > 0 ? `상품 ${missing.length}종 등록 후 생성 가능` : "Packing List 생성"}
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
