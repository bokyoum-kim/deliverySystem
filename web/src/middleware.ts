import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isSuperAdmin = req.auth?.user?.role === "SUPERADMIN";
  const { pathname } = req.nextUrl;

  if (!isLoggedIn && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL(isSuperAdmin ? "/admin/companies" : "/dashboard", req.nextUrl));
  }

  // SUPERADMIN은 회사가 없어 업무 데이터에 접근할 수 없다 — 업무 화면 대신 회사 관리로.
  if (isLoggedIn && isSuperAdmin && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/admin/companies", req.nextUrl));
  }
  // 일반 사용자는 회사 관리 화면에 들어올 수 없다.
  if (isLoggedIn && !isSuperAdmin && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
