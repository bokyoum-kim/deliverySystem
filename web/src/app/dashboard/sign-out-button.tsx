"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      style={{
        marginTop: 8,
        background: "none",
        border: 0,
        color: "var(--sb-ink)",
        cursor: "pointer",
        fontSize: 12,
        textDecoration: "underline",
        padding: 0,
      }}
    >
      로그아웃
    </button>
  );
}
