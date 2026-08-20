import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isSuperAdmin = req.auth?.user?.role === "SUPERADMIN";
  // 멀티테넌트 전환 이전에 발급된 옛날 세션(JWT)은 companyId/schemaName이 없다.
  // SUPERADMIN은 애초에 회사가 없는 게 정상이라 예외.
  const hasCompanyContext = isSuperAdmin || !!req.auth?.user?.schemaName;
  const { pathname } = req.nextUrl;

  if (!isLoggedIn && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // schemaName 없는 세션으로 업무 화면에 들어오면 getTenantDb()가 예외를 던져 "서버 오류"
  // 화면으로 이어진다. 로그인 화면으로 돌려보낸다.
  // 주의: NextAuth가 요청마다 세션 쿠키를 자체적으로 재서명해서 다시 심기 때문에
  // 여기서 쿠키를 지워도 곧바로 되살아난다 — 쿠키 삭제로는 해결 안 됨(직접 확인됨,
  // /login으로 보내도 로그인 화면이 다시 /dashboard로 튕겨내는 무한 리다이렉트 루프 발생).
  // 그래서 "로그인 화면에서 벗어나기" 판단 자체를 hasCompanyContext 기준으로 바꿔서,
  // 이런 세션은 /login에 도착하면 그냥 로그인 폼이 보이게 한다 — 새로 로그인하면
  // 정상적인 토큰을 받는다.
  if (isLoggedIn && !hasCompanyContext && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasCompanyContext && pathname === "/login") {
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
