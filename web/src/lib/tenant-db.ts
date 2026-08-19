import { auth } from "@/auth";
import { getTenantPrisma } from "./tenant-prisma";

// 업무 데이터(상품·박스·발주 등) 화면·액션에서 쓰는 헬퍼.
// 로그인한 사용자의 회사 스키마로 연결된 PrismaClient를 반환한다.
// SUPERADMIN(회사 없음)은 애초에 업무 데이터에 접근할 수 없다.
export async function getTenantDb() {
  const session = await auth();
  const schemaName = session?.user?.schemaName;
  if (!schemaName) {
    throw new Error("로그인한 회사 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
  }
  return getTenantPrisma(schemaName);
}
