"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "./actions";

export default function CreateUserForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setError("");
    const res = await createUser(new FormData(formRef.current));
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    formRef.current.reset();
    router.refresh();
  }

  return (
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
      <input className="txt" name="email" type="email" placeholder="이메일" style={{ width: 200 }} required />
      <input className="txt" name="name" placeholder="이름(선택)" style={{ width: 140 }} />
      <input className="txt" name="password" type="password" placeholder="비밀번호(6자 이상)" style={{ width: 180 }} required />
      <select className="txt" name="role" defaultValue="MEMBER" style={{ width: 110 }}>
        <option value="MEMBER">일반(MEMBER)</option>
        <option value="ADMIN">관리자(ADMIN)</option>
      </select>
      <button className="btn sm" type="submit" disabled={busy}>
        {busy ? "생성 중…" : "계정 추가"}
      </button>
      {error && <span style={{ color: "var(--err)", fontSize: 13 }}>{error}</span>}
    </form>
  );
}
