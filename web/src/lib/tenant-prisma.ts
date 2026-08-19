import { PrismaClient } from "@prisma/client";

// 회사별 스키마 클라이언트는 반드시 세션 풀러(DIRECT_URL, 5432)로 연결한다.
// 트랜잭션 모드 풀러(DATABASE_URL)는 트랜잭션이 끝날 때마다 물리 커넥션을 다른 요청에 재할당할 수
// 있어서, ?schema=로 건 search_path가 남은 채로 다른 회사 요청이 그 커넥션을 받으면 회사 간
// 데이터가 새어 들어갈 위험이 있다. 세션 풀러는 커넥션이 그 세션 동안 고정되므로 안전하다.
const SESSION_POOLER_URL = process.env.DIRECT_URL;

const SCHEMA_NAME_RE = /^[a-z][a-z0-9_]{0,62}$/;

export function assertValidSchemaName(schemaName: string): void {
  if (!SCHEMA_NAME_RE.test(schemaName)) {
    throw new Error(`유효하지 않은 스키마 이름: ${schemaName}`);
  }
}

const globalForTenant = globalThis as unknown as {
  tenantPrismaClients: Map<string, PrismaClient> | undefined;
};
const cache = globalForTenant.tenantPrismaClients ?? new Map<string, PrismaClient>();
if (process.env.NODE_ENV !== "production") globalForTenant.tenantPrismaClients = cache;

export function getTenantPrisma(schemaName: string): PrismaClient {
  assertValidSchemaName(schemaName);
  if (!SESSION_POOLER_URL) throw new Error("DIRECT_URL이 설정되지 않았습니다.");

  const cached = cache.get(schemaName);
  if (cached) return cached;

  const url = new URL(SESSION_POOLER_URL);
  url.searchParams.set("schema", schemaName);
  // 화면 대부분이 Promise.all로 같은 클라이언트에 병렬 쿼리를 여러 개 날린다(예: 홈 화면 3개).
  // connection_limit=1이면 그 병렬 쿼리들이 커넥션 하나를 두고 내부에서 줄을 서야 해서,
  // 부하가 조금만 겹쳐도 pool_timeout에 걸려 요청이 그대로 에러로 터진다(실제로 배포 직후
  // 겪은 서버 오류의 원인). 회사가 아직 소수라 안전하게 여유를 둔다.
  url.searchParams.set("connection_limit", "5");
  url.searchParams.set("pool_timeout", "15");

  const client = new PrismaClient({ datasourceUrl: url.toString() });
  cache.set(schemaName, client);
  return client;
}
