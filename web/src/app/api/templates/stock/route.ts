import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { contentDisposition } from "@/lib/download";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const rows: (string | number)[][] = [
    ["상품번호", "상품명", "재고수량"],
    ["310537", "클립온멀티 화이트", 130],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "InStock");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("재고_대량업데이트_템플릿.xlsx"),
    },
  });
}
