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
  // DB 인스턴스 전체 max_connections가 60으로 작다(Supabase 소형 컴퓨트, 실측 확인).
  // Vercel 서버리스는 동시 요청이 몰리면 인스턴스를 수평으로 여러 개 띄우고, 각 인스턴스가
  // (globalThis 캐시로) 스키마별로 별도 PrismaClient를 새로 만들어 connection_limit만큼
  // 커넥션을 잡고 그 인스턴스가 warm한 동안 계속 들고 있는다 — 그래서 connection_limit을
  // 올리면 인스턴스 수만큼 곱해져서 60개 한도를 더 쉽게 넘긴다(실측: limit=5일 때 동시 요청
  // 부하 테스트에서 500 에러 재현됨). 반대로 인스턴스당 커넥션은 최소로 유지하고,
  // 화면 하나가 Promise.all로 같은 클라이언트에 병렬 쿼리 여러 개를 날리는 경우
  // (예: 홈 화면 3개, 패킹 생성 3개)는 커넥션을 더 안 늘리고 pool_timeout을 넉넉히 줘서
  // 그 쿼리들이 실패 대신 줄을 서서 기다리게 한다.
  url.searchParams.set("connection_limit", "2");
  url.searchParams.set("pool_timeout", "20");

  const client = new PrismaClient({ datasourceUrl: url.toString() });
  cache.set(schemaName, client);
  return client;
}
