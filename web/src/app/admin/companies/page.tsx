import { prisma } from "@/lib/prisma";
import CreateCompanyForm from "./CreateCompanyForm";

// 회사 생성은 마이그레이션 SQL 수십 문장을 순차 실행하는 트랜잭션이라 기본 서버리스
// 타임아웃(10초)보다 오래 걸릴 수 있음
export const maxDuration = 60;

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>회사 관리</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        고객사를 추가하면 독립된 스키마와 첫 관리자 계정이 만들어집니다.
      </p>

      <div className="card">
        <div className="card-h">
          <h3>회사</h3>
          <span className="muted" style={{ fontSize: 13 }}>{companies.length}개</span>
        </div>

        <CreateCompanyForm />

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>회사명</th>
                <th>스키마</th>
                <th className="num-c">사용자 수</th>
                <th>생성일</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="mono muted">{c.schemaName}</td>
                  <td className="num-c mono">{c._count.users}</td>
                  <td className="muted">{c.createdAt.toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    등록된 회사가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
