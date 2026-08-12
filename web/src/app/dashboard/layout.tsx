import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";

const NAV = [
  { href: "/dashboard", label: "재고 현황" },
  { href: "/dashboard/products", label: "상품" },
  { href: "/dashboard/boxes", label: "박스" },
  { href: "/dashboard/destinations", label: "배송지" },
  { href: "/dashboard/orders", label: "Order · 패킹" },
  { href: "/dashboard/history", label: "오더패킹 히스토리" },
  { href: "/dashboard/receiving", label: "발주 · 입고" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
              DataSrep
            </small>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "10px 11px",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--sb-ink)",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
          {session.user.role === "ADMIN" && (
            <Link
              href="/dashboard/users"
              style={{
                display: "block",
                padding: "10px 11px",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--sb-ink)",
                textDecoration: "none",
              }}
            >
              사용자 관리
            </Link>
          )}
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
        <div style={{ padding: "24px 30px 60px", maxWidth: 1200 }}>{children}</div>
      </main>
    </div>
  );
}
