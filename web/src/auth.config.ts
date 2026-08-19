import type { NextAuthConfig } from "next-auth";

// 미들웨어(Edge 런타임)에서도 안전하게 쓸 수 있는 가벼운 설정.
// Prisma/bcrypt처럼 Node 전용 API를 쓰는 provider/adapter는 auth.ts(전체 설정)에만 둔다.
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role;
        token.companyId = (user as { companyId?: string | null }).companyId ?? null;
        token.schemaName = (user as { schemaName?: string | null }).schemaName ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as string) ?? "MEMBER";
        session.user.companyId = (token.companyId as string | null) ?? null;
        session.user.schemaName = (token.schemaName as string | null) ?? null;
      }
      return session;
    },
  },
};
