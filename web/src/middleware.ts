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

  // 멀티테넌트 전환 이전에 로그인해서 companyId/schemaName이 없는 옛날 세션 쿠키를 아직
  // 들고 있는 경우 — 업무 화면은 schemaName이 없으면 getTenantDb()에서 그대로 예외를 던져
  // "서버 오류" 화면으로 이어진다. 로그인 화면으로 보내면서 쿠키도 지워 다시 로그인하게 한다.
  if (isLoggedIn && !isSuperAdmin && pathname.startsWith("/dashboard") && !req.auth?.user?.schemaName) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("authjs.session-token");
    res.cookies.delete("__Secure-authjs.session-token");
    return res;
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
