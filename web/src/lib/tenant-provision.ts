import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { assertValidSchemaName } from "@/lib/tenant-prisma";

// 회사(테넌트) 스키마를 새로 만들 때, prisma/migrations/*/migration.sql을 그대로 재생(replay)해서
// 지금 schema.prisma가 정의하는 업무 테이블 전체를 새 스키마에 복제한다.
// User/Account/Session/VerificationToken/Company(컨트롤플레인 테이블)에 관련된 문장은 걸러낸다.
// 이 파일이 유일한 필터링 로직 — "회사 만들기" 액션과 향후 유지보수 스크립트가 공유한다.

const CONTROL_PLANE_TABLES = new Set(["User", "Account", "Session", "VerificationToken", "Company"]);

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

function listMigrationFolders(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(MIGRATIONS_DIR, name, "migration.sql")))
    .sort(); // 폴더명이 타임스탬프 접두사라 문자열 정렬 = 시간순
}

function splitStatements(sql: string): string[] {
  // Prisma가 생성한 CREATE TABLE 본문에는 가독성을 위한 빈 줄이 섞여 있어서(예: 컬럼 목록과
  // PRIMARY KEY 제약 사이) 빈 줄 기준 분리는 안전하지 않다. 세미콜론이 실제 문장 구분자다 —
  // 이 파일들에는 문자열 리터럴 안에 세미콜론이 없어 이 가정이 안전하다.
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutComments = withoutBlockComments
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

type Classified = {
  sql: string;
  skip: boolean;
  createdConstraintOrIndexName?: string; // 이 문장이 새로 만드는 제약/인덱스 이름 (denylist 참조로 skip된 경우)
};

// 문장 하나를 분류하고, 필요하면 schemaName으로 테이블 참조를 스키마 한정(qualify)한다.
function classifyAndQualify(
  stmt: string,
  schemaName: string,
  skippedNames: Set<string>
): Classified {
  const qTable = (name: string) => `"${schemaName}"."${name}"`;

  let m: RegExpMatchArray | null;

  // CREATE TABLE "X" ( ... )
  if ((m = stmt.match(/^CREATE TABLE "([A-Za-z0-9_]+)"/))) {
    const table = m[1];
    if (CONTROL_PLANE_TABLES.has(table)) return { sql: stmt, skip: true };
    return { sql: stmt.replace(`CREATE TABLE "${table}"`, `CREATE TABLE ${qTable(table)}`), skip: false };
  }

  // ALTER TABLE "X" ADD CONSTRAINT "C" ... [FOREIGN KEY (...) REFERENCES "R"(...)]
  if ((m = stmt.match(/^ALTER TABLE "([A-Za-z0-9_]+)" ADD CONSTRAINT "([A-Za-z0-9_]+)"/))) {
    const [, table, constraintName] = m;
    const ref = stmt.match(/REFERENCES "([A-Za-z0-9_]+)"/);
    const refTable = ref?.[1];
    if (CONTROL_PLANE_TABLES.has(table) || (refTable && CONTROL_PLANE_TABLES.has(refTable))) {
      skippedNames.add(constraintName);
      return { sql: stmt, skip: true };
    }
    let out = stmt.replace(`ALTER TABLE "${table}"`, `ALTER TABLE ${qTable(table)}`);
    if (refTable) out = out.replace(`REFERENCES "${refTable}"`, `REFERENCES ${qTable(refTable)}`);
    return { sql: out, skip: false };
  }

  // ALTER TABLE "X" DROP CONSTRAINT "C"
  if ((m = stmt.match(/^ALTER TABLE "([A-Za-z0-9_]+)" DROP CONSTRAINT "([A-Za-z0-9_]+)"/))) {
    const [, table, constraintName] = m;
    if (CONTROL_PLANE_TABLES.has(table) || skippedNames.has(constraintName)) {
      return { sql: stmt, skip: true };
    }
    return { sql: stmt.replace(`ALTER TABLE "${table}"`, `ALTER TABLE ${qTable(table)}`), skip: false };
  }

  // ALTER TABLE "X" ADD COLUMN ...  (기타 ALTER TABLE 전반)
  if ((m = stmt.match(/^ALTER TABLE "([A-Za-z0-9_]+)"/))) {
    const table = m[1];
    if (CONTROL_PLANE_TABLES.has(table)) return { sql: stmt, skip: true };
    return { sql: stmt.replace(`ALTER TABLE "${table}"`, `ALTER TABLE ${qTable(table)}`), skip: false };
  }

  // CREATE [UNIQUE] INDEX "I" ON "T"(...) [WHERE ...]
  if ((m = stmt.match(/^CREATE (?:UNIQUE )?INDEX "([A-Za-z0-9_]+)" ON "([A-Za-z0-9_]+)"/))) {
    const [, indexName, table] = m;
    if (CONTROL_PLANE_TABLES.has(table)) {
      skippedNames.add(indexName);
      return { sql: stmt, skip: true };
    }
    return { sql: stmt.replace(`ON "${table}"`, `ON ${qTable(table)}`), skip: false };
  }

  // DROP INDEX "I"
  if ((m = stmt.match(/^DROP INDEX "([A-Za-z0-9_]+)"/))) {
    const indexName = m[1];
    if (skippedNames.has(indexName)) return { sql: stmt, skip: true };
    return { sql: stmt.replace(`DROP INDEX "${indexName}"`, `DROP INDEX ${qTable(indexName)}`), skip: false };
  }

  // 인식 못한 패턴은 안전 쪽으로: denylist 테이블 이름이 어디든 따옴표로 등장하면 건너뛴다.
  const mentionsControlPlane = [...CONTROL_PLANE_TABLES].some((t) => stmt.includes(`"${t}"`));
  if (mentionsControlPlane) return { sql: stmt, skip: true };
  throw new Error(`tenant-provision: 인식하지 못한 마이그레이션 문장 형식입니다: ${stmt.slice(0, 80)}...`);
}

export type PreparedMigration = { name: string; statements: string[] };

// 모든 마이그레이션을 시간순으로 읽어, 테넌트 스키마에 재생할 문장만 걸러서 반환한다.
export function prepareTenantMigrations(schemaName: string): PreparedMigration[] {
  assertValidSchemaName(schemaName);
  const skippedNames = new Set<string>();
  const result: PreparedMigration[] = [];
  let tenantCreateTableCount = 0;

  for (const folder of listMigrationFolders()) {
    const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, folder, "migration.sql"), "utf-8");
    const statements: string[] = [];
    for (const stmt of splitStatements(raw)) {
      const c = classifyAndQualify(stmt, schemaName, skippedNames);
      if (!c.skip) {
        statements.push(c.sql);
        if (/^CREATE TABLE /.test(c.sql)) tenantCreateTableCount++;
      }
    }
    result.push({ name: folder, statements });
  }

  // 가드레일: schema.prisma의 업무 모델 수와 실제로 재생된 CREATE TABLE 수가 어긋나면
  // (컨트롤플레인 테이블이 새로 늘었는데 denylist에 못 넣었다든지) 조용히 불완전한 스키마를
  // 만드는 대신 크게 실패한다.
  const expectedTenantTableCount = countModelsInSchemaPrisma();
  if (tenantCreateTableCount !== expectedTenantTableCount) {
    throw new Error(
      `tenant-provision 가드레일 실패: 재생된 테이블 수(${tenantCreateTableCount})가 ` +
        `schema.prisma의 업무 모델 수(${expectedTenantTableCount})와 다릅니다. ` +
        `CONTROL_PLANE_TABLES denylist를 확인하세요.`
    );
  }

  return result;
}

