import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/app/dashboard/sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") redirect("/dashboard");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "232px 1fr", minHeight: "100vh" }}>
      <aside
        style={{
          background: "var(--sidebar)",
          color: "var(--sb-ink)",
          padding: "22px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px" }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--brand)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            D
          </div>
          <div>
            <b style={{ fontSize: 14 }}>물류관리 시스템</b>
            <small style={{ display: "block", color: "var(--sb-muted)", fontSize: 11 }}>
              플랫폼 관리자
            </small>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              background: "var(--sb-active)",
              color: "var(--sb-ink)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            회사 관리
          </div>
        </nav>

        <div
          style={{
            marginTop: "auto",
            color: "var(--sb-muted)",
            fontSize: 11,
            padding: 10,
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {session.user.email}
          <SignOutButton />
        </div>
      </aside>

      <main>
        <div style={{ padding: "24px 30px 60px", maxWidth: 900 }}>{children}</div>
      </main>
    </div>
  );
}
