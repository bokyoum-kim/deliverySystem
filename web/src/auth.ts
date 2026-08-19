import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

const SUPERADMIN_SENTINEL = "__superadmin__";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        companyId: { label: "회사", type: "text" },
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      authorize: async (credentials) => {
        const companyId = credentials?.companyId as string | undefined;
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!companyId || !email || !password) return null;

        const user =
          companyId === SUPERADMIN_SENTINEL
            ? await prisma.user.findFirst({
                where: { email, companyId: null, role: "SUPERADMIN" },
                include: { company: true },
              })
            : await prisma.user.findUnique({
                where: { companyId_email: { companyId, email } },
                include: { company: true },
              });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          schemaName: user.company?.schemaName ?? null,
        };
      },
    }),
  ],
});
