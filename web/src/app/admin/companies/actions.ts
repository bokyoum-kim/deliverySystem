"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { provisionCompany } from "@/lib/tenant-provision";
import { revalidatePath } from "next/cache";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

async function requireSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") throw new Error("플랫폼 관리자만 가능합니다.");
  return session;
}

function genSchemaName(): string {
  return "tenant_" + crypto.randomBytes(6).toString("hex");
}

function genTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function createCompany(
  formData: FormData
): Promise<{ error?: string; companyName?: string; schemaName?: string; adminEmail?: string; tempPassword?: string }> {
  await requireSuperAdmin();

  const companyName = str(formData.get("companyName"));
  const adminEmail = str(formData.get("adminEmail"));
  const adminName = str(formData.get("adminName"));

  if (!companyName) return { error: "회사명을 입력하세요." };
  if (!adminEmail) return { error: "관리자 이메일을 입력하세요." };

  const existingEmail = await prisma.user.findFirst({ where: { email: adminEmail, companyId: { not: null } } });
  if (existingEmail) return { error: "이미 다른 회사에서 사용 중인 이메일입니다." };

  let schemaName = genSchemaName();
  // 충돌은 사실상 없겠지만, 있다면 한 번 더 시도
  if (await prisma.company.findUnique({ where: { schemaName } })) schemaName = genSchemaName();

  const tempPassword = genTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  try {
    await provisionCompany({
      companyName,
      schemaName,
      adminEmail,
      adminName: adminName || "관리자",
      adminPasswordHash: passwordHash,
    });
  } catch (e) {
    return { error: "회사 생성 중 오류가 발생했습니다: " + (e instanceof Error ? e.message : String(e)) };
  }

  revalidatePath("/admin/companies");
  return { companyName, schemaName, adminEmail, tempPassword };
}
