import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { contentDisposition } from "@/lib/download";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const rows: (string | number)[][] = [
    ["상품번호", "바코드", "상품명", "무게", "가로", "세로", "높이", "단가", "재고", "단종"],
    ["310537", "4901681461264", "클립온멀티 화이트", 20, 120, 20, 20, 2000, 130, "N"],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "ProductInfo");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("상품_대량등록_템플릿.xlsx"),
    },
  });
}
