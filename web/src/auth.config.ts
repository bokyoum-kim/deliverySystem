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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as string) ?? "MEMBER";
      }
      return session;
    },
  },
};
