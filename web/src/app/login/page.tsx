import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import LoginForm from "./LoginForm";

// 회사 목록은 정적 프리렌더링되면 새 회사가 생겨도 다음 배포 전까지 안 보인다 — 항상 새로 조회한다.
export const dynamic = "force-dynamic";

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