function countModelsInSchemaPrisma(): number {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  const content = fs.readFileSync(schemaPath, "utf-8");
  const modelNames = [...content.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
  return modelNames.filter((name) => !CONTROL_PLANE_TABLES.has(name)).length;
}

// 새 회사 스키마를 만들고(스키마 생성 + 테이블 전체 복제 + 마이그레이션 대장 기록), 그 회사와
// 첫 ADMIN 사용자까지 한 트랜잭션으로 생성한다. 중간에 실패하면 전부 롤백된다.
export async function provisionCompany(params: {
  companyName: string;
  schemaName: string;
  adminEmail: string;
  adminName: string;
  adminPasswordHash: string;
}): Promise<{ companyId: string; userId: string }> {
  const { companyName, schemaName, adminEmail, adminName, adminPasswordHash } = params;
  assertValidSchemaName(schemaName);

  const migrations = prepareTenantMigrations(schemaName);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
      await tx.$executeRawUnsafe(
        `CREATE TABLE "${schemaName}"."_tenant_migrations" ("name" TEXT PRIMARY KEY, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`
      );

      for (const migration of migrations) {
        for (const stmt of migration.statements) {
          await tx.$executeRawUnsafe(stmt);
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO "${schemaName}"."_tenant_migrations" ("name") VALUES ($1)`,
          migration.name
        );
      }

      const company = await tx.company.create({ data: { name: companyName, schemaName } });
      const user = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash: adminPasswordHash,
          role: "ADMIN",
          companyId: company.id,
        },
      });

      return { companyId: company.id, userId: user.id };
    },
    { timeout: 30000 }
  );
}
