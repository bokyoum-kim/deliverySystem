import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { getBatchDetail } from "@/lib/batch-view";
import { contentDisposition } from "@/lib/download";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const detail = await getBatchDetail(id);
  if (!detail) return new NextResponse("Not found", { status: 404 });

  const rows: (string | number)[][] = [["배송지", "팔레트번호", "박스번호", "박스종류", "상품번호", "상품명", "수량"]];
  let any = false;

  for (const d of detail.dests) {
    const palletMap = new Map<number, typeof d.boxes>();
    for (const bx of d.boxes) {
      if (bx.palletNo == null) continue;
      if (!palletMap.has(bx.palletNo)) palletMap.set(bx.palletNo, []);
      palletMap.get(bx.palletNo)!.push(bx);
    }
    for (const [palletNo, boxes] of palletMap.entries()) {
      any = true;
      const palletId = `${d.dest}-PLT${String(palletNo).padStart(2, "0")}`;
      for (const bx of boxes) {
        const boxId = `${d.dest}-B${String(bx.boxNo).padStart(2, "0")}`;
        const byCode = new Map<string, { name: string; qty: number }>();
        for (const it of bx.items) {
          const cur = byCode.get(it.code) || { name: it.name, qty: 0 };
          cur.qty += it.qty;
          byCode.set(it.code, cur);
        }
        for (const [code, v] of byCode.entries()) {
          rows.push([d.dest, palletId, boxId, bx.boxSpecName, code, v.name, v.qty]);
        }
      }
    }
  }

  if (!any) return new NextResponse("팔레트 대상이 없습니다.", { status: 400 });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "팔레트명세서");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(`팔레트명세서_${detail.key}.xlsx`),
    },
  });
}
