import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { getBatchDetail } from "@/lib/batch-view";
import { prisma } from "@/lib/prisma";
import { contentDisposition } from "@/lib/download";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const detail = await getBatchDetail(id);
  if (!detail) return new NextResponse("Not found", { status: 404 });

  const warehouses = await prisma.warehouse.findMany();
  const whByName = new Map(warehouses.map((w) => [w.name, w]));

  const sum: (string | number)[][] = [["배송지", "통합지역", "지역", "주소", "박스수", "패킹수량"]];
  const bsum: (string | number)[][] = [["배송지", "박스번호", "박스종류", "품목수", "총수량", "총중량(g)"]];
  const det: (string | number)[][] = [
    ["배송지", "박스번호", "박스종류", "발주번호", "상품번호", "바코드", "상품명", "수량", "포장수량", "포장중량(g)", "라인중량(g)"],
  ];

  for (const d of detail.dests) {
    const wh = whByName.get(d.dest);
    sum.push([d.dest, wh?.region || "", wh?.area || "", wh?.address || "", d.boxes.length, d.qty]);
    for (const bx of d.boxes) {
      const id2 = `${d.dest}-B${String(bx.boxNo).padStart(2, "0")}`;
      let bq = 0,
        bw = 0;
      for (const it of bx.items) {
        // 등록된 무게는 포장(팩) 1개 기준값이라, 실제 중량은 완전한 포장 묶음 수만큼만 곱한다
        const packQty = Math.max(1, it.packQty || 1);
        const lw = it.weightG * Math.floor(it.qty / packQty);
        bq += it.qty;
        bw += lw;
        det.push([d.dest, id2, bx.boxSpecName, it.po, it.code, it.barcode || "", it.name, it.qty, packQty, it.weightG, lw]);
      }
      bsum.push([d.dest, id2, bx.boxSpecName, bx.items.length, bq, bw]);
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), "배송지요약");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bsum), "박스요약");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), "PackingList");
  if (detail.shorts.length) {
    const s: (string | number)[][] = [["상품번호", "상품명", "부족수량"]];
    for (const x of detail.shorts) s.push([x.code, x.name, x.short]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s), "재고부족");
  }
  if (detail.holds.length) {
    const h: (string | number)[][] = [["발주번호", "배송지", "상품번호", "상품명", "수량"]];
    for (const x of detail.holds) h.push([x.po, x.dest, x.code, x.name, x.qty]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h), "반송");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(`PackingList_${detail.key}.xlsx`),
    },
  });
}
