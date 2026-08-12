import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteUser } from "./actions";
import CreateUserForm from "./CreateUserForm";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>사용자 관리</h1>
      <p className="muted" style={{ marginTop: 0 }}>테스트·팀원 계정을 만들고 관리합니다. (관리자 전용)</p>

      <div className="card">
        <div className="card-h">
          <h3>사용자</h3>
          <span className="muted" style={{ fontSize: 13 }}>{users.length}명</span>
        </div>

        <CreateUserForm />

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>이메일</th>
                <th>이름</th>
                <th>권한</th>
                <th>가입일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="mono">{u.email}</td>
                  <td>{u.name || "—"}</td>
                  <td>
                    <span className={"badge " + (u.role === "ADMIN" ? "b-warn" : "b-ship")}>{u.role}</span>
                  </td>
                  <td className="muted">{u.createdAt.toLocaleDateString("ko-KR")}</td>
                  <td>
                    {u.id !== session.user.id && (
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="btn danger sm" type="submit">삭제</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
