"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export const SUPERADMIN_SENTINEL = "__superadmin__";

type CompanyOpt = { id: string; name: string };

export default function LoginForm({ companies }: { companies: CompanyOpt[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      companyId,
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("회사·이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    const dest = companyId === SUPERADMIN_SENTINEL ? "/admin/companies" : "/dashboard";
    router.push(params.get("callbackUrl") || dest);
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: 340, padding: 28 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--brand)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
            }}
          >
            D
          </div>
          <div>
            <b>물류관리 시스템</b>
            <div className="muted" style={{ fontSize: 12 }}>로그인</div>
          </div>
        </div>

        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>회사</label>
        <select
          className="txt"
          required
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          style={{ width: "100%", marginBottom: 14 }}
        >
          <option value="" disabled>
            회사를 선택하세요
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={SUPERADMIN_SENTINEL}>플랫폼 관리자로 로그인</option>
        </select>

        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>이메일</label>
        <input
          className="txt"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: 14 }}
        />

        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>비밀번호</label>
        <input
          className="txt"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: 14 }}
        />

        {error && (
          <div style={{ color: "var(--err)", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
