import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { getTenantDb } from "@/lib/tenant-db";
import { contentDisposition } from "@/lib/download";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const db = await getTenantDb();
  const products = await db.product.findMany({
    include: { stock: true },
    orderBy: { code: "asc" },
  });

  const rows: (string | number)[][] = [
    ["상품번호", "바코드", "상품명", "포장수량", "무게", "가로", "세로", "높이", "단가", "재고", "단종"],
    ...products.map((p) => [
      p.code,
      p.barcode ?? "",
      p.name,
      p.packQty,
      p.weightG,
      p.lengthMm,
      p.widthMm,
      p.heightMm,
      p.price,
      p.stock?.quantity ?? 0,
      p.status === "DISCONTINUED" ? "Y" : "N",
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "ProductInfo");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("상품_목록.xlsx"),
    },
  });
}
