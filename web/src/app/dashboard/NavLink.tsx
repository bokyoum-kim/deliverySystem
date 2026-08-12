"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "10px 11px",
        borderRadius: 8,
        fontSize: 14,
        color: "var(--sb-ink)",
        textDecoration: "none",
        background: active ? "var(--sb-active)" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      {children}
    </Link>
  );
}
