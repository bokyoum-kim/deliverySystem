import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { contentDisposition } from "@/lib/download";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const list = await prisma.purchaseOrder.findMany({
    include: { product: true, batch: { select: { key: true } } },
    orderBy: [{ batch: { key: "desc" } }, { createdAt: "asc" }],
  });
  if (!list.length) return new NextResponse("발주 목록이 없습니다.", { status: 400 });

  const rows: (string | number)[][] = [["파일", "상품번호", "바코드", "상품명", "부족수량", "입고수량", "상태"]];
  const statusLabel: Record<string, string> = { PENDING: "미입고", RECEIVED: "입고완료", REFLECTED: "반영완료" };
  for (const r of list) {
    rows.push([
      r.batch.key,
      r.product.code,
      r.product.barcode || "",
      r.product.name,
      r.shortQty,
      r.receivedQty,
      statusLabel[r.status] || r.status,
    ]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "PurchseOrderList");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("구매발주목록.xlsx"),
    },
  });
}
