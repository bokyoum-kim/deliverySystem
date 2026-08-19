import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { getBatchDetail } from "@/lib/batch-view";
import { getTenantDb } from "@/lib/tenant-db";
import { contentDisposition } from "@/lib/download";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const db = await getTenantDb();
  const { id } = await params;
  const detail = await getBatchDetail(db, id);
  if (!detail) return new NextResponse("Not found", { status: 404 });
  if (!detail.holds.length) return new NextResponse("반송 대상이 없습니다.", { status: 400 });

  const products = await db.product.findMany({ where: { code: { in: detail.holds.map((h) => h.code) } } });
  const barcodeByCode = new Map(products.map((p) => [p.code, p.barcode || ""]));

  const rows: (string | number)[][] = [["발주번호", "배송지", "상품번호", "바코드", "상품명", "수량", "사유"]];
  for (const h of detail.holds) {
    rows.push([h.po, h.dest, h.code, barcodeByCode.get(h.code) || "", h.name, h.qty, "단종"]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "반송리스트");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(`반송리스트_${detail.key}.xlsx`),
    },
  });
}
