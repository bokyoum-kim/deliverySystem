import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";
import { NAV_ICONS } from "./nav-icons";
import NavLink from "./NavLink";

const NAV = [
  { href: "/dashboard", label: "재고 현황" },
  { href: "/dashboard/products", label: "상품" },
  { href: "/dashboard/boxes", label: "박스" },
  { href: "/dashboard/destinations", label: "배송지" },
  { href: "/dashboard/orders", label: "Order · 패킹" },
  { href: "/dashboard/history", label: "오더패킹 히스토리" },
  { href: "/dashboard/receiving", label: "발주 · 입고" },
  { href: "/dashboard/stats", label: "통계" },
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
            <NavLink key={item.href} href={item.href} icon={NAV_ICONS[item.href]}>
              {item.label}
            </NavLink>
          ))}
          {session.user.role === "ADMIN" && (
            <NavLink href="/dashboard/users" icon={NAV_ICONS["/dashboard/users"]}>
              사용자 관리
            </NavLink>
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

      {/* minWidth:0 — 그리드 칸(1fr)은 기본값(auto)이면 내용보다 작게 못 줄어서, 넓은 표가 있으면
          칸이 화면 밖까지 늘어나 페이지 전체가 가로로 스크롤된다. 0으로 두면 표가 자기 영역
          안에서만(overflowX:auto) 스크롤된다. */}
      <main style={{ minWidth: 0 }}>
        {/* 상품·패킹 등 열이 많은 표가 1200px에서는 가로로 눌려(상품명이 잘려) 1600으로 넓힘 */}
        <div style={{ padding: "24px 30px 60px", maxWidth: 1600 }}>{children}</div>
      </main>
    </div>
  );
}
