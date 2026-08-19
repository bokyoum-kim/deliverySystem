"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" || !session.user.companyId) {
    throw new Error("관리자만 가능합니다.");
  }
  return session;
}

export async function createUser(formData: FormData): Promise<{ error?: string }> {
  const session = await requireAdmin();
  const companyId = session.user.companyId!;

  const email = str(formData.get("email"));
  const name = str(formData.get("name"));
  const password = str(formData.get("password"));
  const role = str(formData.get("role")) === "ADMIN" ? "ADMIN" : "MEMBER";

  if (!email || !password) return { error: "이메일과 비밀번호를 입력하세요." };
  if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };

  const existing = await prisma.user.findUnique({ where: { companyId_email: { companyId, email } } });
  if (existing) return { error: "이미 존재하는 이메일입니다." };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name: name || null, passwordHash, role, companyId },
  });

  revalidatePath("/dashboard/users");
  return {};
}

export async function deleteUser(formData: FormData) {
  const session = await requireAdmin();
  const id = str(formData.get("id"));
  if (!id) return;
  if (id === session.user.id) return; // 자기 자신은 삭제 불가

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.companyId !== session.user.companyId) return; // 다른 회사 사용자는 건드릴 수 없음

  await prisma.user.delete({ where: { id } });
  revalidatePath("/dashboard/users");
}
