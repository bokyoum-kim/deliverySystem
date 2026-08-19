import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <Suspense fallback={null}>
      <LoginForm companies={companies} />
    </Suspense>
  );
}
