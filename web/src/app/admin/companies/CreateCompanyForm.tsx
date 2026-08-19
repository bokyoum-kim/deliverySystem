"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createCompany } from "./actions";

export default function CreateCompanyForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    companyName: string;
    schemaName: string;
    adminEmail: string;
    tempPassword: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setError("");
    setResult(null);
    const res = await createCompany(new FormData(formRef.current));
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.companyName && res.schemaName && res.adminEmail && res.tempPassword) {
      setResult({
        companyName: res.companyName,
        schemaName: res.schemaName,
        adminEmail: res.adminEmail,
        tempPassword: res.tempPassword,
      });
    }
    formRef.current.reset();
    router.refresh();
  }

  return (
    <div>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          padding: "12px 18px",
          background: "var(--line-2)",
        }}
      >
        <input className="txt" name="companyName" placeholder="회사명" style={{ width: 180 }} required />
        <input className="txt" name="adminEmail" type="email" placeholder="관리자 이메일" style={{ width: 200 }} required />
        <input className="txt" name="adminName" placeholder="관리자 이름(선택)" style={{ width: 140 }} />
        <button className="btn sm" type="submit" disabled={busy}>
          {busy ? "생성 중…" : "회사 추가"}
        </button>
        {error && <span style={{ color: "var(--err)", fontSize: 13 }}>{error}</span>}
      </form>

      {result && (
        <div
          className="msg"
          style={{
            margin: "0 18px 14px",
            background: "var(--ship-bg)",
            border: "1px solid var(--ship)",
            borderRadius: 8,
            padding: 14,
            fontSize: 13,
          }}
        >
          <b>{result.companyName}</b> 생성 완료. 아래 정보를 지금 복사해두세요 — 비밀번호는 다시 보여주지 않습니다.
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }} className="mono">
            <span className="muted">스키마</span>
            <span>{result.schemaName}</span>
            <span className="muted">관리자 이메일</span>
            <span>{result.adminEmail}</span>
            <span className="muted">임시 비밀번호</span>
            <span style={{ fontWeight: 700 }}>{result.tempPassword}</span>
          </div>
        </div>
      )}
    </div>
  );
}
